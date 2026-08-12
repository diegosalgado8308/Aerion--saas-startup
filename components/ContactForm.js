"use client";

import { useState } from "react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    e.target.reset();
    setSubmitted(true);
  }

  return (
    <div className="form-card">
      <div className={`form-success${submitted ? " visible" : ""}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        Thanks — your message has been sent. We&apos;ll be in touch shortly.
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input type="text" id="name" name="name" placeholder="Jordan Lee" required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" placeholder="jordan@company.com" required />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="company">Company</label>
            <input type="text" id="company" name="company" placeholder="Company name" />
          </div>
          <div className="field">
            <label htmlFor="budget">Estimated budget</label>
            <select id="budget" name="budget" defaultValue="">
              <option value="">Select a range</option>
              <option>Under $25k</option>
              <option>$25k – $75k</option>
              <option>$75k – $150k</option>
              <option>$150k+</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="message">Tell us about your project</label>
          <textarea id="message" name="message" placeholder="What are you building, and what's the timeline?" required />
        </div>
        <button type="submit" className="btn btn-primary btn-block">Send message</button>
        <p className="form-note">This form is a front-end demo — connect it to a backend or a form service (e.g. Formspree) before going live.</p>
      </form>
    </div>
  );
}
