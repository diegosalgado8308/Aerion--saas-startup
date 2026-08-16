import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/workspace";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

// sha256, not bcrypt: the raw token is 256 bits of crypto.randomBytes, not a
// low-entropy human password, so a fast deterministic hash is fine here and
// is what makes a direct @unique lookup by resetTokenHash possible at all —
// bcrypt's per-call random salt can't be queried that way. See the schema
// comment on User.resetTokenHash.
// Exported for tests: it's how a test builds a valid token scenario without
// going through email delivery, which — like the rest of lib/email.js — is
// deliberately outside what this suite exercises (see ARCHITECTURE.md's
// Testing strategy).
export function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function buildResetUrl(rawToken) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Always resolves the same way regardless of whether the email matches an
 * account, or whether the notification email actually sent — the same
 * "don't reveal why" principle verifyCredentials (lib/workspace.js) applies
 * to login. A caller that showed a different outcome for "no such account"
 * vs. "email delivery is broken" would hand an attacker exactly the
 * account-enumeration signal this is built to avoid, so delivery failures
 * are logged server-side instead of surfaced to the caller.
 */
export async function requestPasswordReset(email) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new ValidationError("A valid email is required.");
  }

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashToken(rawToken),
      resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  try {
    await sendPasswordResetEmail({ to: user.email, resetUrl: buildResetUrl(rawToken) });
  } catch (err) {
    console.error("[passwordReset] failed to send reset email:", err);
  }
}

/**
 * Resets the password for whoever holds a valid, unexpired token, and also
 * clears the login lockout (failedLoginAttempts/lockedUntil) — completing a
 * reset is proof of email ownership, a stronger signal than the lockout was
 * ever guarding against, and this is the only self-serve recovery path a
 * locked-out user has (see verifyCredentials in lib/workspace.js).
 */
export async function resetPassword(rawToken, newPassword) {
  const cleanToken = (rawToken || "").toString().trim();
  if (!cleanToken) throw new ValidationError("Missing or invalid reset link.");
  if (!newPassword || newPassword.toString().length < 8) {
    throw new ValidationError("Password must be at least 8 characters.");
  }

  const user = await prisma.user.findUnique({ where: { resetTokenHash: hashToken(cleanToken) } });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    throw new ValidationError("This reset link is invalid or has expired.");
  }

  const hashed = await bcrypt.hash(newPassword.toString(), 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}
