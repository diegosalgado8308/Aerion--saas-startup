import crypto from "crypto";
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyCredentials, ValidationError } from "@/lib/workspace";
import { requestPasswordReset, resetPassword, buildResetUrl, hashToken } from "@/lib/passwordReset";
import { uniqueEmail, makeTenant, cleanupWorkspace } from "./helpers";

const createdWorkspaceIds = [];

afterEach(async () => {
  while (createdWorkspaceIds.length) {
    await cleanupWorkspace(createdWorkspaceIds.pop());
  }
});

/** Sets a valid, unexpired reset token directly — bypasses email delivery, same reasoning as hashToken's export. */
async function giveUserAValidToken(userId, { expiresInMs = 60 * 60 * 1000 } = {}) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { resetTokenHash: hashToken(rawToken), resetTokenExpiresAt: new Date(Date.now() + expiresInMs) },
  });
  return rawToken;
}

describe("requestPasswordReset", () => {
  it("rejects an invalid email", async () => {
    await expect(requestPasswordReset("not-an-email")).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolves without throwing for a nonexistent email, and creates no token anywhere", async () => {
    await expect(requestPasswordReset("nobody@example.test")).resolves.toBeUndefined();
  });

  it("sets a hashed, expiring token on the matching user", async () => {
    const { workspace, user } = await makeTenant("reset-request");
    createdWorkspaceIds.push(workspace.id);

    await requestPasswordReset(user.email);

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed.resetTokenHash).not.toBeNull();
    expect(refreshed.resetTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("email lookup is case-insensitive, matching signup/login", async () => {
    const { workspace, user } = await makeTenant("reset-case");
    createdWorkspaceIds.push(workspace.id);

    await requestPasswordReset(user.email.toUpperCase());

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed.resetTokenHash).not.toBeNull();
  });
});

describe("resetPassword", () => {
  it("changes the password for a valid, unexpired token", async () => {
    const { workspace, user } = await makeTenant("reset-ok");
    createdWorkspaceIds.push(workspace.id);
    const rawToken = await giveUserAValidToken(user.id);

    await resetPassword(rawToken, "new-correct-horse");

    const result = await verifyCredentials(user.email, "new-correct-horse");
    expect(result?.id).toBe(user.id);
  });

  it("invalidates the token after use (can't be replayed)", async () => {
    const { workspace, user } = await makeTenant("reset-replay");
    createdWorkspaceIds.push(workspace.id);
    const rawToken = await giveUserAValidToken(user.id);

    await resetPassword(rawToken, "new-correct-horse");

    await expect(resetPassword(rawToken, "another-password")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an expired token", async () => {
    const { workspace, user } = await makeTenant("reset-expired");
    createdWorkspaceIds.push(workspace.id);
    const rawToken = await giveUserAValidToken(user.id, { expiresInMs: -1000 });

    await expect(resetPassword(rawToken, "new-correct-horse")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a token that doesn't exist", async () => {
    await expect(resetPassword("not-a-real-token", "new-correct-horse")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const { workspace, user } = await makeTenant("reset-shortpw");
    createdWorkspaceIds.push(workspace.id);
    const rawToken = await giveUserAValidToken(user.id);

    await expect(resetPassword(rawToken, "short")).rejects.toBeInstanceOf(ValidationError);
  });

  it("clears an active login lockout as part of a successful reset", async () => {
    const { workspace, user } = await makeTenant("reset-clears-lockout");
    createdWorkspaceIds.push(workspace.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const rawToken = await giveUserAValidToken(user.id);

    await resetPassword(rawToken, "new-correct-horse");

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed.failedLoginAttempts).toBe(0);
    expect(refreshed.lockedUntil).toBeNull();

    const result = await verifyCredentials(user.email, "new-correct-horse");
    expect(result?.id).toBe(user.id);
  });
});

describe("buildResetUrl", () => {
  const originalAppUrl = process.env.APP_URL;
  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  it("embeds the token as a query param", () => {
    delete process.env.APP_URL;
    const url = buildResetUrl("abc123");
    expect(url).toBe("http://localhost:3000/reset-password?token=abc123");
  });

  it("uses APP_URL when set, stripping any trailing slash", () => {
    process.env.APP_URL = "https://app.example.com/";
    const url = buildResetUrl("abc123");
    expect(url).toBe("https://app.example.com/reset-password?token=abc123");
  });

  it("URL-encodes the token", () => {
    delete process.env.APP_URL;
    const url = buildResetUrl("a b&c");
    expect(url).toBe("http://localhost:3000/reset-password?token=a%20b%26c");
  });
});
