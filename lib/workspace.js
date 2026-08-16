import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertCanAddMember } from "@/lib/billing";
// Imported (not defined here) so lib/billing.js can import ValidationError
// without creating a workspace.js <-> billing.js circular import. Re-exported
// below too — `export { X } from "module"` alone is a pure re-export with no
// local binding, so this file's own `throw new ValidationError(...)` calls
// need the import; the separate `export` line is what keeps every existing
// `import { ValidationError } from "@/lib/workspace"` call site working.
import { ValidationError } from "@/lib/errors";

export { ValidationError };

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

/** Builds a one-click join link that pre-fills the invite code on the signup form. */
export function buildInviteUrl(workspace) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/signup?mode=join&code=${encodeURIComponent(workspace.inviteCode)}`;
}

/**
 * Creates a brand-new workspace with the given user as its OWNER.
 * Workspace is created first (no dependency on the user), then the
 * user is created referencing it — avoids any circular FK ordering issue.
 */
export async function createWorkspaceAndOwner({ name, email, password, workspaceName }) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = (name || "").toString().trim();
  const cleanWorkspaceName = (workspaceName || "").toString().trim();

  if (!cleanName) throw new ValidationError("Name is required.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new ValidationError("A valid email is required.");
  if (!password || password.toString().length < 8) throw new ValidationError("Password must be at least 8 characters.");
  if (!cleanWorkspaceName) throw new ValidationError("Workspace name is required.");

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) throw new ValidationError("An account with that email already exists.");

  const hashed = await bcrypt.hash(password.toString(), 10);

  const workspace = await prisma.workspace.create({ data: { name: cleanWorkspaceName } });

  const user = await prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      password: hashed,
      role: "OWNER",
      workspaceId: workspace.id,
    },
  });

  return { workspace, user };
}

/**
 * Joins an existing workspace as a MEMBER via its invite code.
 */
export async function joinWorkspaceViaInvite({ name, email, password, inviteCode }) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = (name || "").toString().trim();
  const cleanCode = (inviteCode || "").toString().trim();

  if (!cleanName) throw new ValidationError("Name is required.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new ValidationError("A valid email is required.");
  if (!password || password.toString().length < 8) throw new ValidationError("Password must be at least 8 characters.");
  if (!cleanCode) throw new ValidationError("Invite code is required.");

  const workspace = await prisma.workspace.findUnique({ where: { inviteCode: cleanCode } });
  if (!workspace) throw new ValidationError("Invalid invite code.");

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) throw new ValidationError("An account with that email already exists.");

  await assertCanAddMember(workspace.id);

  const hashed = await bcrypt.hash(password.toString(), 10);

  const user = await prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      password: hashed,
      role: "MEMBER",
      workspaceId: workspace.id,
    },
  });

  return { workspace, user };
}

const MAX_FAILED_LOGIN_ATTEMPTS = 8;
const LOGIN_LOCKOUT_MINUTES = 24 * 60;

/**
 * Verifies credentials for the NextAuth Credentials provider, enforcing a
 * failed-attempt lockout. Returns the user on success, or null for every
 * failure mode (no such account, wrong password, or currently locked out) —
 * deliberately indistinguishable to the caller, since revealing *why* a
 * login failed makes account enumeration easier, and revealing lockout
 * status specifically would let an attacker confirm they've locked out a
 * real account.
 *
 * Trade-off worth knowing: this scheme is itself lockout-able — repeatedly
 * submitting a wrong password for someone else's email locks *them* out for
 * 24 hours. That's the standard cost of attempt-based lockout without
 * per-IP tracking, and is accepted here rather than adding IP-based limits,
 * which would need request context this DB-only function doesn't have.
 */
export async function verifyCredentials(email, password) {
  const cleanEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) return null;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return null;
  }

  const valid = await bcrypt.compare((password || "").toString(), user.password);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const data =
      attempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000) }
        : { failedLoginAttempts: attempts };
    await prisma.user.update({ where: { id: user.id }, data });
    return null;
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  return user;
}

export async function getWorkspaceMembers(workspaceId) {
  return prisma.user.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}

export async function removeMember({ workspaceId, actingUserId, targetUserId }) {
  const actingUser = await prisma.user.findUnique({ where: { id: actingUserId } });
  if (!actingUser || actingUser.workspaceId !== workspaceId || actingUser.role !== "OWNER") {
    throw new ValidationError("Only the workspace owner can remove members.");
  }
  if (actingUserId === targetUserId) {
    throw new ValidationError("You can't remove yourself.");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.workspaceId !== workspaceId) {
    throw new ValidationError("That member isn't in your workspace.");
  }

  // Batched into one round-trip and made atomic: without the transaction, a
  // failure on the delete after the updateMany succeeded would silently
  // unassign the target's tasks without actually removing them.
  await prisma.$transaction([
    prisma.task.updateMany({ where: { assigneeId: targetUserId }, data: { assigneeId: null } }),
    prisma.user.delete({ where: { id: targetUserId } }),
  ]);
}
