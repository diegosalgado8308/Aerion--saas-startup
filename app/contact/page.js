import Reveal from "@/components/Reveal";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contact",
  description: "Get in touch with Aerion Software to discuss your next custom software or SaaS product build.",
};

export default function ContactPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Contact</div>
          <h1>Let&apos;s talk about what you&apos;re building</h1>
          <p className="lede mt-24">Tell us a bit about your project and we&apos;ll get back to you within one business day.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-layout">
            <Reveal>
              <h2 className="mb-24">Get in touch</h2>
              <div className="contact-info-item">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>
                </div>
                <div>
                  <h4>Email</h4>
                  <a href="mailto:hello@aerionsoftware.com">hello@aerionsoftware.com</a>
                </div>
              </div>
              <div className="contact-info-item">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z" /></svg>
                </div>
                <div>
                  <h4>Phone</h4>
                  <a href="tel:+15555550123">+1 (555) 555-0123</a>
                </div>
              </div>
              <div className="contact-info-item">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
                <div>
                  <h4>Studio</h4>
                  <p>201 Harbor View Ave, Suite 400<br />Austin, TX 78701</p>
                </div>
              </div>
              <div className="contact-info-item">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div>
                  <h4>Response time</h4>
                  <p>We reply to every inquiry within one business day.</p>
                </div>
              </div>

              <div className="map-note">
                Map embed placeholder — drop in a Google/Mapbox embed here once the studio address is finalized.
              </div>
            </Reveal>

            <Reveal>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
