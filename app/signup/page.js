import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { createWorkspaceAndOwner, joinWorkspaceViaInvite, ValidationError } from "@/lib/workspace";

export const metadata = { title: "Sign up" };

async function signInOrRedirect(email, password) {
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw err;
  }
}

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  const mode = params?.mode === "join" ? "join" : "create";
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;

  async function handleCreate(formData) {
    "use server";
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      await createWorkspaceAndOwner({
        name: formData.get("name"),
        email,
        password,
        workspaceName: formData.get("workspaceName"),
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/signup?mode=create&error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }

    await signInOrRedirect(email, password);
  }

  async function handleJoin(formData) {
    "use server";
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      await joinWorkspaceViaInvite({
        name: formData.get("name"),
        email,
        password,
        inviteCode: formData.get("inviteCode"),
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/signup?mode=join&error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }

    await signInOrRedirect(email, password);
  }

  return (
    <div className="auth-shell">
      <h1>Create your account</h1>
      <p className="text-muted" style={{ marginTop: 6, marginBottom: 24 }}>
        {mode === "join" ? "Join an existing workspace with an invite code." : "Start a new workspace."}
      </p>

      {errorMessage && <div className="notice notice-error">{errorMessage}</div>}

      {mode === "create" ? (
        <form action={handleCreate}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input type="text" id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="workspaceName">Workspace name</label>
            <input type="text" id="workspaceName" name="workspaceName" placeholder="Your company or team name" required />
          </div>
          <button type="submit" className="btn btn-primary btn-block">Create workspace</button>
        </form>
      ) : (
        <form action={handleJoin}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input type="text" id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="inviteCode">Invite code</label>
            <input type="text" id="inviteCode" name="inviteCode" placeholder="Paste the code from your teammate" required />
          </div>
          <button type="submit" className="btn btn-primary btn-block">Join workspace</button>
        </form>
      )}

      <p className="form-note">
        {mode === "join" ? (
          <>Starting fresh? <Link href="/signup?mode=create">Create a new workspace</Link></>
        ) : (
          <>Have an invite code? <Link href="/signup?mode=join">Join a workspace</Link></>
        )}
      </p>
      <p className="form-note">Already have an account? <Link href="/login">Log in</Link></p>
    </div>
  );
}
