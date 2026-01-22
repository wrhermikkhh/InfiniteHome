import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      <Navbar />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="pt-32 pb-24 container mx-auto px-4 max-w-4xl"
      >
        <h1 className="text-4xl font-serif mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>
        
        <div className="prose prose-neutral max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us when you create an account, place an order, 
              or contact us. This includes your name, email address, phone number, shipping address, and payment information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Respond to your questions and requests</li>
              <li>Improve our products and services</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share your information 
              with trusted service providers who assist us in operating our website and delivering products to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate security measures to protect your personal information. However, no method of 
              transmission over the internet is 100% secure. We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our website uses cookies to enhance your browsing experience. Cookies help us remember your preferences 
              and understand how you use our site. You can disable cookies in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal information. To exercise these rights, 
              please contact us at support@infinitehome.mv.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              <li>Email: support@infinitehome.mv</li>
              <li>Phone: 7840001</li>
            </ul>
          </section>
        </div>
      </motion.div>

      <Footer />
    </div>
  );
}
