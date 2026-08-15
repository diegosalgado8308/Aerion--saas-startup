import Link from "next/link";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="container app-footer-inner">
        <span className="text-faint">&copy; {new Date().getFullYear()} Aerion Software</span>
        <nav className="app-footer-nav">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </div>
    </footer>
  );
}
