"use client";

import { motion } from "framer-motion";
import { Smartphone, Zap, FileJson, Link as LinkIcon, UploadCloud, CheckCircle2, ArrowRight, Users } from "lucide-react";

// --- MOCKUP COMPONENTS (Pure CSS/Tailwind) ---

const MagicLinkMockup = () => (
  <div className="w-full h-full bg-[#FAFAFA] flex items-center justify-center p-8 relative overflow-hidden">
    {/* Decorative background elements */}
    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2" />
    <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl opacity-50 -translate-x-1/2 translate-y-1/2" />
    
    <div className="flex flex-col md:flex-row gap-6 md:gap-14 items-center justify-center w-full z-10">
      {/* Sender Firm Side (Dashboard Card) */}
      <div className="w-full max-w-[320px] bg-white border border-border shadow-2xl rounded-3xl p-8 flex flex-col relative min-h-[320px]">
        <div className="absolute -top-4 -left-4 bg-[#1A1F2C] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg">Firm View</div>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold font-display text-xl shadow-inner border border-blue-100">AC</div>
          <div>
            <div className="font-bold text-lg text-primary leading-tight">Acme Corporation</div>
            <div className="text-xs text-muted-text mt-1">Pending: October Invoices</div>
          </div>
        </div>

        <div className="space-y-4 mb-8 flex-1">
          <div className="flex items-center justify-between border-b border-surface pb-3">
            <span className="text-sm text-muted-text font-medium">Client ID</span>
            <span className="text-sm font-bold text-primary">#ACM-294</span>
          </div>
          <div className="flex items-center justify-between border-b border-surface pb-3">
             <span className="text-sm text-muted-text font-medium">Required Docs</span>
             <span className="text-sm font-bold text-primary">12 Files</span>
          </div>
          <div className="flex items-center justify-between pb-2">
             <span className="text-sm text-muted-text font-medium">Portal Status</span>
             <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md uppercase tracking-wide">Waiting</span>
          </div>
        </div>

        <div className="mt-auto">
          <button className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-3.5 rounded-xl text-xs font-bold flex justify-center items-center gap-2 shadow-xl shadow-blue-600/20">
            <LinkIcon size={16} /> Generate Magic Link
          </button>
        </div>
      </div>

      {/* Connection arrow */}
      <div className="text-muted-text/30 hidden md:flex flex-col items-center">
        <ArrowRight size={24} />
      </div>

      {/* Client Phone Side (Mobile Mockup) */}
      <div className="w-[220px] bg-white border-[6px] border-slate-900 shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col relative shrink-0 h-[460px] transform md:rotate-2">
        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-900 rounded-full z-20 shadow-sm" />
        
        {/* Phone Status Bar Mockup */}
        <div className="h-10 bg-blue-600 px-5 pt-3 flex justify-between items-center text-white text-[9px] z-10 font-medium tracking-wide">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            {/* Signal bars */}
            <div className="flex gap-0.5 items-end h-2">
               <div className="w-0.5 h-1 bg-white rounded-sm"></div>
               <div className="w-0.5 h-1.5 bg-white rounded-sm"></div>
               <div className="w-0.5 h-2 bg-white rounded-sm"></div>
               <div className="w-0.5 h-2 bg-white/50 rounded-sm"></div>
            </div>
            {/* Battery */}
            <div className="w-4 h-2 border border-white/80 rounded-[3px] p-[1px] flex relative ml-0.5">
               <div className="w-full h-full bg-white rounded-[1px]"></div>
               <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1px] h-1 bg-white/80 rounded-r-sm"></div>
            </div>
          </div>
        </div>

        {/* Client App Header */}
        <div className="bg-blue-600 pb-5 pt-2 px-4 text-white shadow-md z-10">
          <div className="text-[9px] font-semibold opacity-80 uppercase tracking-widest mb-1.5">Verax Secure</div>
          <div className="text-[14px] font-bold leading-snug">Drop files for<br/>Global Associates</div>
        </div>

        {/* Client App Body */}
        <div className="flex-1 bg-surface p-4 flex flex-col pb-6 relative">
          <div className="bg-white border border-border rounded-xl p-3 mb-3 shadow-sm relative z-10">
            <div className="text-[11px] font-bold text-primary mb-1">Upload October Invoices</div>
            <div className="text-[9px] text-muted-text leading-relaxed">Please upload all purchase invoices for Oct 2023.</div>
          </div>

          <div className="flex-1 bg-blue-50/50 border border-blue-200 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors relative z-10">
            <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex flex-col items-center justify-center shadow-sm">
              <UploadCloud size={16} />
            </div>
            <div className="text-center mt-1">
              <div className="text-[11px] font-bold text-primary">Tap to select files</div>
              <div className="text-[8px] font-semibold text-muted-text uppercase tracking-widest mt-1">PDF, JPG, PNG</div>
            </div>
          </div>
          
          <div className="mt-3 text-[8px] text-center text-muted-text bg-white py-2 rounded-lg border border-border shadow-sm font-medium relative z-10">
            No login required. Secure upload.
          </div>
          
          {/* Subtle Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-900/20 rounded-full z-20" />
        </div>
      </div>
    </div>
  </div>
);

const ExtractionMockup = () => (
  <div className="w-full h-full bg-[#1A1F2C] flex items-center justify-center p-8 relative overflow-hidden">
    {/* Dark mode AI background glow */}
    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-accent/20 blur-3xl opacity-30" />
    
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg z-10 items-stretch">
      {/* Raw Receipt */}
      <div className="w-full md:w-1/2 bg-white rounded-xl shadow-2xl p-4 flex flex-col relative rotate-[-2deg] opacity-90">
         <div className="h-6 mb-4 flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
            <div className="font-mono text-[10px] font-bold text-gray-800">TAX INVOICE</div>
            <div className="text-[8px] text-gray-500">No. 8812</div>
         </div>
         <div className="space-y-2 mb-4">
            <div className="h-2 w-2/3 bg-gray-200"></div>
            <div className="h-2 w-1/2 bg-gray-200"></div>
            {/* Highlighted Vendor */}
            <div className="relative inline-block">
               <div className="absolute inset-0 bg-yellow-300/40 border border-yellow-400 rounded-sm -m-1"></div>
               <div className="h-3 w-32 bg-gray-800 relative z-10"></div>
            </div>
            <div className="h-2 w-3/4 bg-gray-200"></div>
         </div>
         <div className="mt-auto pt-4 border-t-2 border-gray-800 flex justify-between items-end">
             <div className="text-[8px] font-bold">TOTAL</div>
             {/* Highlighted Amount */}
             <div className="relative inline-block">
               <div className="absolute inset-0 bg-green-300/40 border border-green-400 rounded-sm -m-1"></div>
               <div className="h-4 w-16 bg-gray-800 relative z-10"></div>
            </div>
         </div>
      </div>

      {/* AI Extraction Data */}
      <div className="w-full md:w-1/2 mt-4 md:mt-8 rotate-[1deg]">
         <div className="bg-surface/10 backdrop-blur-md rounded-xl border border-white/20 p-4 shadow-xl">
           <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
             <Zap size={12} /> Extracted Data
           </div>
           <div className="space-y-4">
             <div>
               <div className="text-[9px] text-gray-400 uppercase mb-1">Vendor Name</div>
               <div className="text-sm font-bold text-white bg-white/5 px-2 py-1 rounded border border-white/10">Swiggy Instamart</div>
             </div>
             <div>
               <div className="text-[9px] text-gray-400 uppercase mb-1 flex justify-between">
                 <span>Gross Amount</span>
                 <span className="text-accent">100% Confident</span>
               </div>
               <div className="text-lg font-mono font-bold text-green-400 bg-white/5 px-2 py-1 rounded border border-white/10">₹ 2,490.00</div>
             </div>
           </div>
         </div>
      </div>
    </div>
  </div>
);

