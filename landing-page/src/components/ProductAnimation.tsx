"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { CheckCircle2, ScanFace, FileJson, FileText, LayoutDashboard, Users, Inbox, Search, Bell, Settings, PieChart, Activity } from "lucide-react";

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
    }, 2500); // 2.5 seconds per step
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
          <h3 className="text-3xl font-display font-bold mb-6 text-primary">See Verax in Action</h3>
          <div className="flex items-center justify-center gap-4 text-sm font-medium">
             <span className={`transition-colors duration-500 font-bold ${step === 0 ? 'text-blue-600' : 'text-muted-text/50'}`}>1. Document Inbox</span>
             <div className="w-8 h-px bg-border"></div>
             <span className={`transition-colors duration-500 font-bold ${step === 1 ? 'text-accent' : 'text-muted-text/50'}`}>2. AI Extraction</span>
             <div className="w-8 h-px bg-border"></div>
             <span className={`transition-colors duration-500 font-bold ${step === 2 ? 'text-purple-600' : 'text-muted-text/50'}`}>3. Tally Export</span>
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
          <div className="relative rounded-2xl border border-border bg-[#F9F9F9] shadow-2xl shadow-primary/20 overflow-hidden h-[500px] md:h-[600px] flex flex-col">
            
            {/* Mac Window Header */}
            <div className="bg-white border-b border-border px-4 py-3 flex items-center justify-between z-20 shrink-0">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
              </div>
              <div className="text-[10px] sm:text-xs text-muted-text font-medium font-display tracking-widest text-center">
                 app.verax.finance
              </div>
              <div className="w-12"></div>
            </div>
            
            <div className="flex-1 relative bg-surface overflow-hidden flex">
              
              {/* Full SaaS Sidebar */}
              <div className="hidden md:flex flex-col w-56 bg-white border-r border-border py-4 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                {/* Firm Dropdown */}
                <div className="flex items-center justify-between px-4 mb-6 cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xs shadow-sm group-hover:bg-primary/90 transition-colors">FA</div>
                    <div>
                      <div className="text-sm font-bold text-primary leading-tight">Firm Associates</div>
                      <div className="text-[10px] text-muted-text">Professional Plan</div>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-bold text-muted-text uppercase tracking-widest mb-2 px-4">Workspace</div>
                <div className="space-y-1 px-2 mb-6">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-text hover:bg-surface transition-colors cursor-pointer">
                    <LayoutDashboard size={16} /> Dashboard
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-text hover:bg-surface transition-colors cursor-pointer">
                    <Users size={16} /> Client Directory
                  </div>
                </div>

                <div className="text-[10px] font-bold text-muted-text uppercase tracking-widest mb-2 px-4">Operations</div>
                <div className="space-y-1 px-2">
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${step === 0 ? 'bg-blue-50 text-blue-700 font-bold shadow-sm border border-blue-100/50' : 'text-muted-text hover:bg-surface'}`}>
                    <Inbox size={16} /> Document Inbox
                  </div>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${step === 1 ? 'bg-accent/10 text-accent font-bold shadow-sm border border-accent/20' : 'text-muted-text hover:bg-surface'}`}>
                    <ScanFace size={16} /> AI Review Queue
                  </div>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${step === 2 ? 'bg-purple-50 text-purple-700 font-bold shadow-sm border border-purple-100/50' : 'text-muted-text hover:bg-surface'}`}>
                    <Activity size={16} /> Tally Export
                  </div>
                </div>
                
                <div className="mt-auto px-2 space-y-1">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-text hover:bg-surface transition-colors cursor-pointer">
                    <PieChart size={16} /> Analytics
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-text hover:bg-surface transition-colors cursor-pointer">
                    <Settings size={16} /> Settings
                  </div>
                </div>
              </div>

              {/* Main App Content Area */}
              <div className="flex-1 flex flex-col relative overflow-hidden bg-surface">
                
                {/* Internal App Header */}
                <div className="h-14 bg-white border-b border-border flex items-center justify-between px-6 z-10 shrink-0">
                  <div className="w-full max-w-sm relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" size={14} />
                    <input type="text" placeholder="Search invoices, clients, or tags..." className="w-full pl-9 pr-4 py-1.5 bg-surface border border-border rounded-md text-xs focus:outline-none focus:border-primary/30 transition-colors" disabled />
                  </div>
                  <div className="flex items-center gap-4 text-muted-text ml-auto">
                    <div className="relative cursor-pointer hover:text-primary transition-colors">
                      <Bell size={18} />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    </div>
                    <div className="h-4 w-px bg-border"></div>
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold ring-2 ring-white shadow-sm cursor-pointer">JS</div>
                  </div>
                </div>

                {/* Dashboard Page Content */}
                <div className="flex-1 p-6 relative overflow-hidden flex flex-col">
                  
                  {/* STEP 0: COLLECT (List View) */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: step === 0 ? 1 : 0, scale: step === 0 ? 1 : 0.98, pointerEvents: step === 0 ? 'auto' : 'none', zIndex: step === 0 ? 20 : 10 }} 
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-6 flex flex-col bg-white border border-border rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden"
                  >
                    <div className="bg-white border-b border-border px-6 py-4 flex justify-between items-center z-10">
                      <div>
                        <h4 className="text-base md:text-lg font-bold text-primary flex items-center gap-2">
                          Document Inbox <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">5 Unprocessed</span>
                        </h4>
                        <p className="text-xs text-muted-text mt-1">Files uploaded by clients via Magic Link portal</p>
                      </div>
                      <button className="bg-primary text-white text-xs font-bold px-4 md:px-6 py-2 md:py-2.5 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md">
                         Run AI Extraction
                      </button>
                    </div>
                    
                    <div className="flex-1 p-0 flex flex-col overflow-y-auto">
                       {/* List Header */}
                       <div className="hidden sm:flex items-center justify-between px-6 py-3 border-b border-border/50 text-[10px] font-bold text-muted-text uppercase tracking-wider bg-surface/50">
                         <div className="w-1/2">File Details</div>
                         <div className="w-1/4 text-center">Status</div>
                         <div className="w-1/4 text-right">Received Time</div>
                       </div>
                       
                       {/* List Items */}
                       {[1, 2, 3, 4, 5].map((i) => (
                         <motion.div 
                           key={i}
                           initial={{ y: 20, opacity: 0 }}
                           animate={{ y: step === 0 ? 0 : 20, opacity: step === 0 ? 1 : 0 }}
                           transition={{ delay: step === 0 ? i * 0.1 : 0 }}
                           className="border-b border-border/50 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-surface/80 transition-colors gap-3 sm:gap-0"
                         >
                           <div className="w-full sm:w-1/2 flex items-center gap-3">
                             <div className="p-2 bg-red-50 text-red-500 rounded-lg shrink-0"><FileText size={18} /></div>
                             <div className="min-w-0">
                               <p className="text-sm font-bold text-primary truncate leading-tight">INV_OCT_2023_00{i}.pdf</p>
                               <div className="text-[11px] text-muted-text mt-0.5 flex gap-2">
                                 <span>Acme Corp</span> • <span>1.{i} MB</span>
                               </div>
                             </div>
                           </div>
                           <div className="w-full sm:w-1/4 flex sm:justify-center">
                             <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md uppercase tracking-wider">Ready for Setup</span>
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
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: step === 1 ? 1 : 0, scale: step === 1 ? 1 : 0.98, pointerEvents: step === 1 ? 'auto' : 'none', zIndex: step === 1 ? 20 : 10 }} 
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-6 flex gap-4"
                  >
                    {/* Left Pane: The Document being scanned */}
                    <div className="w-1/2 bg-white border border-border rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col p-6">
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
                        transition={{ duration: 2, ease: "linear", repeatDelay: 0.5 }}
                        className="absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-accent/20 to-transparent border-b-[3px] border-accent/80 z-20 pointer-events-none shadow-[0_10px_30px_rgba(74,124,89,0.4)]"
                      />
                    </div>

                    {/* Right Pane: Extracted Data Fields */}
                    <div className="w-1/2 bg-white border border-border rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 flex flex-col justify-center relative">
                      <div className="absolute top-4 right-4 bg-accent/10 text-accent text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">AI Processing</div>
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-8 flex items-center gap-2">
                        <ScanFace size={18} className="text-accent" /> Extracted Data
                      </h4>
                      
                      <div className="space-y-6">
                        {/* Field 1 */}
                        <div>
                          <div className="text-xs font-semibold text-muted-text mb-1">Vendor Name</div>
                          <motion.div 
                            initial={{ filter: "blur(4px)", opacity: 0, x: -10 }}
                            animate={{ filter: step === 1 ? "blur(0px)" : "blur(4px)", opacity: step === 1 ? 1 : 0, x: step === 1 ? 0 : -10 }}
                            transition={{ delay: step === 1 ? 0.4 : 0, duration: 0.3 }}
                            className="font-bold text-primary p-2.5 bg-surface rounded-lg border border-border shadow-sm"
                          >
                            Reliance Retail Ltd.
                          </motion.div>
                        </div>

                        {/* Field 2 */}
                        <div>
                          <div className="text-xs font-semibold text-muted-text mb-1">Invoice Date</div>
                          <motion.div 
                            initial={{ filter: "blur(4px)", opacity: 0, x: -10 }}
                            animate={{ filter: step === 1 ? "blur(0px)" : "blur(4px)", opacity: step === 1 ? 1 : 0, x: step === 1 ? 0 : -10 }}
                            transition={{ delay: step === 1 ? 0.8 : 0, duration: 0.3 }}
                            className="font-bold text-primary p-2.5 bg-surface rounded-lg border border-border shadow-sm"
                          >
                            24 Oct 2023
                          </motion.div>
                        </div>

                        {/* Field 3 */}
                        <div>
                          <div className="text-xs font-semibold text-muted-text mb-1 flex justify-between items-end">
                            <span>Total Amount</span>
                            <span className="text-green-600 font-bold text-[10px] bg-green-50 px-2 py-0.5 rounded shadow-sm border border-green-100">99.9% Confidence</span>
                          </div>
                          <motion.div 
                            initial={{ filter: "blur(4px)", opacity: 0, x: -10 }}
                            animate={{ filter: step === 1 ? "blur(0px)" : "blur(4px)", opacity: step === 1 ? 1 : 0, x: step === 1 ? 0 : -10 }}
                            transition={{ delay: step === 1 ? 1.2 : 0, duration: 0.3 }}
                            className="font-bold text-green-700 p-3 bg-green-50/50 rounded-lg border border-green-200/80 text-2xl shadow-sm"
                          >
                            ₹14,500.00
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* STEP 2: SYNC */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: step === 2 ? 1 : 0, scale: step === 2 ? 1 : 0.98, pointerEvents: step === 2 ? 'auto' : 'none', zIndex: step === 2 ? 20 : 10 }} 
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-6 flex items-center justify-center bg-transparent"
                  >
                    <div className="w-full h-full bg-white border border-border rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col md:flex-row">
                       {/* Left side info */}
                       <div className="p-8 md:w-5/12 flex flex-col justify-center items-start text-left border-r border-border bg-white">
                         <div className="text-[10px] font-bold text-muted-text uppercase tracking-widest mb-4">Export Module</div>
                         <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-purple-200">
                           <FileJson size={24} />
                         </div>
                         <h4 className="text-2xl font-bold text-primary mb-2">Tally XML Ready</h4>
                         <p className="text-muted-text text-sm mb-8 leading-relaxed">14 Invoices have been processed, totals verified, and auto-mapped to 'Sundry Creditors'.</p>
                         
                         <button className="w-full py-3 bg-primary text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-md">
                           <CheckCircle2 size={18} /> Push to Tally Prime
                         </button>
                       </div>

                       {/* Right side code preview */}
                       <div className="bg-[#1A1F2C] p-6 text-left flex flex-col font-mono text-xs text-blue-300 md:w-7/12 overflow-hidden relative">
                         <div className="absolute top-0 right-0 px-4 py-2 bg-white/10 text-white/70 text-[10px] font-bold tracking-wider uppercase rounded-bl-lg font-sans shadow-lg">XML Output</div>
                         <div className="mt-8 space-y-1">
                           <div><span className="text-purple-400">&lt;ENVELOPE&gt;</span></div>
                           <div className="pl-4"><span className="text-purple-400">&lt;VOUCHER&gt;</span></div>
                           <div className="pl-8 text-green-400">{"<DATE>2023-10-24</DATE>"}</div>
                           <div className="pl-8 text-green-400">{"<PARTYLEDGERNAME>Reliance Retail</PARTYLEDGERNAME>"}</div>
                           <div className="pl-8 text-green-400">{"<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>"}</div>
                           <div className="pl-8"><span className="text-purple-400">&lt;ALLLEDGERENTRIES.LIST&gt;</span></div>
                           <div className="pl-12 text-yellow-300">{"<AMOUNT>-14500.00</AMOUNT>"}</div>
                           <div className="pl-12 text-blue-200">{"<LEDGERNAME>Sundry Creditors</LEDGERNAME>"}</div>
                           <div className="pl-8"><span className="text-purple-400">&lt;/ALLLEDGERENTRIES.LIST&gt;</span></div>
                           <div className="pl-4"><span className="text-purple-400">&lt;/VOUCHER&gt;</span></div>
                           <div><span className="text-purple-400">&lt;/ENVELOPE&gt;</span></div>
                         </div>
                       </div>
                    </div>
                  </motion.div>

                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
