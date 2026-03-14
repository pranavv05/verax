"use client";

import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-6">
        <div className="relative bg-primary rounded-[3rem] px-8 py-20 text-center overflow-hidden shadow-2xl shadow-primary/40">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-accent/20 rounded-full blur-[100px] -z-0" />
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-display font-bold text-primary-foreground mb-8">
              The last platform <br className="hidden md:block" /> your firm will ever need.
            </h2>
            <p className="text-xl text-primary-foreground/70 mb-12">
              Transform your firm from a document warehouse into a data-driven advisory firm. Join 10+ leading CA firms and modernize today.
            </p>


            <button className="flex items-center gap-2 mx-auto px-10 py-5 bg-accent text-accent-foreground text-xl font-bold rounded-full hover:opacity-95 transition-all shadow-xl shadow-accent/20 scale-100 active:scale-95">
              Book a Call
              <MoveRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-white border-t border-border pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="text-2xl font-display font-bold text-primary mb-6 block">
              Verax
            </Link>
            <p className="text-muted-text max-w-xs mb-8">
              The complete operating system for modern Chartered Accountants. Built by CAs, for CAs.
            </p>


          </div>
          
          <div>
            <h4 className="font-display font-bold text-primary mb-6 uppercase tracking-wider text-xs">Product</h4>
            <ul className="space-y-4 text-sm text-muted-text font-medium">
              <li><Link href="#features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="#how-it-works" className="hover:text-primary transition-colors">Integrations</Link></li>
              <li><Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-bold text-primary mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-4 text-sm text-muted-text font-medium">
              <li><Link href="#" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Careers</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Support</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-bold text-primary mb-6 uppercase tracking-wider text-xs">Legal</h4>
            <ul className="space-y-4 text-sm text-muted-text font-medium">
              <li><Link href="#" className="hover:text-primary transition-colors">Security</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-10 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-text font-medium">
          <p>© {new Date().getFullYear()} Verax Financial Inc. All rights reserved.</p>
          <div className="flex items-center gap-8">
            <span>Mumbai</span>
            <span>•</span>
            <span>Bengaluru</span>
            <span>•</span>
            <span>Delhi</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