const TallyMockup = () => (
  <div className="w-full h-full bg-[#FAFAFA] flex items-center justify-center p-8 relative overflow-hidden">
     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)] pointer-events-none" />
     
     <div className="w-full max-w-lg bg-white border border-border shadow-xl rounded-2xl overflow-hidden z-10 flex flex-col">
       <div className="bg-purple-50 text-purple-900 px-5 py-3 border-b border-purple-100 flex justify-between items-center">
         <div className="font-bold text-sm flex items-center gap-2">
           <FileJson size={16} className="text-purple-600" /> Tally Prime Exporter
         </div>
         <div className="text-xs bg-white px-2 py-1 rounded-md border border-purple-200 font-medium">
           Firm: Global Associates
         </div>
       </div>

       <div className="p-5">
         <div className="grid grid-cols-2 gap-4 mb-6">
           <div className="border border-border rounded-xl p-3 bg-surface">
             <div className="text-[10px] text-muted-text font-bold uppercase tracking-wider mb-1">Ready Vouchers</div>
             <div className="text-2xl font-display font-bold text-primary">142</div>
           </div>
           <div className="border border-border rounded-xl p-3 bg-surface">
             <div className="text-[10px] text-muted-text font-bold uppercase tracking-wider mb-1">Mapped Ledgers</div>
             <div className="text-2xl font-display font-bold text-green-600">100%</div>
           </div>
         </div>

         <div className="bg-surface rounded-xl border border-border overflow-hidden">
           <div className="px-4 py-2 bg-gray-50 border-b border-border text-xs font-bold text-muted-text flex justify-between">
             <span>Export Log</span>
             <span className="text-purple-600">XML Format</span>
           </div>
           <div className="p-4 space-y-3">
             <div className="flex items-center gap-3">
               <CheckCircle2 size={14} className="text-green-500" />
               <div className="flex-1 text-xs font-medium text-primary line-clamp-1">Generated master_ledgers.xml</div>
             </div>
             <div className="flex items-center gap-3">
               <CheckCircle2 size={14} className="text-green-500" />
               <div className="flex-1 text-xs font-medium text-primary line-clamp-1">Generated purchase_vouchers_oct.xml</div>
             </div>
             <div className="flex items-center gap-3">
               <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"></div>
               <div className="flex-1 text-xs font-medium text-purple-600 line-clamp-1">Syncing with Tally Gateway...</div>
             </div>
           </div>
         </div>
       </div>
     </div>
  </div>
);

