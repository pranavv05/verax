"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How secure is my client's financial data?",
    answer: "Data security is our top priority. We use AES-256 encryption at rest and TLS 1.3 for all data in transit. Every CA firm's data is logically isolated in its own secure vault, and we perform regular third-party security audits.",
  },
  {
    question: "Does it work with any version of Tally?",
    answer: "Yes. Verax generates Tally-compatible XML files that work with TallyPrime (all versions) and Tally.ERP 9. We also support direct API sync for firms using TallyPrime with a valid TSS subscription.",
  },
  {
    question: "What if the AI makes a mistake on an invoice?",
    answer: "Our engine provides a 'Confidence Score' for every extraction. If a value falls below our 99% threshold, it's flagged for your manual review. You can quickly verify and correct data side-by-side with the original document.",
  },
  {
    question: "Do my clients need to create an account to upload files?",
    answer: "No. Our 'Magic Link' technology allows clients to upload documents via a secure, single-use link sent to their WhatsApp or email. They can simply drag and drop files from any mobile or desktop browser.",
  },
  {
    question: "Can I manage multiple articled assistants on one account?",
    answer: "Absolutely. Our Professional and Enterprise plans allow you to add team members with role-based access controls. You can assign specific clients to assistants while retaining full review and export authority.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-4xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-primary">Common Questions.</h2>
          <p className="text-lg text-muted-text font-medium">
            Everything you need to know about the Verax infrastructure.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx}
              className="border border-border rounded-2xl overflow-hidden hover:border-primary/20 transition-all duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none bg-surface/50 hover:bg-surface transition-colors"
              >
                <span className="text-lg font-bold text-primary">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === idx ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown size={20} className="text-muted-text" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {openIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="p-6 pt-0 text-muted-text font-medium leading-relaxed border-t border-border/50">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
