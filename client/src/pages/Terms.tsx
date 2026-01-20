import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      <div className="pt-32 pb-24 container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-serif mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>
        
        <div className="prose prose-neutral max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using INFINITE HOME's website and services, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">2. Products and Pricing</h2>
            <p className="text-muted-foreground leading-relaxed">
              All prices are displayed in Maldivian Rufiyaa (MVR). We reserve the right to modify prices at any time without prior notice. 
              Product availability is subject to change. We make every effort to display accurate product descriptions and images.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">3. Orders and Payment</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you place an order, you are making an offer to purchase products. We reserve the right to accept or decline your order. 
              Payment must be completed via our accepted methods: Cash on Delivery (COD) or Bank Transfer. For bank transfers, 
              order processing begins after payment verification.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">4. Shipping and Delivery</h2>
            <p className="text-muted-foreground leading-relaxed">
              We currently deliver throughout the Maldives. Delivery times vary based on location. Free shipping is available 
              for orders over MVR 1,500. We are not responsible for delays caused by circumstances beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">5. Returns and Refunds</h2>
            <p className="text-muted-foreground leading-relaxed">
              Please refer to our Returns & Exchanges policy for detailed information about our return process. 
              Generally, unused items in original packaging may be returned within 30 days of delivery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">6. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content on this website, including text, graphics, logos, and images, is the property of INFINITE HOME 
              and is protected by intellectual property laws. Unauthorized use is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              INFINITE HOME shall not be liable for any indirect, incidental, or consequential damages arising from the use 
              of our products or services. Our liability is limited to the purchase price of the products.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">8. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, please contact us at:
            </p>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              <li>Email: support@infinitehome.mv</li>
              <li>Phone: 7840001</li>
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