const features = [
  {
    title: "Zero-Friction Document Collection.",
    description: "Eliminate WhatsApp chases and endless email threads. Create secure, single-use client portals in one click. Clients upload via a simple Magic Link—no app to install, no password to remember. Every file lands exactly where it belongs, tagged and ready for processing.",
    icon: Smartphone, 
    Mockup: MagicLinkMockup,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "Multi-Engine AI Extraction.",
    description: "Verax doesn't just read text; it understands financial context. Our engine extracts vendor data, GST breakdown, and line-item details from Invoices, Receipts, and Bank Statements with 99.9% precision. Flag low-confidence entries for human review only when necessary.",
    icon: Zap,
    Mockup: ExtractionMockup,
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Enterprise Tally & ERP Sync.",
    description: "Bridge the gap between raw data and your back line. Verax automatically maps extracted values to your specific chart of accounts. Generate pre-formatted Tally XMLs, Zoho-compatible exports, or push directly via API to your existing accounting stack.",
    icon: FileJson,
    Mockup: TallyMockup,
    color: "bg-purple-500/10 text-purple-600",
  },
];

const secondaryFeatures = [
  {
    title: "Client Command Center",
    description: "A specialized CRM for CAs. Manage 100+ clients with a unified view of their document trails and filing status.",
    icon: Users,
  },
  {
    title: "Bank Statement Parsing",
    description: "Full PDF parsing for all major Indian banks. Extract transaction rows directly into Excel or Tally XML.",
  },
  {
    title: "Compliance Calendar",
    description: "Automatic tracking for GST, TDS, and ITR deadlines. Send automated nudges to clients when files are missing.",
    icon: CheckCircle2,
  },
  {
    title: "Ledger Auto-Mapping",
    description: "Our AI learns your mapping patterns. Map 'Reliance' to 'Purchases' once, and it never asks you again.",
  },
  {
    title: "Team Collaboration",
    description: "Built for teams. Assign clients to specific articled assistants and review their work before final export.",
  },
  {
    title: "Bank-Grade Security",
    description: "AES-256 encryption at rest and TLS 1.3 in transit. Every client's data is isolated in a secure vault.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-surface">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-primary">The Full OS for Modern Firms.</h2>
          <p className="text-lg text-muted-text max-w-2xl mx-auto font-medium">
            Verax replaces fragmented tools with a single, high-performance infrastructure. Built from the ground up to handle the specific needs of Indian Chartered Accountants.
          </p>
        </div>

        {/* Deep Dive Features */}
        <div className="space-y-32 mb-40">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className={`flex flex-col ${
                index % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
              } items-center gap-16 md:gap-24`}
            >
              <div className="flex-1">
                <div className={`inline-flex items-center justify-center p-3 rounded-2xl mb-6 ${feature.color}`}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-3xl font-display font-bold mb-6 text-primary">{feature.title}</h3>
                <p className="text-xl text-muted-text mb-8 leading-relaxed font-medium">
                  {feature.description}
                </p>
                <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-wider text-accent cursor-pointer hover:gap-6 transition-all">
                  <span>Explore the module</span>
                  <div className="h-px w-8 bg-accent/30" />
                </div>
              </div>
              
              <div className="flex-1 w-full">
                <div className="relative aspect-[4/3] rounded-3xl border border-border overflow-hidden shadow-2xl shadow-primary/5 bg-white">
                   <feature.Mockup />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Professional Feature Grid */}
        <div className="pt-20 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
            {secondaryFeatures.map((sFeature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  {sFeature.icon ? <sFeature.icon size={20} /> : <Zap size={20} />}
                </div>
                <h4 className="text-xl font-display font-bold text-primary mb-3">
                  {sFeature.title}
                </h4>
                <p className="text-muted-text font-medium leading-relaxed">
                  {sFeature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

