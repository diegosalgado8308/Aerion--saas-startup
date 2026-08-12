import Link from "next/link";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "About",
  description: "Aerion Software is a software design and engineering studio. Meet the team and the values behind how we build.",
};

export default function AboutPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">About us</div>
          <h1>A small studio built for hard software problems</h1>
          <p className="lede mt-24">Aerion Software was founded to close the gap between product vision and production-grade engineering — we&apos;re the team you bring in when it has to actually work.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-2" style={{ alignItems: "center", gap: 64 }}>
            <Reveal>
              <div className="eyebrow">Our story</div>
              <h2>Founded by engineers who got tired of watching good ideas ship late</h2>
            </Reveal>
            <Reveal>
              <p className="lede">
                Aerion started in 2017 as a two-person team frustrated by how often great products
                were slowed down by the wrong process, not the wrong idea. Nearly a decade later,
                we&apos;re a team of 40+ designers and engineers, but the founding principle hasn&apos;t
                changed: ship working software, fast, and stay honest about trade-offs along the way.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <Reveal className="section-head">
            <div className="eyebrow">What we believe</div>
            <h2>Principles that shape how we build</h2>
          </Reveal>
          <div className="grid grid-2">
            <Reveal className="value-item">
              <span className="num">01</span>
              <div>
                <h4>Working software over polished decks</h4>
                <p>We&apos;d rather show you something running in week one than a roadmap slide.</p>
              </div>
            </Reveal>
            <Reveal className="value-item">
              <span className="num">02</span>
              <div>
                <h4>Honest about trade-offs</h4>
                <p>Every architecture choice has a cost. We tell you what it is before you pay it.</p>
              </div>
            </Reveal>
            <Reveal className="value-item">
              <span className="num">03</span>
              <div>
                <h4>Senior engineers, not a bench</h4>
                <p>The people scoping your project are the people building it.</p>
              </div>
            </Reveal>
            <Reveal className="value-item">
              <span className="num">04</span>
              <div>
                <h4>You own everything we build</h4>
                <p>Full source and infrastructure access, always — no vendor lock-in by design.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div className="eyebrow">Leadership</div>
            <h2>The people behind the work</h2>
          </Reveal>
          <div className="grid grid-4">
            <Reveal className="card team-card">
              <div className="avatar">MR</div>
              <h3>Mara Reyes</h3>
              <div className="team-role">Co-founder &amp; CEO</div>
              <p>Formerly led product engineering at a Series C fintech before starting Aerion.</p>
            </Reveal>
            <Reveal className="card team-card">
              <div className="avatar">DK</div>
              <h3>Daniel Kim</h3>
              <div className="team-role">Co-founder &amp; CTO</div>
              <p>Spent a decade building distributed systems before turning to consulting.</p>
            </Reveal>
            <Reveal className="card team-card">
              <div className="avatar">SP</div>
              <h3>Sofia Patel</h3>
              <div className="team-role">Head of Design</div>
              <p>Leads product and design strategy across every Aerion engagement.</p>
            </Reveal>
            <Reveal className="card team-card">
              <div className="avatar">JT</div>
              <h3>Jonah Traut</h3>
              <div className="team-role">Head of Engineering</div>
              <p>Oversees delivery quality and technical architecture across all projects.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-band">
            <h2>Want to work with us?</h2>
            <p>We&apos;re always glad to talk shop, even before there&apos;s a project on the table.</p>
            <div className="cta-actions">
              <Link href="/contact" className="btn btn-primary">Get in touch</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
