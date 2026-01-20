import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Truck, Clock, MapPin, Package } from "lucide-react";

export default function Shipping() {
  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      <div className="pt-32 pb-24 container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-serif mb-4">Shipping Information</h1>
        <p className="text-muted-foreground mb-12 text-lg">
          We deliver throughout the Maldives with care and attention to every order.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="p-8 bg-primary/5 border border-primary/20">
            <Truck className="mb-4 text-primary" size={40} />
            <h3 className="font-serif text-2xl mb-2">Free Shipping</h3>
            <p className="text-muted-foreground">On orders over MVR 1,500</p>
          </div>
          <div className="p-8 bg-secondary/20 border border-border">
            <Clock className="mb-4 text-primary" size={40} />
            <h3 className="font-serif text-2xl mb-2">Fast Delivery</h3>
            <p className="text-muted-foreground">1-3 days within Male', 3-7 days to atolls</p>
          </div>
        </div>
        
        <div className="prose prose-neutral max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">Delivery Areas</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We deliver to all inhabited islands in the Maldives. Delivery times and rates vary by location:
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="border border-border p-4 text-left font-serif">Location</th>
                    <th className="border border-border p-4 text-left font-serif">Delivery Time</th>
                    <th className="border border-border p-4 text-left font-serif">Shipping Cost</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border border-border p-4">Male', Hulhumale', Villimale'</td>
                    <td className="border border-border p-4">1-2 business days</td>
                    <td className="border border-border p-4">MVR 50 (Free over MVR 1,500)</td>
                  </tr>
                  <tr className="bg-secondary/10">
                    <td className="border border-border p-4">Kaafu Atoll</td>
                    <td className="border border-border p-4">2-3 business days</td>
                    <td className="border border-border p-4">MVR 100 (Free over MVR 1,500)</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-4">Other Atolls</td>
                    <td className="border border-border p-4">3-7 business days</td>
                    <td className="border border-border p-4">MVR 150-300 based on location</td>
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
            <h2 className="text-2xl font-serif mb-4">Delivery Options</h2>
            <div className="space-y-4">
              <div className="p-4 border border-border">
                <h3 className="font-serif text-lg mb-2">Standard Delivery</h3>
                <p className="text-muted-foreground text-sm">
                  Package delivered to your door during business hours (9 AM - 6 PM).
                </p>
              </div>
              <div className="p-4 border border-border">
                <h3 className="font-serif text-lg mb-2">Express Delivery (Male' Area Only)</h3>
                <p className="text-muted-foreground text-sm">
                  Same-day delivery for orders placed before 12 PM. Additional MVR 50 charge.
                </p>
              </div>
            </div>
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
              <li>Please ensure someone is available to receive the package at the delivery address</li>
              <li>For large furniture items, we'll contact you to arrange a suitable delivery time</li>
              <li>Delivery to resorts may require additional coordination</li>
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
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
