import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { motion } from "framer-motion";
import { Ruler, Clock, MessageCircle, CheckCircle, Bed, Sparkles } from "lucide-react";

export default function CustomMattress() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    length: "",
    width: "",
    thickness: "",
    notes: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `Custom Mattress Request:
Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Dimensions: ${formData.length}cm x ${formData.width}cm x ${formData.thickness}cm
Notes: ${formData.notes || 'None'}`;
    
    const whatsappUrl = `https://wa.me/9607840001?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />

      <div className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full mb-6">
              <Sparkles size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Made Just For You</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6">
              Couldn't Find Your Size?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              No worries! We'll create a mattress tailored exactly to your needs. 
              Whether it's an unusual bed frame or a unique space, we've got you covered.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-8"
            >
              <div className="space-y-6">
                <h2 className="font-serif text-2xl mb-4">Why Choose Custom?</h2>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Ruler className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Perfect Fit Guaranteed</h3>
                    <p className="text-muted-foreground">Your mattress will be crafted to your exact specifications, down to the centimeter.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bed className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Premium Materials</h3>
                    <p className="text-muted-foreground">Same high-quality materials as our standard range - just in your custom size.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Delivery Timeline</h3>
                    <p className="text-muted-foreground">Custom mattresses take <strong>45-90 days</strong> to craft and deliver. Quality takes time!</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Personal Consultation</h3>
                    <p className="text-muted-foreground">Our team will guide you through the process and answer all your questions.</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-6">
                <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                  <Clock size={18} />
                  Important: Delivery Time
                </h3>
                <p className="text-amber-700">
                  Custom mattresses require <strong>45-90 days</strong> for production and delivery. 
                  This ensures your mattress is crafted with precision and meets our quality standards.
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {submitted ? (
                <div className="bg-green-50 border border-green-200 p-8 text-center">
                  <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
                  <h3 className="font-serif text-2xl mb-2">Request Received!</h3>
                  <p className="text-muted-foreground mb-4">
                    Thank you for your interest. We've opened WhatsApp for you to send your request directly. 
                    Our team will get back to you within 24 hours with a quote.
                  </p>
                  <Button 
                    onClick={() => setSubmitted(false)}
                    variant="outline"
                    className="rounded-none"
                  >
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <div className="bg-secondary/30 p-8 border border-border">
                  <h2 className="font-serif text-2xl mb-6">Request Your Custom Size</h2>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Full Name</Label>
                      <Input 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="rounded-none"
                        required
                        data-testid="input-custom-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Email</Label>
                        <Input 
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="rounded-none"
                          required
                          data-testid="input-custom-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold">Phone</Label>
                        <Input 
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="rounded-none"
                          required
                          data-testid="input-custom-phone"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Mattress Dimensions (cm)</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Input 
                            type="number"
                            placeholder="Length"
                            value={formData.length}
                            onChange={(e) => setFormData({...formData, length: e.target.value})}
                            className="rounded-none"
                            required
                            data-testid="input-custom-length"
                          />
                          <span className="text-xs text-muted-foreground">Length</span>
                        </div>
                        <div>
                          <Input 
                            type="number"
                            placeholder="Width"
                            value={formData.width}
                            onChange={(e) => setFormData({...formData, width: e.target.value})}
                            className="rounded-none"
                            required
                            data-testid="input-custom-width"
                          />
                          <span className="text-xs text-muted-foreground">Width</span>
                        </div>
                        <div>
                          <Input 
                            type="number"
                            placeholder="Thickness"
                            value={formData.thickness}
                            onChange={(e) => setFormData({...formData, thickness: e.target.value})}
                            className="rounded-none"
                            required
                            data-testid="input-custom-thickness"
                          />
                          <span className="text-xs text-muted-foreground">Thickness</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold">Additional Notes (Optional)</Label>
                      <Textarea 
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        className="rounded-none min-h-[100px]"
                        placeholder="Any specific requirements, firmness preference, or questions?"
                        data-testid="input-custom-notes"
                      />
                    </div>

                    <div className="space-y-4">
                      <Button 
                        type="submit"
                        className="w-full rounded-none uppercase tracking-widest font-bold py-6"
                        data-testid="button-submit-custom"
                      >
                        <MessageCircle className="mr-2" size={18} />
                        Send Request via WhatsApp
                      </Button>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        By submitting, you agree to our terms and conditions for custom orders. 
                        Delivery takes 45-90 days after order confirmation.
                      </p>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-20 max-w-4xl mx-auto"
          >
            <h2 className="font-serif text-2xl text-center mb-8">Terms & Conditions for Custom Orders</h2>
            
            <div className="bg-secondary/20 border border-border p-8 space-y-4 text-sm text-muted-foreground">
              <div>
                <h3 className="font-bold text-foreground mb-2">1. Order Confirmation</h3>
                <p>Custom orders require a 50% deposit upon order confirmation. The remaining balance is due before delivery.</p>
              </div>
              
              <div>
                <h3 className="font-bold text-foreground mb-2">2. Production & Delivery Time</h3>
                <p>Custom mattresses take 45-90 days from order confirmation to delivery. This timeline allows for careful crafting and quality checks.</p>
              </div>
              
              <div>
                <h3 className="font-bold text-foreground mb-2">3. Non-Refundable</h3>
                <p>Due to the custom nature of these products, deposits are non-refundable once production has begun. Please ensure all measurements are accurate before confirming your order.</p>
              </div>
              
              <div>
                <h3 className="font-bold text-foreground mb-2">4. Measurement Accuracy</h3>
                <p>INFINITE HOME is not responsible for errors in customer-provided measurements. We recommend double-checking all dimensions before placing your order.</p>
              </div>
              
              <div>
                <h3 className="font-bold text-foreground mb-2">5. Warranty</h3>
                <p>Custom mattresses carry the same warranty as our standard products - 5 years against manufacturing defects.</p>
              </div>
              
              <div>
                <h3 className="font-bold text-foreground mb-2">6. Contact</h3>
                <p>For any questions about custom orders, please contact us at support@infinitehome.mv or WhatsApp 9607840001.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
