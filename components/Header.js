import Link from "next/link";
import Image from "next/image";
import SignOutButton from "@/components/SignOutButton";
import MobileNavToggle from "@/components/MobileNavToggle";

export default function Header({ session }) {
  const initials = session?.user?.name
    ?.split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="app-header">
      <div className="container">
        <Link href={session ? "/dashboard" : "/"} className="brand">
          <Image src="/logo-icon.png" alt="" width={44} height={44} className="brand-mark" priority />
          Aerion Software
        </Link>

        {session && (
          <nav className="header-nav">
            <Link href="/dashboard">Projects</Link>
            <Link href="/team">Team</Link>
            <Link href="/billing">Billing</Link>
          </nav>
        )}

        <div className={`header-actions${session ? " header-actions--authed" : ""}`}>
          {session ? (
            <>
              <div className="user-chip">
                <span className="avatar-sm">{initials}</span>
                {session.user.name}
              </div>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary btn-sm">Log in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>

        {session && <MobileNavToggle userName={session.user.name} signOutSlot={<SignOutButton />} />}
      </div>
    </header>
  );
}
