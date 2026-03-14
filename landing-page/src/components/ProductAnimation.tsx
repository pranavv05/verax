"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { CheckCircle2, ScanFace, FileJson, FileText } from "lucide-react";

export default function ProductAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 4000); // 4 seconds per step to allow reading
    return () => clearInterval(timer);
  }, []);

  const scale = useTransform(scrollYProgress, [0, 0.4], [0.8, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [15, 0]);
  const y = useTransform(scrollYProgress, [0, 0.4], [100, 0]);

  return (
    <section id="workflow" ref={containerRef} className="py-24 bg-surface relative overflow-visible" style={{ perspective: 2000 }}>
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-display font-bold mb-6 text-primary">How Verax Works</h3>
          <div className="flex items-center justify-center gap-4 text-sm font-medium">
             <span className={`transition-colors duration-500 font-bold ${step === 0 ? 'text-blue-600' : 'text-muted-text/50'}`}>1. Collect</span>
             <div className="w-8 h-px bg-border"></div>
             <span className={`transition-colors duration-500 font-bold ${step === 1 ? 'text-accent' : 'text-muted-text/50'}`}>2. Extract</span>
             <div className="w-8 h-px bg-border"></div>
             <span className={`transition-colors duration-500 font-bold ${step === 2 ? 'text-purple-600' : 'text-muted-text/50'}`}>3. Sync</span>
          </div>
        </div>

        <motion.div
           style={{
             scale,
             opacity,
             rotateX,
             y,
             transformStyle: "preserve-3d",
           }}
           className="relative mx-auto max-w-5xl"
        >
          {/* Main Interface Window */}
          <div className="relative rounded-2xl border border-border bg-[#F9F9F9] shadow-2xl shadow-primary/20 overflow-hidden h-[450px] md:h-[550px] flex flex-col">
            
            {/* Window Header */}
            <div className="bg-white border-b border-border px-4 py-3 flex items-center justify-between z-20">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
              </div>
              <div className="text-[10px] sm:text-xs text-muted-text font-medium font-display tracking-widest uppercase flex items-center gap-2">
                <span className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${step === 0 ? 'bg-blue-500' : step === 1 ? 'bg-accent' : 'bg-purple-500'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${step === 0 ? 'bg-blue-500' : step === 1 ? 'bg-accent' : 'bg-purple-500'}`}></span>
                </span>
                {step === 0 ? "Client Magic Link Portal" : step === 1 ? "Verax Intelligence Engine" : "Tally Export Module"}
              </div>
              <div className="w-12"></div>
            </div>
            
            <div className="flex-1 relative bg-surface overflow-hidden flex">
              
              {/* Sidebar Mapping */}
              <div className="hidden md:flex flex-col w-48 bg-white border-r border-border p-4 z-10">
                <div className="text-xs font-bold text-muted-text uppercase tracking-wider mb-4">Firm Workspace</div>
                <div className="space-y-2">
                  <div className={`p-2 rounded-lg text-sm font-medium transition-colors ${step === 0 ? 'bg-blue-50 text-blue-700' : 'text-muted-text'}`}>Inbox</div>
                  <div className={`p-2 rounded-lg text-sm font-medium transition-colors ${step === 1 ? 'bg-accent/10 text-accent' : 'text-muted-text'}`}>Review Queue</div>
                  <div className={`p-2 rounded-lg text-sm font-medium transition-colors ${step === 2 ? 'bg-purple-50 text-purple-700' : 'text-muted-text'}`}>Tally Exports</div>
                </div>
              </div>

              {/* Dynamic Content Area based on Step */}
              <div className="flex-1 p-6 relative">
                
                {/* STEP 0: COLLECT (List View) */}
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: step === 0 ? 1 : 0, pointerEvents: step === 0 ? 'auto' : 'none' }} 
                  className="absolute inset-6 flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center z-10">
                    <div>
                      <h4 className="text-base md:text-lg font-bold text-primary flex items-center gap-2">
                        Recent Client Uploads <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">5 New</span>
                      </h4>
                      <p className="text-xs text-muted-text mt-1">Acme Corp submitted documents via secure portal</p>
                    </div>
                    <button className="bg-primary text-white text-xs font-bold px-4 md:px-6 py-2 md:py-2.5 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md">
                       Process with AI Engine
                    </button>
                  </div>
                  
                  <div className="flex-1 p-0 flex flex-col">
                     {/* List Header */}
                     <div className="hidden sm:flex items-center justify-between px-6 py-2 border-b border-border/50 text-[10px] font-bold text-muted-text uppercase tracking-wider">
                       <div className="w-1/2">File Details</div>
                       <div className="w-1/4 text-center">Status</div>
                       <div className="w-1/4 text-right">Received</div>
                     </div>
                     
                     {/* List Items */}
                     {[1, 2, 3, 4].map((i) => (
                       <motion.div 
                         key={i}
                         initial={{ y: 20, opacity: 0 }}
                         animate={{ y: step === 0 ? 0 : 20, opacity: step === 0 ? 1 : 0 }}
                         transition={{ delay: step === 0 ? i * 0.1 : 0 }}
                         className="border-b border-border/50 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-surface/50 transition-colors gap-3 sm:gap-0"
                       >
                         <div className="w-full sm:w-1/2 flex items-center gap-3">
                           <div className="p-2 bg-red-50 text-red-500 rounded-lg shrink-0"><FileText size={18} /></div>
                           <div className="min-w-0">
                             <p className="text-sm font-bold text-primary truncate leading-tight">INV_OCT_2023_00{i}.pdf</p>
                             <p className="text-[11px] text-muted-text mt-0.5">1.{i} MB • PDF Document</p>
                           </div>
                         </div>
                         <div className="w-full sm:w-1/4 flex sm:justify-center">
                           <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md uppercase tracking-wider">Ready for Review</span>
                         </div>
                         <div className="w-full sm:w-1/4 flex sm:justify-end text-right">
                           <span className="text-xs text-muted-text font-medium">{i} min ago</span>
                         </div>
                       </motion.div>
                     ))}
                  </div>
                </motion.div>

                {/* STEP 1: EXTRACT (Split Pane Document View) */}
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: step === 1 ? 1 : 0, pointerEvents: step === 1 ? 'auto' : 'none' }} 
                  className="absolute inset-6 flex gap-4 bg-surface"
                >
                  {/* Left Pane: The Document being scanned */}
                  <div className="w-1/2 bg-white border border-border rounded-xl shadow-sm relative overflow-hidden flex flex-col p-6">
                    <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                      <div className="h-6 w-24 bg-muted/20 rounded-md"></div>
                      <div className="h-6 w-24 bg-muted/20 rounded-md"></div>
                    </div>
                    
                    {/* Invoice Body Text Skeletons */}
                    <div className="space-y-4 relative z-10">
                      <div className="h-4 w-1/3 bg-muted/20 rounded-md"></div>
                      <div className="h-4 w-1/4 bg-muted/20 rounded-md"></div>
                      <div className="h-4 w-1/2 bg-muted/20 rounded-md"></div>
                      <div className="py-4"></div>
                      <div className="h-4 w-full bg-primary/10 rounded-md"></div>
                      <div className="h-4 w-full bg-primary/10 rounded-md"></div>
                      <div className="h-4 w-3/4 bg-primary/10 rounded-md"></div>
                      <div className="py-4"></div>
                      <div className="flex justify-end"><div className="h-6 w-1/3 bg-accent/20 rounded-md font-bold text-accent px-2 flex justify-end items-center text-xs">₹14,500.00</div></div>
                    </div>

                    {/* Single Document Laser Scanner */}
                    <motion.div 
                      initial={{ top: "-20%", opacity: 0 }}
                      animate={{ top: step === 1 ? ["-20%", "120%"] : "-20%", opacity: step === 1 ? [0, 1, 1, 0] : 0 }}
                      transition={{ duration: 3, ease: "linear", repeatDelay: 1 }}
                      className="absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-accent/20 to-transparent border-b-[3px] border-accent/80 z-20 pointer-events-none shadow-[0_10px_30px_rgba(74,124,89,0.4)]"
                    />
                  </div>

                  {/* Right Pane: Extracted Data Fields */}
                  <div className="w-1/2 bg-white border border-border rounded-xl shadow-sm p-6 flex flex-col justify-center">
                    <h4 className="text-sm font-bold text-muted-text uppercase tracking-wider mb-6 flex items-center gap-2">
                      <ScanFace size={16} className="text-accent" /> Extraction Results
                    </h4>
                    
                    <div className="space-y-6">
                      {/* Field 1 */}
                      <div>
                        <div className="text-xs text-muted-text mb-1">Vendor Name</div>
                        <motion.div 
                          initial={{ filter: "blur(4px)", opacity: 0, x: -10 }}
                          animate={{ filter: step === 1 ? "blur(0px)" : "blur(4px)", opacity: step === 1 ? 1 : 0, x: step === 1 ? 0 : -10 }}
                          transition={{ delay: step === 1 ? 0.8 : 0, duration: 0.3 }}
                          className="font-bold text-primary p-2 bg-surface rounded-md border border-border"
                        >
                          Reliance Retail Ltd.
                        </motion.div>
                      </div>

                      {/* Field 2 */}
                      <div>
                        <div className="text-xs text-muted-text mb-1">Invoice Date</div>
                        <motion.div 
                          initial={{ filter: "blur(4px)", opacity: 0, x: -10 }}
                          animate={{ filter: step === 1 ? "blur(0px)" : "blur(4px)", opacity: step === 1 ? 1 : 0, x: step === 1 ? 0 : -10 }}
                          transition={{ delay: step === 1 ? 1.4 : 0, duration: 0.3 }}
                          className="font-bold text-primary p-2 bg-surface rounded-md border border-border"
                        >
                          24 Oct 2023
                        </motion.div>
                      </div>

                      {/* Field 3 */}
                      <div>
                        <div className="text-xs text-muted-text mb-1 flex justify-between">
                          <span>Total Amount</span>
                          <span className="text-green-600 font-bold text-[10px] bg-green-50 px-1.5 py-0.5 rounded">99.9% Confidence</span>
                        </div>
                        <motion.div 
                          initial={{ filter: "blur(4px)", opacity: 0, x: -10 }}
                          animate={{ filter: step === 1 ? "blur(0px)" : "blur(4px)", opacity: step === 1 ? 1 : 0, x: step === 1 ? 0 : -10 }}
                          transition={{ delay: step === 1 ? 2.0 : 0, duration: 0.3 }}
                          className="font-bold text-green-700 p-2 bg-green-50/50 rounded-md border border-green-200/50 text-xl"
                        >
                          ₹14,500.00
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* STEP 2: SYNC */}
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: step === 2 ? 1 : 0, pointerEvents: step === 2 ? 'auto' : 'none' }} 
                  className="absolute inset-6 flex items-center justify-center bg-surface"
                >
                  <div className="w-full max-w-2xl bg-white border border-border rounded-2xl shadow-xl overflow-hidden text-center flex flex-col md:flex-row">
                     {/* Left side info */}
                     <div className="p-8 md:w-1/2 flex flex-col justify-center items-center md:items-start text-left border-r border-border bg-gray-50/50">
                       <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                         <FileJson size={32} />
                       </div>
                       <h4 className="text-2xl font-bold text-primary mb-2">Tally XML Ready</h4>
                       <p className="text-muted-text text-sm mb-8 leading-relaxed">Invoices have been processed, totals verified, and auto-mapped to 'Sundry Creditors'.</p>
                       
                       <button className="w-full py-3.5 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                         <CheckCircle2 size={18} /> Push to Tally Prime
                       </button>
                     </div>

                     {/* Right side code preview */}
                     <div className="bg-[#1A1F2C] p-6 text-left flex flex-col gap-1 font-mono text-[11px] md:text-xs text-blue-300 md:w-1/2 overflow-hidden relative">
                       <div className="absolute top-0 right-0 p-2 bg-white/10 text-white/50 text-[10px] rounded-bl-lg font-sans">XML Preview</div>
                       <div className="mt-4"><span className="text-purple-400">&lt;ENVELOPE&gt;</span></div>
                       <div className="pl-4"><span className="text-purple-400">&lt;VOUCHER&gt;</span></div>
                       <div className="pl-8 text-green-400">{"<DATE>2023-10-24</DATE>"}</div>
                       <div className="pl-8 text-green-400">{"<PARTYLEDGERNAME>Reliance Retail</PARTYLEDGERNAME>"}</div>
                       <div className="pl-8 text-green-400">{"<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>"}</div>
                       <div className="pl-8"><span className="text-purple-400">&lt;ALLLEDGERENTRIES.LIST&gt;</span></div>
                       <div className="pl-12 text-yellow-300">{"<AMOUNT>-14500.00</AMOUNT>"}</div>
                       <div className="pl-8"><span className="text-purple-400">&lt;/ALLLEDGERENTRIES.LIST&gt;</span></div>
                       <div className="pl-4"><span className="text-purple-400">&lt;/VOUCHER&gt;</span></div>
                       <div><span className="text-purple-400">&lt;/ENVELOPE&gt;</span></div>
                     </div>
                  </div>
                </motion.div>

              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
