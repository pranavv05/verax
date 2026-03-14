import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductAnimation from "@/components/ProductAnimation";
import Features from "@/components/Features";
import { CTA, Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen selection:bg-accent/30 selection:text-primary">
      <Navbar />
      
      <Hero />
      
      <ProductAnimation />
      
      <Features />

      
      {/* Enterprise Capabilities Section */}
      <section id="enterprise" className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(74,124,89,0.15),transparent_70%)]" />
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-8">Engineered for Scale.</h2>
            <p className="text-xl text-primary-foreground/70 mb-16 max-w-2xl mx-auto">
              We go beyond just extracting data. Verax provides the enterprise-grade foundation your firm needs to grow confidently without compromising security or client experience.
            </p>

            <div className="grid md:grid-cols-3 gap-12 text-left">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold">Bank-Grade Security</h4>
                <p className="text-primary-foreground/60 leading-relaxed">Financial data demands uncompromising protection. We utilize AES-256 encryption at rest and TLS 1.3 in transit, ensuring complete data sovereignty and peace of mind.</p>
              </div>
              
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold">White-Label Experience</h4>
                <p className="text-primary-foreground/60 leading-relaxed">It's your firm, your clients, and your brand. The entire client-facing portal and magic link flow can be customized with your logo and firm colors.</p>
              </div>

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold">Infinite Scalability</h4>
                <p className="text-primary-foreground/60 leading-relaxed">Whether you are processing 50 invoices a month or 50,000, our cloud-native engine scales elastically. Grow your client base without linearly growing your headcount.</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <CTA />
      <Footer />
    </main>
  );
}
