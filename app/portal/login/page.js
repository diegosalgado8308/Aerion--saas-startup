import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export const metadata = {
  title: "Client Login",
  description: "Sign in to the Aerion Software client portal.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const hasError = params?.error === "1";

  async function handleLogin(formData) {
    "use server";
    try {
      await signIn("client-login", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/portal/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const { redirect } = await import("next/navigation");
        redirect("/portal/login?error=1");
      }
      throw err;
    }
  }

  return (
    <section className="portal-hero">
      <div className="container">
        <div className="text-center">
          <div className="eyebrow" style={{ justifyContent: "center" }}>Client Portal</div>
          <h1>Welcome back</h1>
          <p className="lede mx-auto mt-16" style={{ textAlign: "center" }}>
            Sign in to check project status, invoices, and files.
          </p>
        </div>

        <div className="login-shell">
          <div className="login-card">
            {hasError && (
              <div className="login-error">Invalid email or password. Please try again.</div>
            )}
            <form action={handleLogin}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input type="email" id="email" name="email" placeholder="you@company.com" required />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Sign in</button>
            </form>

            {process.env.NODE_ENV !== "production" && (
              <div className="login-hint">
                Demo account — <code>demo@aerionsoftware.com</code> / <code>AerionDemo!23</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
