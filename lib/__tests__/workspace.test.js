import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createWorkspaceAndOwner,
  joinWorkspaceViaInvite,
  getWorkspaceMembers,
  removeMember,
  buildInviteUrl,
  verifyCredentials,
  ValidationError,
} from "@/lib/workspace";
import { uniqueEmail, makeTenant, cleanupWorkspace } from "./helpers";

const createdWorkspaceIds = [];

afterEach(async () => {
  while (createdWorkspaceIds.length) {
    await cleanupWorkspace(createdWorkspaceIds.pop());
  }
});

describe("createWorkspaceAndOwner", () => {
  it("creates a workspace and an OWNER user", async () => {
    const email = uniqueEmail("owner");
    const { workspace, user } = await createWorkspaceAndOwner({
      name: "Ada Lovelace",
      email,
      password: "correct-horse-battery",
      workspaceName: "Analytical Engines",
    });
    createdWorkspaceIds.push(workspace.id);

    expect(user.role).toBe("OWNER");
    expect(user.workspaceId).toBe(workspace.id);
    expect(user.email).toBe(email);
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail("dupe");
    const { workspace } = await createWorkspaceAndOwner({
      name: "First",
      email,
      password: "correct-horse-battery",
      workspaceName: "First Workspace",
    });
    createdWorkspaceIds.push(workspace.id);

    await expect(
      createWorkspaceAndOwner({
        name: "Second",
        email,
        password: "correct-horse-battery",
        workspaceName: "Second Workspace",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a password shorter than 8 characters", async () => {
    await expect(
      createWorkspaceAndOwner({
        name: "Short Pw",
        email: uniqueEmail("shortpw"),
        password: "abc123",
        workspaceName: "Short Pw Workspace",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing workspace name", async () => {
    await expect(
      createWorkspaceAndOwner({
        name: "No Workspace",
        email: uniqueEmail("noworkspace"),
        password: "correct-horse-battery",
        workspaceName: "",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("joinWorkspaceViaInvite", () => {
  it("joins an existing workspace as a MEMBER using its invite code", async () => {
    const { workspace: owned } = await makeTenant("invite-owner");
    createdWorkspaceIds.push(owned.id);

    const { workspace, user } = await joinWorkspaceViaInvite({
      name: "New Member",
      email: uniqueEmail("member"),
      password: "correct-horse-battery",
      inviteCode: owned.inviteCode,
    });

    expect(workspace.id).toBe(owned.id);
    expect(user.role).toBe("MEMBER");
    expect(user.workspaceId).toBe(owned.id);
  });

  it("rejects an invalid invite code", async () => {
    await expect(
      joinWorkspaceViaInvite({
        name: "Nobody",
        email: uniqueEmail("badcode"),
        password: "correct-horse-battery",
        inviteCode: "this-code-does-not-exist",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getWorkspaceMembers tenant isolation", () => {
  it("only returns members belonging to the requested workspace", async () => {
    const { workspace: workspaceA, user: ownerA } = await makeTenant("iso-a");
    const { workspace: workspaceB, user: ownerB } = await makeTenant("iso-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    const membersA = await getWorkspaceMembers(workspaceA.id);
    const membersB = await getWorkspaceMembers(workspaceB.id);

    expect(membersA.map((m) => m.id)).toEqual([ownerA.id]);
    expect(membersB.map((m) => m.id)).toEqual([ownerB.id]);
    expect(membersA.map((m) => m.id)).not.toContain(ownerB.id);
  });
});

describe("removeMember", () => {
  it("lets the owner remove a member", async () => {
    const { workspace, user: owner } = await makeTenant("remove-owner");
    createdWorkspaceIds.push(workspace.id);
    const { user: member } = await joinWorkspaceViaInvite({
      name: "Removable",
      email: uniqueEmail("removable"),
      password: "correct-horse-battery",
      inviteCode: workspace.inviteCode,
    });

    await removeMember({ workspaceId: workspace.id, actingUserId: owner.id, targetUserId: member.id });

    const remaining = await getWorkspaceMembers(workspace.id);
    expect(remaining.map((m) => m.id)).toEqual([owner.id]);
  });

  it("prevents a non-owner from removing a member", async () => {
    const { workspace } = await makeTenant("remove-nonowner");
    createdWorkspaceIds.push(workspace.id);
    const { user: memberA } = await joinWorkspaceViaInvite({
      name: "Member A",
      email: uniqueEmail("membera"),
      password: "correct-horse-battery",
      inviteCode: workspace.inviteCode,
    });
    const { user: memberB } = await joinWorkspaceViaInvite({
      name: "Member B",
      email: uniqueEmail("memberb"),
      password: "correct-horse-battery",
      inviteCode: workspace.inviteCode,
    });

    await expect(
      removeMember({ workspaceId: workspace.id, actingUserId: memberA.id, targetUserId: memberB.id })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("prevents the owner from removing themself", async () => {
    const { workspace, user: owner } = await makeTenant("remove-self");
    createdWorkspaceIds.push(workspace.id);

    await expect(
      removeMember({ workspaceId: workspace.id, actingUserId: owner.id, targetUserId: owner.id })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("prevents removing a user who belongs to a different workspace", async () => {
    const { workspace: workspaceA, user: ownerA } = await makeTenant("cross-a");
    const { workspace: workspaceB, user: ownerB } = await makeTenant("cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    await expect(
      removeMember({ workspaceId: workspaceA.id, actingUserId: ownerA.id, targetUserId: ownerB.id })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("buildInviteUrl", () => {
  const originalAppUrl = process.env.APP_URL;
  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  it("embeds the workspace's invite code as a query param", () => {
    delete process.env.APP_URL;
    const url = buildInviteUrl({ inviteCode: "abc123" });
    expect(url).toBe("http://localhost:3000/signup?mode=join&code=abc123");
  });

  it("uses APP_URL when set, stripping any trailing slash", () => {
    process.env.APP_URL = "https://app.example.com/";
    const url = buildInviteUrl({ inviteCode: "abc123" });
    expect(url).toBe("https://app.example.com/signup?mode=join&code=abc123");
  });

  it("URL-encodes the invite code", () => {
    delete process.env.APP_URL;
    const url = buildInviteUrl({ inviteCode: "a b&c" });
    expect(url).toBe("http://localhost:3000/signup?mode=join&code=a%20b%26c");
  });
});

describe("verifyCredentials", () => {
  it("returns the user for correct credentials", async () => {
    const { workspace, user } = await makeTenant("creds-ok");
    createdWorkspaceIds.push(workspace.id);

    const result = await verifyCredentials(user.email, "correct-horse-battery");
    expect(result?.id).toBe(user.id);
  });

  it("returns null for a nonexistent email, without throwing", async () => {
    await expect(verifyCredentials("nobody@example.test", "whatever")).resolves.toBeNull();
  });

  it("returns null for a wrong password and increments the failed-attempt counter", async () => {
    const { workspace, user } = await makeTenant("creds-wrong");
    createdWorkspaceIds.push(workspace.id);

    const result = await verifyCredentials(user.email, "not-the-password");
    expect(result).toBeNull();

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed.failedLoginAttempts).toBe(1);
  });

  it("locks the account after 5 failed attempts and rejects even a correct password while locked", async () => {
    const { workspace, user } = await makeTenant("creds-lockout");
    createdWorkspaceIds.push(workspace.id);

    for (let i = 0; i < 5; i += 1) {
      await verifyCredentials(user.email, "wrong");
    }

    const locked = await prisma.user.findUnique({ where: { id: user.id } });
    expect(locked.lockedUntil).not.toBeNull();
    expect(locked.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    expect(locked.failedLoginAttempts).toBe(0); // reset when the lock kicks in

    // Even the correct password is rejected while locked.
    const result = await verifyCredentials(user.email, "correct-horse-battery");
    expect(result).toBeNull();
  });

  it("allows login again once the lockout window has passed", async () => {
    const { workspace, user } = await makeTenant("creds-lockout-expired");
    createdWorkspaceIds.push(workspace.id);

    // Simulate an already-expired lockout rather than waiting 15 real minutes.
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });

    const result = await verifyCredentials(user.email, "correct-horse-battery");
    expect(result?.id).toBe(user.id);
  });

  it("resets the failed-attempt counter and any lockout on a successful login", async () => {
    const { workspace, user } = await makeTenant("creds-reset");
    createdWorkspaceIds.push(workspace.id);
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 3 } });

    await verifyCredentials(user.email, "correct-horse-battery");

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed.failedLoginAttempts).toBe(0);
    expect(refreshed.lockedUntil).toBeNull();
  });
});
