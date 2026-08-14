import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export class ValidationError extends Error {}

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
