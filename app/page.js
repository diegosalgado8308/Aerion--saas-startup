import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <section className="landing-hero">
      <div className="container">
        <h1>Projects and tasks, without the overhead.</h1>
        <p>
          Aerion Software is a small, focused project tracker for small teams — projects,
          tasks, priorities, and due dates, nothing you don&apos;t need.
        </p>
        <div className="landing-actions">
          <Link href="/signup" className="btn btn-primary">Get started</Link>
          <Link href="/login" className="btn btn-secondary">Log in</Link>
        </div>
      </div>
    </section>
  );
}
