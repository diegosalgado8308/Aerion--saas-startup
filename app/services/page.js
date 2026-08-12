import Link from "next/link";
import Reveal from "@/components/Reveal";
import FaqAccordion from "@/components/FaqAccordion";

export const metadata = {
  title: "Services",
  description: "Custom software development, SaaS product engineering, cloud & DevOps, UI/UX design, and technical consulting from Aerion Software.",
};

const faqItems = [
  {
    question: "How long does a typical project take?",
    answer: "Most MVPs launch in 6–12 weeks. Larger platform builds are scoped in phases so you see working software every few weeks, not just at the end.",
  },
  {
    question: "Do you work with early-stage startups?",
    answer: "Yes — a large share of our work is pre-seed to Series B teams building their first product or rebuilding a fragile prototype.",
  },
  {
    question: "What industries do you have experience in?",
    answer: "Fintech, healthtech, logistics, and B2B SaaS make up most of our portfolio, though the engineering fundamentals transfer well beyond that.",
  },
  {
    question: "Who owns the code once we're done?",
    answer: "You do, entirely. Full source, infrastructure access, and documentation are handed over at the end of every engagement.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Services</div>
          <h1>Software expertise, applied end to end</h1>
          <p className="lede mt-24">From a whiteboard sketch to a production system serving millions of requests — pick a single service or lean on us for the whole build.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-3">
            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              </div>
              <h3>Custom Software Development</h3>
              <p>Purpose-built internal tools and platforms designed around your actual workflows, not a generic template.</p>
              <ul>
                <li>Requirements &amp; systems design</li>
                <li>Web &amp; desktop applications</li>
                <li>Legacy system modernization</li>
                <li>API &amp; integrations layer</li>
              </ul>
            </Reveal>

            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
              </div>
              <h3>SaaS Product Engineering</h3>
              <p>End-to-end product builds for founders and product teams — from MVP to a scale-ready platform.</p>
              <ul>
                <li>Multi-tenant architecture</li>
                <li>Billing &amp; subscription systems</li>
                <li>Onboarding &amp; activation flows</li>
                <li>Analytics &amp; growth instrumentation</li>
              </ul>
            </Reveal>

            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <h3>Cloud &amp; DevOps</h3>
              <p>Infrastructure that scales with you and doesn&apos;t page you at 3am.</p>
              <ul>
                <li>AWS / GCP / Azure architecture</li>
                <li>CI/CD pipeline design</li>
                <li>Observability &amp; incident response</li>
                <li>Cost optimization audits</li>
              </ul>
            </Reveal>

            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
              </div>
              <h3>UI/UX &amp; Product Design</h3>
              <p>Interfaces that make complex software feel obvious to use.</p>
              <ul>
                <li>Product strategy &amp; discovery</li>
                <li>Wireframes &amp; prototyping</li>
                <li>Design systems</li>
                <li>Usability testing</li>
              </ul>
            </Reveal>

            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.4.3.6.8.6 1.3H15.4c0-.5.2-1 .6-1.3A7 7 0 0 0 12 2Z" /></svg>
              </div>
              <h3>Technical Consulting</h3>
              <p>An outside perspective for teams weighing hard architecture or build-vs-buy decisions.</p>
              <ul>
                <li>Technical due diligence</li>
                <li>Architecture reviews</li>
                <li>Team &amp; process audits</li>
                <li>CTO advisory</li>
              </ul>
            </Reveal>

            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12a10 10 0 1 1-4.4-8.3" /><path d="M22 4v6h-6" /></svg>
              </div>
              <h3>Maintenance &amp; Support</h3>
              <p>Keep shipping after launch — bug fixes, upgrades, and roadmap execution on retainer.</p>
              <ul>
                <li>Ongoing feature development</li>
                <li>SLA-backed bug response</li>
                <li>Dependency &amp; security upgrades</li>
                <li>Monthly roadmap planning</li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <Reveal className="section-head">
            <div className="eyebrow">Engagement models</div>
            <h2>Work with us the way that fits</h2>
            <p className="lede mt-16">Every engagement starts with a scoped discovery call — from there, pick the model that matches how you need to move.</p>
          </Reveal>
          <div className="grid grid-3">
            <Reveal className="card plan-card">
              <h3>Project</h3>
              <div className="plan-price">Fixed scope<span> / defined timeline</span></div>
              <p>A well-defined build with clear deliverables — ideal for an MVP or a discrete feature.</p>
              <ul>
                <li>Fixed price &amp; timeline</li>
                <li>Dedicated project team</li>
                <li>Weekly demos</li>
              </ul>
              <Link href="/contact" className="btn btn-secondary btn-block">Discuss a project</Link>
            </Reveal>
            <Reveal className="card plan-card featured">
              <span className="plan-badge">Most popular</span>
              <h3>Embedded Team</h3>
              <div className="plan-price">Monthly<span> / cancel anytime</span></div>
              <p>A cross-functional pod that plugs into your roadmap and ships continuously.</p>
              <ul>
                <li>Dedicated pod (eng + design)</li>
                <li>Sprint planning with your team</li>
                <li>Scale up or down monthly</li>
              </ul>
              <Link href="/contact" className="btn btn-primary btn-block">Build with us</Link>
            </Reveal>
            <Reveal className="card plan-card">
              <h3>Advisory</h3>
              <div className="plan-price">Retainer<span> / hours-based</span></div>
              <p>Senior technical guidance without a full build — architecture, hiring, or roadmap help.</p>
              <ul>
                <li>Fractional CTO support</li>
                <li>Architecture &amp; code reviews</li>
                <li>Flexible monthly hours</li>
              </ul>
              <Link href="/contact" className="btn btn-secondary btn-block">Book advisory time</Link>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <Reveal className="section-head">
            <div className="eyebrow">FAQ</div>
            <h2>Common questions</h2>
          </Reveal>
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-band">
            <h2>Not sure which service fits?</h2>
            <p>Tell us about your project and we&apos;ll recommend the right starting point.</p>
            <div className="cta-actions">
              <Link href="/contact" className="btn btn-primary">Talk to us</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
