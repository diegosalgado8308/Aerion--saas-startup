import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/passwordReset";
import { ValidationError } from "@/lib/workspace";
import Toast from "@/components/Toast";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({ searchParams }) {
  const params = await searchParams;
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;
  const sent = params?.sent === "1";

  async function handleForgotPassword(formData) {
    "use server";
    try {
      await requestPasswordReset(formData.get("email"));
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/forgot-password?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="auth-shell">
      <Image src="/logo-icon.png" alt="Aerion Software" width={112} height={112} className="auth-logo" priority />
      <h1>Reset your password</h1>

      {sent ? (
        <>
          <p className="text-muted" style={{ marginTop: 6, marginBottom: 24 }}>
            If an account exists for that email, we&apos;ve sent a link to reset your password.
            It expires in 1 hour.
          </p>
          <p className="form-note"><Link href="/login">Back to log in</Link></p>
        </>
      ) : (
        <>
          <p className="text-muted" style={{ marginTop: 6, marginBottom: 24 }}>
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>

          <Toast key={errorMessage ? crypto.randomUUID() : "no-error"} message={errorMessage} type="error" />

          <form action={handleForgotPassword}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" required />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Send reset link</button>
          </form>

          <p className="form-note">Remembered it? <Link href="/login">Log in</Link></p>
        </>
      )}
    </div>
  );
}
