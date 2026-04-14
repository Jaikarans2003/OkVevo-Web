"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export type FaqItem = { question: string; answer: string }

export default function Faq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
        <section aria-label="Frequently asked questions" className="w-full max-w-4xl mx-auto py-24 px-6">
          <div className="mb-12">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 mb-4 block">Knowledge Base</span>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase">Frequently Asked <br /> Questions</h2>
          </div>
          <div className="space-y-4">
              {items.map((item, i) => {
                  const isOpen = openIndex === i;
                  return (
                      <div key={i} className="border-b border-white/5 pb-4">
                          <button 
                              onClick={() => setOpenIndex(isOpen ? null : i)}
                              className="w-full flex items-center justify-between py-4 text-left group"
                          >
                              <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                                  {item.question}
                              </h3>
                              <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 ml-4 group-hover:border-orange-500 transition-colors">
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
                                      <p className="text-white/60 leading-relaxed max-w-3xl py-4 border-l border-orange-500/30 pl-6">
                                          {item.answer}
                                      </p>
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>
                  );
              })}
          </div>
        </section>
      </div>
    </>
  )
}
