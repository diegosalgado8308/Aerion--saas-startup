import bcrypt from "bcryptjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Profile",
  description: "Manage your Aerion Software client account.",
};

async function updateProfile(formData) {
  "use server";
  const session = await auth();
  if (!session) return;

  const name = formData.get("name")?.toString().trim();
  const company = formData.get("company")?.toString().trim() || null;
  if (!name) return;

  await prisma.client.update({
    where: { id: session.user.id },
    data: { name, company },
  });

  redirect("/portal/profile?saved=1");
}

async function changePassword(formData) {
  "use server";
  const session = await auth();
  if (!session) return;

  const currentPassword = formData.get("currentPassword")?.toString();
  const newPassword = formData.get("newPassword")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/portal/profile?pwerror=missing");
  }
  if (newPassword !== confirmPassword) {
    redirect("/portal/profile?pwerror=mismatch");
  }
  if (newPassword.length < 8) {
    redirect("/portal/profile?pwerror=short");
  }

  const client = await prisma.client.findUnique({ where: { id: session.user.id } });
  const valid = await bcrypt.compare(currentPassword, client.password);
  if (!valid) {
    redirect("/portal/profile?pwerror=wrong");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.client.update({
    where: { id: session.user.id },
    data: { password: hashed },
  });

  redirect("/portal/profile?pwsaved=1");
}

const PW_ERRORS = {
  missing: "Please fill in all password fields.",
  mismatch: "New password and confirmation don't match.",
  short: "New password must be at least 8 characters.",
  wrong: "Current password is incorrect.",
};

export default async function ProfilePage({ searchParams }) {
  const session = await auth();
  const params = await searchParams;

  const client = await prisma.client.findUnique({ where: { id: session.user.id } });

  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="mb-24">
          <Link href="/portal/dashboard" style={{ color: "var(--text-faint)", fontSize: "0.85rem" }}>&larr; Back to dashboard</Link>
          <div className="eyebrow mt-16">Client Portal</div>
          <h1>Your profile</h1>
        </div>

        {params?.saved === "1" && <div className="notice notice-success">Profile updated.</div>}
        {params?.pwsaved === "1" && <div className="notice notice-success">Password changed.</div>}
        {params?.pwerror && <div className="notice notice-error">{PW_ERRORS[params.pwerror] || "Something went wrong."}</div>}

        <div className="form-card mb-24">
          <h3 className="mb-16">Account details</h3>
          <form action={updateProfile}>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input type="text" id="name" name="name" defaultValue={client.name} required />
            </div>
            <div className="field">
              <label htmlFor="company">Company</label>
              <input type="text" id="company" name="company" defaultValue={client.company || ""} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" defaultValue={client.email} disabled />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Save changes</button>
          </form>
        </div>

        <div className="form-card">
          <h3 className="mb-16">Change password</h3>
          <form action={changePassword}>
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <input type="password" id="currentPassword" name="currentPassword" required />
            </div>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input type="password" id="newPassword" name="newPassword" minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" minLength={8} required />
            </div>
            <button type="submit" className="btn btn-secondary btn-block">Change password</button>
          </form>
        </div>
      </div>
    </section>
  );
}
