import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Truck, Clock, MapPin, Package, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Shipping() {
  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      <Navbar />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="pt-32 pb-24 container mx-auto px-4 max-w-4xl"
      >
        <h1 className="text-4xl font-serif mb-4">Shipping Information</h1>
        <p className="text-muted-foreground mb-12 text-lg">
          We deliver throughout the Maldives with care and attention to every order.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="p-8 bg-primary/5 border border-primary/20"
          >
            <Truck className="mb-4 text-primary" size={40} />
            <h3 className="font-serif text-2xl mb-2">Male' & Hulhumale'</h3>
            <p className="text-muted-foreground">Free Standard Delivery within Male' and Hulhumale'</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="p-8 bg-secondary/20 border border-border"
          >
            <Zap className="mb-4 text-primary" size={40} />
            <h3 className="font-serif text-2xl mb-2">Express Delivery</h3>
            <p className="text-muted-foreground">Available in Male' & Hulhumale' (MVR 15-100)</p>
          </motion.div>
        </div>
        
        <div className="prose prose-neutral max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">Delivery Options</h2>
            <div className="space-y-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-6 border border-border bg-secondary/5"
              >
                <h3 className="font-serif text-xl mb-3 flex items-center gap-2">
                  <Truck size={20} className="text-primary" />
                  Standard Delivery
                </h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• <strong>Male' & Hulhumale:</strong> FREE Standard Delivery (1-3 business days)</li>
                  <li>• <strong>Boat/Vessel Delivery:</strong> We deliver to specified boats/vessels in Male' harbor (FREE)</li>
                  <li>• <strong>Atolls:</strong> Delivery to other islands is arranged via boat/courier (Charges apply)</li>
                  <li>• <strong>Timeline:</strong> 1-3 business days for Male' area; 3-7 business days for other islands via boat</li>
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-6 border border-primary/30 bg-primary/5"
              >
                <h3 className="font-serif text-xl mb-3 flex items-center gap-2">
                  <Zap size={20} className="text-primary" />
                  Express Delivery
                </h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• Currently available in <strong>Male'</strong> and <strong>Hulhumale'</strong> only</li>
                  <li>• Delivery within <strong>1-6 hours</strong> for orders placed before 10 PM</li>
                  <li>• Orders after 10 PM: Delivered next day morning (within 6 hours from 9 AM)</li>
                  <li>• Express charge: <strong>MVR 15-100</strong> depending on the item</li>
                  <li>• Express delivery option available at checkout</li>
                </ul>
              </motion.div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Delivery Areas</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We deliver to all inhabited islands in the Maldives. Delivery times vary by location:
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="border border-border p-4 text-left font-serif">Location</th>
                    <th className="border border-border p-4 text-left font-serif">Standard Delivery</th>
                    <th className="border border-border p-4 text-left font-serif">Express Available</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border border-border p-4">Male'</td>
                    <td className="border border-border p-4">1-3 business days (FREE)</td>
                    <td className="border border-border p-4 text-green-600 font-medium">Yes - 1-6 hours</td>
                  </tr>
                  <tr className="bg-secondary/10">
                    <td className="border border-border p-4">Hulhumale'</td>
                    <td className="border border-border p-4">1-3 business days (FREE)</td>
                    <td className="border border-border p-4 text-green-600 font-medium">Yes - 1-6 hours</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-4">Boat / Vessel</td>
                    <td className="border border-border p-4">Daily (FREE to Male' Harbor)</td>
                    <td className="border border-border p-4 text-muted-foreground">Not Available</td>
                  </tr>
                  <tr className="bg-secondary/10">
                    <td className="border border-border p-4">Other Atolls</td>
                    <td className="border border-border p-4">3-7 business days (Charges apply)</td>
                    <td className="border border-border p-4 text-muted-foreground">Not Available</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Order Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Orders are processed within 1-2 business days. Once shipped, you'll receive a tracking number 
              via SMS and email. Business days are Sunday through Thursday, excluding public holidays.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Track Your Order</h2>
            <p className="text-muted-foreground leading-relaxed">
              Track your order anytime using your order number on our <a href="/track" className="text-primary hover:underline">Track Order</a> page. 
              You'll also receive SMS updates at each stage of delivery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Important Notes</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Delivery times are estimates and may vary due to weather conditions or logistics</li>
              <li>Free delivery is currently limited to <strong>Male'</strong>, <strong>Hulhumale'</strong>, and <strong>Boats/Vessels</strong> at Male' harbor</li>
              <li>For Atoll deliveries via boat, the customer is responsible for boat hire/delivery charges unless otherwise specified</li>
              <li>Please ensure someone is available to receive the package at the delivery address or boat</li>
              <li>For large furniture items, we'll contact you to arrange a suitable delivery time</li>
              <li>Express delivery charges vary by product and are shown at checkout</li>
            </ul>
          </section>

          <section className="bg-primary/5 p-6 border border-primary/20">
            <h2 className="text-2xl font-serif mb-4">Questions About Shipping?</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Contact our customer service team for assistance:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong>Email:</strong> support@infinitehome.mv</li>
              <li><strong>Phone:</strong> 7840001</li>
              <li><strong>WhatsApp:</strong> 9607840001</li>
            </ul>
          </section>
        </div>
      </motion.div>

      <Footer />
    </div>
  );
}
