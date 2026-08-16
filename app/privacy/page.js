export const metadata = { title: "Privacy Policy" };

const LAST_UPDATED = "August 16, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="container page legal">
      <div className="page-head">
        <div>
          <h1>Privacy Policy</h1>
          <p className="text-muted">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      <p>
        This policy explains what information Aerion Software (&quot;Aerion,&quot; &quot;we,&quot; &quot;us&quot;)
        collects when you use the Aerion Software app, why we collect it, and the choices you have. It
        applies to the hosted product at aerion-software.vercel.app and any workspace created within it.
      </p>

      <h2>1. Information we collect</h2>
      <p><strong>Account information.</strong> When you sign up, we collect your name, email address, and
        password. Passwords are hashed with bcrypt before storage — we never store or can retrieve your
        plain-text password.</p>
      <p><strong>Workspace and content data.</strong> Everything you and your team create in the product:
        workspace and project names, tasks, priorities, due dates, comments, uploaded file attachments, and
        any economy-simulation diagrams (nodes, connections, layers) you build.</p>
      <p><strong>File attachments.</strong> Files you attach to tasks are uploaded to our storage provider
        (Vercel Blob) and referenced by URL from your task data.</p>
      <p><strong>Billing information.</strong> If a workspace subscribes to a paid plan, payment is handled
        entirely by Stripe on their own hosted Checkout and Customer Portal pages — we never see or store
        your card details. We do store the resulting Stripe customer/subscription identifiers and your
        plan/billing status.</p>
      <p><strong>Automatically collected information.</strong> We use Vercel Speed Insights to measure page
        performance (load times, Core Web Vitals), and Sentry to capture errors when something breaks
        (the error itself, the page/request it happened on, and — since you&apos;re signed in — which
        account and workspace was affected, so we can actually fix it). Neither is used for advertising or
        cross-site tracking.</p>
      <p><strong>Cookies.</strong> We set one essential session cookie (via NextAuth) used to keep you
        signed in. We don&apos;t use marketing, advertising, or third-party tracking cookies.</p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide the core product — authenticate you, load your workspace, and save your work.</li>
        <li>To send transactional email you or a teammate triggers: workspace invites and task due-date
          reminders.</li>
        <li>To keep accounts secure — e.g., tracking failed login attempts to apply temporary lockouts.</li>
        <li>To monitor and improve performance and reliability.</li>
      </ul>
      <p>We do not use your content or account data to train machine learning models, and we do not sell
        your personal information.</p>

      <h2>3. Who we share information with</h2>
      <p>We share data with the infrastructure providers that run the app, and no one else. Each acts as a
        processor on our behalf under their own security and data-processing terms:</p>
      <ul>
        <li><strong>Neon</strong> — hosts our Postgres database (all account and workspace data).</li>
        <li><strong>Vercel</strong> — hosts the application, serves file attachments via Vercel Blob, and
          provides aggregate performance telemetry via Speed Insights.</li>
        <li><strong>Resend</strong> — delivers transactional email (invites, due-date reminders).</li>
        <li><strong>Stripe</strong> — processes payments for paid plans on its own hosted pages; we never
          handle your card details directly.</li>
        <li><strong>Sentry</strong> — captures application errors so we can fix them, including which
          account/workspace was affected.</li>
      </ul>
      <p>We do not share your data with advertisers, data brokers, or analytics networks, and we do not
        sell personal information. We may disclose information if required by law or to protect the
        security of the service.</p>

      <h2>4. Data retention</h2>
      <p>We retain account and workspace data for as long as your account exists. There is currently no
        self-serve account or workspace deletion inside the product — if you&apos;d like your data deleted,
        contact us (below) and we&apos;ll process the request manually. We&apos;re working toward a
        self-serve deletion flow.</p>

      <h2>5. Your rights and choices</h2>
      <p>You can review and edit most of your data directly in the app (profile, tasks, comments,
        attachments). For anything you can&apos;t change yourself — access, correction, export, or deletion
        of your personal data — email us and we&apos;ll respond as soon as we reasonably can.</p>
      <p>If you&apos;re located in the EU/EEA, UK, or a US state with its own privacy law (e.g.
        California), you may have additional statutory rights over your personal data. We honor those
        requests on a best-effort, manual basis today rather than through automated self-serve tooling.</p>

      <h2>6. Security</h2>
      <p>Data is encrypted in transit (TLS) between your browser, our application, and our database
        provider. Passwords are hashed, never stored in plain text. Repeated failed logins temporarily lock
        an account. Access to workspace data is scoped server-side to members of that workspace. No method
        of transmission or storage is 100% secure, and we can&apos;t guarantee absolute security.</p>

      <h2>7. Children&apos;s privacy</h2>
      <p>Aerion Software is a business productivity tool and is not directed at, or knowingly used to
        collect information from, children under 13. If you believe a child has provided us personal
        information, contact us and we&apos;ll remove it.</p>

      <h2>8. Changes to this policy</h2>
      <p>If we make material changes to this policy, we&apos;ll update the &quot;Last updated&quot; date
        above and, where appropriate, notify workspace owners directly.</p>

      <h2>9. Contact</h2>
      <p>Questions about this policy or a request regarding your data: <a href="mailto:diegosalgado8308@gmail.com">diegosalgado8308@gmail.com</a>.</p>
    </div>
  );
}
