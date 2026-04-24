"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ArrowRight } from 'lucide-react';
import ContactUsModal from './ContactUsModal';

export type FaqItem = { question: string; answer: string }

export default function Faq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="w-full bg-black text-white">
        <section aria-label="Frequently asked questions" className="w-full max-w-6xl mx-auto py-24 px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
            {/* Left Column — Heading */}
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 mb-4 block">FAQS</span>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
                Any Questions?<br />We've got you.
              </h2>
              <p className="text-white/50 leading-relaxed mb-8 max-w-sm text-sm">
                Everything you need to know about our AI content generation platform. Can't find what you're looking for? Reach out to our support team.
              </p>
              <button
                onClick={() => setContactOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-400 transition-colors group"
              >
                Got Queries?
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <ContactUsModal
                isOpen={contactOpen}
                onClose={() => setContactOpen(false)}
                defaultCategory="generalQuery"
              />
            </div>

            {/* Right Column — Accordion */}
            <div className="space-y-0">
              {items.map((item, i) => {
                  const isOpen = openIndex === i;
                  return (
                      <div key={i} className="border-b border-white/10">
                          <button
                              onClick={() => setOpenIndex(isOpen ? null : i)}
                              className="w-full flex items-center justify-between py-5 text-left group"
                          >
                              <h3 className="text-base font-semibold tracking-tight group-hover:text-orange-500 transition-colors pr-4">
                                  {item.question}
                              </h3>
                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-white/40 group-hover:text-orange-500 transition-colors">
                                  {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                              </div>
                          </button>
                          <AnimatePresence>
                              {isOpen && (
                                  <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="overflow-hidden"
                                  >
                                      <p className="text-white/50 leading-relaxed pb-5 text-sm">
                                          {item.answer}
                                      </p>
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>
                  );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
