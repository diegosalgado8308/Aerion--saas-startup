import Link from "next/link";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "Work",
  description: "Case studies from Aerion Software's product and engineering work with fintech, healthtech, and B2B SaaS companies.",
};

const caseStudies = [
  {
    tag: "NimbusPay",
    tags: ["Fintech", "SaaS"],
    title: "Rebuilding payouts infrastructure for scale",
    body: "NimbusPay's payout engine was buckling under growth. We re-architected the core ledger and queuing system to handle 10x transaction volume with zero downtime during the migration.",
    metrics: [
      ["10x", "Throughput"],
      ["99.99%", "Uptime"],
      ["6 wks", "To launch"],
    ],
  },
  {
    tag: "Fieldwork",
    tags: ["Logistics", "Mobile"],
    title: "A field-ops platform built for offline-first use",
    body: "Fieldwork needed a mobile app that worked reliably with no signal in rural service areas. We built an offline-first sync engine and a dispatcher dashboard from scratch in 10 weeks.",
    metrics: [
      ["3,000+", "Daily field users"],
      ["40%", "Faster dispatch"],
      ["10 wks", "To launch"],
    ],
  },
  {
    tag: "Cobalt Health",
    tags: ["Healthtech", "Compliance"],
    title: "HIPAA-ready patient portal, from MVP to launch",
    body: "We designed and built Cobalt Health's patient portal end-to-end — scheduling, secure messaging, and records access — with compliance built in from day one rather than bolted on.",
    metrics: [
      ["50k+", "Patients onboarded"],
      ["100%", "HIPAA compliant"],
      ["12 wks", "MVP to launch"],
    ],
  },
  {
    tag: "Vantra",
    tags: ["B2B SaaS", "Analytics"],
    title: "Turning a spreadsheet workflow into a real product",
    body: "Vantra's team was running operations out of a tangle of spreadsheets. We shipped a multi-tenant analytics platform that replaced it, complete with role-based access and billing.",
    metrics: [
      ["$1.2M", "ARR in year one"],
      ["25+", "Enterprise customers"],
      ["14 wks", "To launch"],
    ],
  },
];

export default function WorkPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Our work</div>
          <h1>Products we&apos;ve helped build</h1>
          <p className="lede mt-24">A selection of engagements across fintech, healthtech, and B2B SaaS — from zero-to-one builds to large-scale rebuilds.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {caseStudies.map((study) => (
            <Reveal key={study.title} className="case-card">
              <div className="case-media"><span className="tag-badge">{study.tag}</span></div>
              <div className="case-body">
                <div className="case-tags">
                  {study.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <h3>{study.title}</h3>
                <p>{study.body}</p>
                <div className="case-metrics">
                  {study.metrics.map(([num, label]) => (
                    <div key={label}>
                      <div className="m-num">{num}</div>
                      <div className="m-label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-band">
            <h2>Want results like these?</h2>
            <p>Tell us about your product and we&apos;ll walk through how we&apos;d approach it.</p>
            <div className="cta-actions">
              <Link href="/contact" className="btn btn-primary">Start a project</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
