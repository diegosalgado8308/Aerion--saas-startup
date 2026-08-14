import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMembers, removeMember, buildInviteUrl, ValidationError } from "@/lib/workspace";
import { sendInviteEmail } from "@/lib/email";
import Toast from "@/components/Toast";

export const metadata = { title: "Team" };

export default async function TeamPage({ searchParams }) {
  const session = await auth();
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(sp.error) : null;
  const sentEmail = sp?.sent ? decodeURIComponent(sp.sent) : null;

  const workspace = await prisma.workspace.findUnique({ where: { id: session.user.workspaceId } });
  const members = await getWorkspaceMembers(session.user.workspaceId);
  const isOwner = session.user.role === "OWNER";

  const inviteUrl = `/signup?mode=join`;

  async function handleRemove(formData) {
    "use server";
    const session = await auth();
    try {
      await removeMember({
        workspaceId: session.user.workspaceId,
        actingUserId: session.user.id,
        targetUserId: formData.get("userId"),
      });
      revalidatePath("/team");
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/team?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  }

  async function handleInviteByEmail(formData) {
    "use server";
    const session = await auth();
    const email = (formData.get("email") || "").toString().trim();

    if (session.user.role !== "OWNER") {
      redirect(`/team?error=${encodeURIComponent("Only the workspace owner can send invites.")}`);
    }
    if (!email) {
      redirect(`/team?error=${encodeURIComponent("Email is required.")}`);
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: session.user.workspaceId } });

    let failed = false;
    try {
      await sendInviteEmail({
        to: email,
        inviterName: session.user.name,
        workspaceName: workspace.name,
        inviteUrl: buildInviteUrl(workspace),
      });
    } catch {
      failed = true;
    }

    if (failed) {
      redirect(`/team?error=${encodeURIComponent("Couldn't send the invite email — check RESEND_API_KEY is set.")}`);
    }
    redirect(`/team?sent=${encodeURIComponent(email)}`);
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p className="text-muted">{workspace.name}</p>
        </div>
      </div>

      <Toast key={errorMessage ? crypto.randomUUID() : "no-error"} message={errorMessage} type="error" />
      <Toast key={sentEmail ? crypto.randomUUID() : "no-sent"} message={sentEmail ? `Invite sent to ${sentEmail}.` : null} type="success" />

      {isOwner && (
        <div className="card" style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Invite teammates</h3>
          <p className="text-muted" style={{ marginBottom: 12, fontSize: "0.88rem" }}>
            Share this invite code — anyone who signs up with it joins {workspace.name} as a member.
          </p>
          <div className="invite-box">
            <code>{workspace.inviteCode}</code>
          </div>
          <p className="form-note" style={{ textAlign: "left", marginTop: 10 }}>
            They&apos;ll enter it at <strong>{inviteUrl}</strong> during sign up.
          </p>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <h4 style={{ marginBottom: 10, fontSize: "0.9rem" }}>Or invite by email</h4>
            <form action={handleInviteByEmail} className="inline-form">
              <div className="field">
                <label htmlFor="inviteEmail">Email</label>
                <input type="email" id="inviteEmail" name="email" placeholder="teammate@example.com" required />
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Send invite</button>
            </form>
          </div>
        </div>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              {isOwner && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td className="text-muted">{member.email}</td>
                <td><span className="role-badge">{member.role}</span></td>
                {isOwner && (
                  <td>
                    {member.id !== session.user.id && (
                      <form action={handleRemove}>
                        <input type="hidden" name="userId" value={member.id} />
                        <button type="submit" className="btn btn-danger btn-sm">Remove</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
