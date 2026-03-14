"use client";

import Link from "next/link";
import { MoveRight } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkBg, setIsDarkBg] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Detect if scrolling over a dark section (.bg-primary)
      const darkElements = document.querySelectorAll('.bg-primary');
      let overDark = false;
      
      darkElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Navbar is roughly at y: 20-80 depending on scroll
        // Give a little offset tolerance
        if (rect.top <= 100 && rect.bottom >= 60) {
          overDark = true;
        }
      });
      
      setIsDarkBg(overDark);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // check on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out flex justify-center w-full px-6 pt-6"
    >
      <div 
        className={`w-full flex items-center justify-between transition-all duration-500 ease-in-out max-w-5xl rounded-full px-8 py-3 shadow-lg backdrop-blur-md border ${
          isDarkBg 
            ? "bg-[#1A1F2C]/30 border-white/10 shadow-black/20" 
            : "bg-white/30 border-white/40 shadow-primary/5"
        }`}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className={`text-2xl font-display font-bold transition-colors duration-500 ${isDarkBg ? 'text-white' : 'text-primary'}`}>
            Verax
          </span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <Link href="#workflow" className={`text-sm font-medium transition-colors duration-500 ${isDarkBg ? 'text-white/70 hover:text-white' : 'text-muted-text hover:text-primary'}`}>
            Workflow
          </Link>
          <Link href="#features" className={`text-sm font-medium transition-colors duration-500 ${isDarkBg ? 'text-white/70 hover:text-white' : 'text-muted-text hover:text-primary'}`}>
            Infrastructure
          </Link>
          <Link href="#enterprise" className={`text-sm font-medium transition-colors duration-500 ${isDarkBg ? 'text-white/70 hover:text-white' : 'text-muted-text hover:text-primary'}`}>
            Enterprise
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="#" 
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-500 shadow-lg ${
              isDarkBg 
                ? "bg-white text-primary hover:bg-white/90 shadow-white/10" 
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/10"
            }`}
          >
            Book a Call
            <MoveRight size={16} />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
