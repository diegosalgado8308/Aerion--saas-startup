import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export const metadata = {
  title: "Admin Login",
  description: "Sign in to the Aerion Software admin panel.",
};

export default async function AdminLoginPage({ searchParams }) {
  const params = await searchParams;
  const hasError = params?.error === "1";

  async function handleLogin(formData) {
    "use server";
    try {
      await signIn("admin-login", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/admin",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const { redirect } = await import("next/navigation");
        redirect("/admin/login?error=1");
      }
      throw err;
    }
  }

  return (
    <section className="portal-hero">
      <div className="container">
        <div className="text-center">
          <div className="eyebrow" style={{ justifyContent: "center" }}>Staff Only</div>
          <h1>Admin access</h1>
          <p className="lede mx-auto mt-16" style={{ textAlign: "center" }}>
            Sign in to manage clients, projects, and invoices.
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
                <input type="email" id="email" name="email" placeholder="you@aerionsoftware.com" required />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Sign in</button>
            </form>

            {process.env.NODE_ENV !== "production" && (
              <div className="login-hint">
                Demo account — <code>admin@aerionsoftware.com</code> / <code>AerionAdmin!23</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
