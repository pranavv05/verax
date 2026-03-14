"use client";

import { motion } from "framer-motion";
import { CheckCircle2, MoveRight, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider uppercase text-accent bg-accent/10 rounded-full">
              Zero-Friction Accounting
            </span>



            <h1 className="text-5xl md:text-6xl font-display font-bold leading-tight mb-6 text-balance text-primary">
              The all-in-one workspace for <span className="text-accent underline decoration-accent/20 underline-offset-8">Chartered Accountants.</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-text mb-10 text-balance max-w-3xl mx-auto font-medium">
              Stop juggling WhatsApp threads, email attachments, and manual spreadsheets. Verax centralizes your client portal, document processing, and Tally exports into a single, seamless platform.
            </p>


          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-full hover:opacity-90 transition-all shadow-xl shadow-primary/20 scale-100 active:scale-95 group">
              See the Demo
              <Zap size={20} className="fill-accent text-accent group-hover:scale-110 transition-transform" />
            </button>
            <button className="flex items-center gap-2 px-8 py-4 bg-surface text-primary text-lg font-semibold rounded-full border border-border hover:bg-muted/5 transition-all scale-100 active:scale-95">
              Book a Call
              <MoveRight size={20} className="text-muted-text" />
            </button>
          </motion.div>


          {/* Social Proof Checklist */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-text font-medium border-t border-border pt-12"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-accent" />
              <span>95% Extraction Accuracy</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-accent" />
              <span>Tally Prime & ERP 9 Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-accent" />
              <span>AES-256 Bank-grade Security</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
