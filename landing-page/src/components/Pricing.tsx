"use client";

import { Check, MoveRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Starter",
    price: "1,500",
    description: "Perfect for independent consultants and small firms.",
    features: [
      "Up to 20 Clients",
      "500 Documents / Month",
      "Magic Link Portal",
      "Basic AI Extraction",
      "Tally XML Export",
      "Email Support",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Professional",
    price: "4,000",
    description: "The complete setup for growing CA practices.",
    features: [
      "Up to 100 Clients",
      "3,000 Documents / Month",
      "Advanced AI Classification",
      "Compliance Calendar",
      "Team Collaboration (5 seats)",
      "Priority WhatsApp Support",
      "Custom Firm Branding",
    ],
    cta: "Book a Demo",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Tailored infrastructure for large-scale operations.",
    features: [
      "Unlimited Clients",
      "Unlimited Documents",
      "Direct API Integrations",
      "Custom Workflow Automation",
      "Dedicated Account Manager",
      "Single Sign-On (SSO)",
      "On-premise Deployment Options",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-surface relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-primary">Transparent, Scalable Pricing.</h2>
          <p className="text-lg text-muted-text max-w-2xl mx-auto font-medium">
            Choose a plan that fits your firm's current scale. Upgrade as you grow with no hidden fees or data caps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 ${
                plan.highlight 
                  ? "bg-white border-primary shadow-2xl shadow-primary/10 scale-105 z-10" 
                  : "bg-white/50 border-border hover:border-primary/30 hover:shadow-xl"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-display font-bold text-primary mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-muted-text">₹</span>
                  <span className="text-4xl font-display font-bold text-primary">{plan.price}</span>
                  {plan.price !== "Custom" && <span className="text-muted-text text-sm font-medium">/mo</span>}
                </div>
                <p className="text-sm text-muted-text mt-4 font-medium leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-accent" />
                    </div>
                    <span className="text-sm text-primary/80 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href="#"
                className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl text-sm font-bold transition-all duration-300 ${
                  plan.highlight
                    ? "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
                    : "bg-surface border border-border text-primary hover:bg-border"
                }`}
              >
                {plan.cta}
                <MoveRight size={16} />
              </Link>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-text font-medium">
            All plans include: Bank-Grade Security, Unlimited Magic Link Portals, and Tally XML Exports.
          </p>
        </div>
      </div>
    </section>
  );
}
