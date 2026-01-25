import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RefreshCw, Package, Clock, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Returns() {
  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      <Navbar />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="pt-32 pb-24 container mx-auto px-4 max-w-4xl"
      >
        <h1 className="text-4xl font-serif mb-4">Returns & Exchanges</h1>
        <p className="text-muted-foreground mb-12 text-lg">
          We want you to love your INFINITE HOME products. If you're not completely satisfied, we're here to help.
        </p>

        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-center p-6 bg-secondary/20 border border-border"
          >
            <Clock className="mx-auto mb-4 text-primary" size={32} />
            <h3 className="font-serif text-lg mb-2">7-Day Returns</h3>
            <p className="text-sm text-muted-foreground">Return within 7 business days of delivery</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center p-6 bg-secondary/20 border border-border"
          >
            <Package className="mx-auto mb-4 text-primary" size={32} />
            <h3 className="font-serif text-lg mb-2">Original Packaging</h3>
            <p className="text-sm text-muted-foreground">Items must be unused and in original packaging</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center p-6 bg-secondary/20 border border-border"
          >
            <RefreshCw className="mx-auto mb-4 text-primary" size={32} />
            <h3 className="font-serif text-lg mb-2">Easy Exchanges</h3>
            <p className="text-sm text-muted-foreground">Exchange for different size or color</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center p-6 bg-secondary/20 border border-border"
          >
            <CheckCircle className="mx-auto mb-4 text-primary" size={32} />
            <h3 className="font-serif text-lg mb-2">Full Refund</h3>
            <p className="text-sm text-muted-foreground">Get your money back within 7 days</p>
          </motion.div>
        </div>
        
        <div className="prose prose-neutral max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">Return Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We accept returns within 7 business days of delivery for most items. Products must be unused, unwashed, 
              and in their original packaging with all tags attached. Returns are subject to inspection upon receipt.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Non-Returnable Items</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Items marked as final sale</li>
              <li>Items that have been used, washed, or altered</li>
              <li>Items without original packaging or tags</li>
              <li>Personal care products (for hygiene reasons)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">How to Return</h2>
            <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
              <li>Contact us at support@infinitehome.mv with your order number and reason for return</li>
              <li>Receive return authorization and instructions within 24 hours</li>
              <li>Pack the item securely in original packaging</li>
              <li>Ship the item back to us or arrange for pickup (within Male')</li>
              <li>Receive your refund within 7 business days of receiving the returned item</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Exchanges</h2>
            <p className="text-muted-foreground leading-relaxed">
              Want a different size or color? We're happy to exchange your item at no additional cost. 
              Contact us within 7 business days of delivery to initiate an exchange. If the new item is a different price, 
              we'll adjust accordingly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Damaged or Defective Items</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you receive a damaged or defective item, please contact us immediately at support@infinitehome.mv. 
              Include photos of the damage and your order number. We'll arrange for a replacement or full refund, 
              including shipping costs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Refund Method</h2>
            <p className="text-muted-foreground leading-relaxed">
              Refunds will be processed to the original payment method. For Cash on Delivery orders, 
              refunds will be made via bank transfer. Please allow 5-7 business days for the refund to appear 
              in your account.
            </p>
          </section>

          <section className="bg-primary/5 p-6 border border-primary/20">
            <h2 className="text-2xl font-serif mb-4">Need Help?</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our customer service team is here to help with any questions about returns or exchanges.
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong>Email:</strong> support@infinitehome.mv</li>
              <li><strong>Phone:</strong> 7840001</li>
              <li><strong>WhatsApp:</strong> 9607840001</li>
              <li><strong>Hours:</strong> Sunday - Thursday, 9:00 AM - 6:00 PM</li>
            </ul>
          </section>
        </div>
      </motion.div>

      <Footer />
    </div>
  );
}
