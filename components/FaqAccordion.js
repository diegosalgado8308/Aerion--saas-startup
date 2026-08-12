"use client";

import { useState } from "react";

export default function FaqAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="faq-list">
      {items.map((item, i) => (
        <div key={item.question} className={`faq-item${openIndex === i ? " open" : ""}`}>
          <button
            type="button"
            className="faq-question"
            onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
          >
            {item.question}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="faq-answer">
            <p>{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
