import { prisma } from "@/lib/prisma";
import { createWorkspaceAndOwner } from "@/lib/workspace";

let counter = 0;

export function uniqueEmail(label) {
  counter += 1;
  return `test-${label}-${Date.now()}-${counter}@example.test`;
}

/** Creates a fresh workspace + OWNER user for use as an isolated tenant in a test. */
export async function makeTenant(label) {
  const { workspace, user } = await createWorkspaceAndOwner({
    name: `${label} Owner`,
    email: uniqueEmail(label),
    password: "correct-horse-battery",
    workspaceName: `${label} Workspace ${Date.now()}`,
  });
  return { workspace, user };
}

/** Deletes a workspace and everything cascading from it (users, projects, tasks). */
export async function cleanupWorkspace(workspaceId) {
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}
