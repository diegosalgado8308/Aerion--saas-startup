import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import Toast from "@/components/Toast";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const hasError = params?.error === "1";

  async function handleLogin(formData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw err;
    }
  }

  return (
    <div className="auth-shell">
      <Image src="/logo-icon.png" alt="Aerion Software" width={112} height={112} className="auth-logo" priority />
      <h1>Welcome back</h1>
      <p className="text-muted" style={{ marginTop: 6, marginBottom: 24 }}>Log in to your workspace.</p>

      <Toast key={hasError ? crypto.randomUUID() : "no-error"} message={hasError ? "Invalid email or password." : null} type="error" />

      <form action={handleLogin}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" required />
        </div>
        <button type="submit" className="btn btn-primary btn-block">Log in</button>
      </form>

      <p className="form-note">Don&apos;t have an account? <Link href="/signup">Sign up</Link></p>
    </div>
  );
}
