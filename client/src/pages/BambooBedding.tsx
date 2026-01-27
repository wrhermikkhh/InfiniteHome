import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Leaf, Droplets, Wind, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import heroImage from "@assets/generated_images/luxury_bright_bedroom_with_white_bamboo_sheets.png";

const benefits = [
  {
    icon: Leaf,
    title: "Eco-Friendly & Sustainable",
    description: "Bamboo is one of the fastest-growing plants on Earth, requiring no pesticides and minimal water. It regenerates naturally, making it one of the most sustainable materials available."
  },
  {
    icon: Droplets,
    title: "Moisture-Wicking",
    description: "Bamboo fibers naturally wick moisture away from your body, keeping you dry and comfortable throughout the night. Perfect for hot sleepers and humid climates."
  },
  {
    icon: Wind,
    title: "Temperature Regulating",
    description: "The micro-gaps in bamboo fabric allow for superior breathability, keeping you cool in summer and warm in winter. It adapts to your body temperature for optimal comfort."
  },
  {
    icon: Shield,
    title: "Naturally Hypoallergenic",
    description: "Bamboo contains a natural bio-agent called 'bamboo kun' that resists bacteria, mold, and dust mites. Ideal for sensitive skin and allergy sufferers."
  }
];

const faqs = [
  {
    question: "What makes bamboo bedding different from cotton?",
    answer: "Bamboo bedding is softer, more breathable, and more sustainable than traditional cotton. Bamboo fibers are naturally silky and become softer with each wash, while cotton can feel rough over time. Bamboo is also 40% more absorbent than cotton, making it better at wicking moisture and regulating temperature."
  },
  {
    question: "Is bamboo bedding good for sensitive skin?",
    answer: "Absolutely! Bamboo is naturally hypoallergenic and antibacterial. It's gentle on sensitive skin and doesn't irritate like some synthetic materials. The smooth fibers are also less likely to cause friction, making them ideal for people with eczema or other skin conditions."
  },
  {
    question: "How do I care for bamboo bedding?",
    answer: "Bamboo bedding is easy to care for. Wash in cold or warm water (not hot) on a gentle cycle. Use a mild, eco-friendly detergent and avoid bleach or fabric softeners. Tumble dry on low heat or line dry. Bamboo sheets become softer with each wash!"
  },
  {
    question: "Will bamboo bedding keep me cool at night?",
    answer: "Yes! Bamboo is excellent at temperature regulation. The natural micro-gaps in bamboo fabric allow for exceptional breathability. It wicks moisture away 3-4 times faster than cotton, keeping hot sleepers cool and comfortable throughout the night."
  },
  {
    question: "Is bamboo bedding worth the investment?",
    answer: "Bamboo bedding is a worthwhile investment for several reasons: it's more durable than cotton (lasting 2-3 times longer with proper care), it's better for the environment, and it provides superior comfort. The initial cost is offset by its longevity and the improved quality of sleep you'll experience."
  },
  {
    question: "Does bamboo bedding shrink?",
    answer: "High-quality bamboo bedding like ours is pre-shrunk during manufacturing. However, to prevent any potential shrinkage, we recommend washing in cold or warm water and avoiding high heat in the dryer. Following care instructions will keep your sheets in perfect condition."
  },
  {
    question: "Is bamboo bedding sustainable?",
    answer: "Bamboo is one of the most sustainable materials on the planet. It grows incredibly fast (up to 3 feet per day!), requires no pesticides, needs minimal water, and regenerates from its own roots. Choosing bamboo bedding helps reduce your environmental footprint without compromising on luxury."
  },
  {
    question: "What thread count should I look for in bamboo sheets?",
    answer: "Unlike cotton, thread count isn't the best measure of quality for bamboo sheets. Bamboo fibers are naturally finer and smoother, so a 300 thread count bamboo sheet will feel softer than a 600 thread count cotton sheet. Look for 100% bamboo viscose or bamboo lyocell for the best quality."
  }
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left hover:text-primary transition-colors"
        data-testid={`faq-toggle-${question.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
      >
        <span className="font-medium text-lg pr-4">{question}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="pb-6"
        >
          <p className="text-muted-foreground leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function BambooBedding() {
  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />

      <section className="relative h-[60vh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Bamboo Bedding"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="relative h-full container mx-auto px-4 flex flex-col justify-center items-center text-center text-white">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="uppercase tracking-[0.2em] text-sm font-medium mb-4"
          >
            Discover the Difference
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-medium leading-tight"
          >
            The Magic of <br /> Bamboo Bedding
          </motion.h1>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif mb-6">Why Choose Bamboo?</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Bamboo bedding has revolutionized the way we sleep. Known for its incredible softness, 
              natural breathability, and eco-friendly properties, bamboo fabric offers a luxurious 
              sleeping experience while being kind to our planet. Once you experience the silky 
              smoothness of bamboo sheets, you'll never want to go back.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-6"
              >
                <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <benefit.icon size={28} className="text-primary" />
                </div>
                <h3 className="font-serif text-xl mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif mb-4">The Science Behind Bamboo</h2>
              <p className="text-muted-foreground">Understanding what makes bamboo special</p>
            </div>

            <div className="prose prose-lg max-w-none text-foreground">
              <p className="text-muted-foreground leading-relaxed mb-6">
                Bamboo fabric is created through a process that transforms raw bamboo into soft, 
                silky fibers. The most common method produces bamboo viscose (also called bamboo rayon), 
                which retains many of bamboo's natural benefits while being incredibly soft to the touch.
              </p>

              <p className="text-muted-foreground leading-relaxed mb-6">
                The unique structure of bamboo fibers contains micro-gaps that provide superior 
                ventilation and moisture absorption. This natural architecture means bamboo bedding 
                can absorb 3-4 times more moisture than cotton, keeping you dry and comfortable all night.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Additionally, bamboo contains a natural antimicrobial agent called "bamboo kun" that 
                helps the plant resist fungi and bacteria during growth. This property is partially 
                retained in bamboo fabric, contributing to its hypoallergenic qualities and helping 
                bedding stay fresher between washes.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif mb-4">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">Everything you need to know about bamboo bedding</p>
            </div>

            <div className="divide-y divide-border border-t border-border">
              {faqs.map((faq) => (
                <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-serif mb-6">Ready to Experience the Difference?</h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Transform your sleep with our premium bamboo bedding collection. 
              Feel the softness, breathe easier, and wake up refreshed.
            </p>
            <Link href="/shop?category=Bedding">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-white/90 rounded-none h-14 px-10 text-xs uppercase tracking-widest font-bold"
                data-testid="button-shop-bamboo"
              >
                Shop Bamboo Bedding
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
