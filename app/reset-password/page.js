import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { resetPassword } from "@/lib/passwordReset";
import { ValidationError } from "@/lib/workspace";
import Toast from "@/components/Toast";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = (params?.token || "").toString();
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;

  async function handleResetPassword(formData) {
    "use server";
    const submittedToken = formData.get("token");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    try {
      if (password !== confirmPassword) {
        throw new ValidationError("Passwords don't match.");
      }
      await resetPassword(submittedToken, password);
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/reset-password?token=${encodeURIComponent(submittedToken)}&error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
    redirect("/login?reset=1");
  }

  return (
    <div className="auth-shell">
      <Image src="/logo-icon.png" alt="Aerion Software" width={112} height={112} className="auth-logo" priority />
      <h1>Choose a new password</h1>

      {!token ? (
        <>
          <p className="text-muted" style={{ marginTop: 6, marginBottom: 24 }}>
            This link is missing its reset token. Request a new one below.
          </p>
          <p className="form-note"><Link href="/forgot-password">Request a new reset link</Link></p>
        </>
      ) : (
        <>
          <Toast key={errorMessage ? crypto.randomUUID() : "no-error"} message={errorMessage} type="error" />

          <form action={handleResetPassword}>
            <input type="hidden" name="token" value={token} />
            <div className="field">
              <label htmlFor="password">New password</label>
              <input type="password" id="password" name="password" minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" minLength={8} required />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Reset password</button>
          </form>

          <p className="form-note"><Link href="/login">Back to log in</Link></p>
        </>
      )}
    </div>
  );
}
