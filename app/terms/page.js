export const metadata = { title: "Terms of Service" };

const LAST_UPDATED = "August 15, 2026";

export default function TermsPage() {
  return (
    <div className="container page legal">
      <div className="page-head">
        <div>
          <h1>Terms of Service</h1>
          <p className="text-muted">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of Aerion Software (&quot;Aerion,&quot;
        &quot;we,&quot; &quot;us&quot;), the project- and task-management application at
        aerion-software.vercel.app. By creating an account or otherwise using Aerion, you agree to these
        Terms. If you&apos;re using Aerion on behalf of an organization, you&apos;re agreeing on its behalf
        and confirming you have the authority to do so.
      </p>

      <h2>1. The service</h2>
      <p>Aerion provides workspace-based project and task management (projects, tasks, comments, file
        attachments, due-date reminders) and an economy-simulation diagramming tool. The service is
        provided on an &quot;as is&quot; and &quot;as available&quot; basis, and we may add, change, or
        remove features at any time.</p>

      <h2>2. Accounts and workspaces</h2>
      <ul>
        <li>You must provide accurate information when creating an account and are responsible for keeping
          your login credentials confidential.</li>
        <li>You&apos;re responsible for activity that happens under your account, including anything done
          by teammates you invite into your workspace.</li>
        <li>Workspace owners are responsible for managing who has access to their workspace and its
          content.</li>
        <li>Repeated failed login attempts will temporarily lock an account as a security measure.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for anything unlawful, or to store or transmit content you don&apos;t have the
          right to share.</li>
        <li>Attempt to gain unauthorized access to another workspace, account, or the systems running
          Aerion.</li>
        <li>Interfere with or disrupt the service, or attempt to bypass rate limits or security controls
          (including the account lockout mechanism).</li>
        <li>Upload malware or content that infringes someone else&apos;s intellectual property or privacy
          rights.</li>
      </ul>
      <p>We may suspend or terminate accounts that violate this section.</p>

      <h2>4. Your content</h2>
      <p>You retain ownership of everything you and your team create in Aerion — project data, tasks,
        comments, file attachments, and diagrams (&quot;Your Content&quot;). By using the service, you grant
        us a limited license to host, store, and display Your Content solely as needed to operate and
        provide the service to you. We don&apos;t claim ownership of Your Content and don&apos;t use it for
        purposes beyond operating the product, as described in our <a href="/privacy">Privacy Policy</a>.</p>
      <p>You&apos;re responsible for Your Content and for having the rights necessary to store and share
        it through Aerion.</p>

      <h2>5. Fees</h2>
      <p>Aerion is currently offered free of charge, with no paid plans. If we introduce paid plans or
        usage limits in the future, we&apos;ll provide reasonable advance notice before any change affects
        an existing workspace, and continued use after that notice constitutes acceptance of the new
        terms.</p>

      <h2>6. Termination</h2>
      <p>You may stop using Aerion at any time. We may suspend or terminate access to the service for
        violation of these Terms, for extended inactivity, or if we discontinue the service, with notice
        where reasonably possible. Sections that by their nature should survive termination (e.g.,
        disclaimers, limitation of liability) will continue to apply.</p>

      <h2>7. Disclaimers</h2>
      <p>Aerion is provided &quot;as is,&quot; without warranties of any kind, express or implied, including
        implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We
        don&apos;t guarantee the service will be uninterrupted, error-free, or fully secure.</p>

      <h2>8. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, Aerion and its operators won&apos;t be liable for any
        indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or
        revenue, arising from your use of the service. Our total liability for any claim relating to the
        service is limited to the amount you paid us in the twelve months before the claim arose (which,
        for a free-tier account, is zero).</p>

      <h2>9. Changes to these terms</h2>
      <p>We may update these Terms from time to time. If we make material changes, we&apos;ll update the
        &quot;Last updated&quot; date above and, where appropriate, notify workspace owners directly.
        Continued use of Aerion after changes take effect means you accept the updated Terms.</p>

      <h2>10. Governing law</h2>
      <p>These Terms are governed by the laws of [Governing law / jurisdiction to be confirmed], without
        regard to conflict-of-law principles.</p>

      <h2>11. Contact</h2>
      <p>Questions about these Terms: <a href="mailto:diegosalgado8308@gmail.com">diegosalgado8308@gmail.com</a>.</p>
    </div>
  );
}
