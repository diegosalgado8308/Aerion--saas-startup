import Link from "next/link";
import Reveal from "@/components/Reveal";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="eyebrow">Software design &amp; engineering studio</div>
            <h1>We build software that <span className="gradient-text">carries momentum.</span></h1>
            <p className="lede mt-24">
              Aerion Software partners with startups and growing companies to design, build, and scale
              custom applications and SaaS products — from first prototype to production at scale.
            </p>
            <div className="hero-actions">
              <Link href="/contact" className="btn btn-primary">Start a project</Link>
              <Link href="/work" className="btn btn-secondary">See our work</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        <Reveal className="stats-row" style={{ display: "grid" }}>
          <div className="stat">
            <div className="num">120+</div>
            <div className="label">Products shipped</div>
          </div>
          <div className="stat">
            <div className="num">98%</div>
            <div className="label">Client retention</div>
          </div>
          <div className="stat">
            <div className="num">40+</div>
            <div className="label">Engineers &amp; designers</div>
          </div>
          <div className="stat">
            <div className="num">9 yrs</div>
            <div className="label">Building software</div>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div className="eyebrow">What we do</div>
            <h2>End-to-end software delivery</h2>
            <p className="lede mt-16">From a rough idea to a fully operational product — we cover the whole lifecycle so you don&apos;t have to stitch together vendors.</p>
          </Reveal>
          <div className="grid grid-3">
            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              </div>
              <h3>Custom Software</h3>
              <p>Bespoke internal tools and platforms built around how your team actually works.</p>
            </Reveal>
            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
              </div>
              <h3>SaaS Product Engineering</h3>
              <p>We design and ship multi-tenant products, from MVP through to scale-ready architecture.</p>
            </Reveal>
            <Reveal className="card">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <h3>Cloud &amp; DevOps</h3>
              <p>Resilient, cost-aware infrastructure with CI/CD pipelines that keep releases boring.</p>
            </Reveal>
          </div>
          <div className="text-center mt-32">
            <Link href="/services" className="btn btn-secondary">View all services</Link>
          </div>
        </div>
      </section>

      <section className="section-tight section-alt">
        <div className="container">
          <p className="text-center mb-24" style={{ color: "var(--text-faint)", fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Trusted by teams building the next generation of software
          </p>
          <div className="logo-strip">
            <span>NimbusPay</span>
            <span>Fieldwork</span>
            <span>Vantra</span>
            <span>Hearth Labs</span>
            <span>Cobalt Health</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div className="eyebrow">How we work</div>
            <h2>A process built for momentum, not meetings</h2>
          </Reveal>
          <div className="steps">
            <Reveal className="step">
              <span className="step-num">01</span>
              <h4>Discover</h4>
              <p>We map the problem, the users, and the constraints before writing a line of code.</p>
            </Reveal>
            <Reveal className="step">
              <span className="step-num">02</span>
              <h4>Design</h4>
              <p>Product and engineering design in tandem, so what we design is what we can build.</p>
            </Reveal>
            <Reveal className="step">
              <span className="step-num">03</span>
              <h4>Build</h4>
              <p>Short, shippable cycles with a working product in your hands from week one.</p>
            </Reveal>
            <Reveal className="step">
              <span className="step-num">04</span>
              <h4>Scale</h4>
              <p>We stay on to harden, monitor, and evolve the system as real usage arrives.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <Reveal className="section-head">
            <div className="eyebrow">Featured work</div>
            <h2>Recent product launches</h2>
          </Reveal>
          <Reveal className="case-card" style={{ display: "grid" }}>
            <div className="case-media"><span className="tag-badge">NimbusPay</span></div>
            <div className="case-body">
              <div className="case-tags">
                <span className="tag">Fintech</span>
                <span className="tag">SaaS</span>
              </div>
              <h3>Rebuilding payouts infrastructure for scale</h3>
              <p>We re-architected NimbusPay&apos;s payout engine to handle 10x transaction volume without downtime.</p>
              <div className="case-metrics">
                <div><div className="m-num">10x</div><div className="m-label">Throughput</div></div>
                <div><div className="m-num">99.99%</div><div className="m-label">Uptime</div></div>
                <div><div className="m-num">6 wks</div><div className="m-label">To launch</div></div>
              </div>
            </div>
          </Reveal>
          <div className="text-center mt-24">
            <Link href="/work" className="btn btn-secondary">View all case studies</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-band">
            <h2>Have a product in mind?</h2>
            <p>Tell us where you&apos;re headed. We&apos;ll tell you what it takes to get there.</p>
            <div className="cta-actions">
              <Link href="/contact" className="btn btn-primary">Start a project</Link>
              <Link href="/services" className="btn btn-secondary">Explore services</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
