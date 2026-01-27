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
    title: "Kind to You & the Planet",
    description: "Here's something amazing - bamboo grows up to 3 feet per day without any pesticides! It needs very little water and regenerates from its own roots. When you choose bamboo, you're making a choice that feels good in every way."
  },
  {
    icon: Droplets,
    title: "Stay Dry All Night",
    description: "Ever wake up feeling sticky? Bamboo wicks away moisture 3x faster than cotton. That means no more clammy nights - just fresh, comfortable sleep from dusk till dawn. Perfect for our beautiful Maldivian climate!"
  },
  {
    icon: Wind,
    title: "Your Perfect Temperature",
    description: "Tired of throwing off the covers then pulling them back on? Bamboo's clever micro-gaps let air flow naturally - keeping you cool when it's warm and cozy when it's chilly. It's like magic!"
  },
  {
    icon: Shield,
    title: "A Dream for Sensitive Sleepers",
    description: "If allergies or sensitive skin keep you up at night, bamboo is your new best friend. It naturally resists dust mites, bacteria, and mold. Many customers with eczema tell us they finally sleep peacefully!"
  }
];

const faqs = [
  {
    question: "What makes bamboo bedding different from cotton?",
    answer: "Great question! Think of it this way - bamboo is like cotton's cooler, softer cousin. It's naturally silky and gets even softer with each wash (yes, really!). While cotton can feel a bit rough over time, bamboo stays luxuriously smooth. Plus, it absorbs moisture 40% better than cotton - so you stay dry and comfy all night long."
  },
  {
    question: "Is bamboo bedding good for sensitive skin?",
    answer: "Absolutely! If your skin is easily irritated, bamboo will be your new best friend. It's naturally gentle, hypoallergenic, and antibacterial. The super-smooth fibers glide against your skin instead of causing friction. Many of our customers with eczema and sensitive skin have told us bamboo changed their sleep for the better!"
  },
  {
    question: "How do I care for bamboo bedding?",
    answer: "Good news - it's super easy! Just pop them in the washing machine on cold or warm (not hot), use a gentle detergent, and skip the bleach and fabric softener (they don't need it!). Tumble dry on low or line dry. Here's the best part - your bamboo sheets will actually get softer with every wash. How cool is that?"
  },
  {
    question: "Will bamboo bedding keep me cool at night?",
    answer: "Oh yes! This is where bamboo really shines, especially for us here in the Maldives. The tiny micro-gaps in bamboo fabric let air flow through beautifully, while wicking moisture away 3-4 times faster than cotton. Say goodbye to sweaty, uncomfortable nights and hello to refreshing sleep!"
  },
  {
    question: "Is bamboo bedding worth it?",
    answer: "We think so! Here's why: bamboo lasts 2-3 times longer than regular cotton with proper care, it's amazing for the environment, and honestly, the comfort is unmatched. Once you experience that silky-smooth feeling, you'll wonder how you ever slept without it. It's an investment in better sleep - and that's priceless!"
  },
  {
    question: "Does bamboo bedding shrink?",
    answer: "Don't worry! Our bamboo bedding is pre-shrunk during manufacturing, so you won't have any surprises. Just follow the simple care instructions - wash in cold or warm water and avoid high heat in the dryer - and your sheets will stay perfect wash after wash."
  },
  {
    question: "Is bamboo bedding eco-friendly?",
    answer: "Yes, and this is something we're really proud of! Bamboo grows incredibly fast (up to 3 feet per day - that's not a typo!), needs no pesticides, uses very little water, and regenerates from its own roots. When you choose bamboo, you're choosing luxury that's kind to our beautiful planet."
  },
  {
    question: "What about thread count in bamboo sheets?",
    answer: "Here's a little secret - thread count matters less with bamboo! Because bamboo fibers are naturally finer and smoother, a 300 thread count bamboo sheet feels softer than a 600 thread count cotton sheet. What matters more is that it's 100% bamboo viscose - which all our bedding is!"
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
            <h2 className="text-3xl md:text-4xl font-serif mb-6">Why We're Obsessed with Bamboo</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Let us tell you a little secret - once you sleep on bamboo, there's no going back! 
              It's incredibly soft (think silky-smooth against your skin), naturally keeps you cool 
              on warm Maldivian nights, and it's amazing for the environment too. We truly believe 
              bamboo bedding is one of the best upgrades you can make for your sleep. Ready to 
              find out why?
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
              <h2 className="text-3xl md:text-4xl font-serif mb-4">The Magic Behind Bamboo</h2>
              <p className="text-muted-foreground">Here's what makes it so special</p>
            </div>

            <div className="prose prose-lg max-w-none text-foreground">
              <p className="text-muted-foreground leading-relaxed mb-6">
                Ever wondered how bamboo becomes such incredibly soft bedding? It all starts with 
                bamboo plants being transformed into silky-smooth fibers called bamboo viscose. 
                The result? Fabric that feels like a dream against your skin - and it only gets 
                softer with every wash!
              </p>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Here's where it gets really clever - bamboo fibers have tiny micro-gaps that work 
                like nature's own air conditioning. These little gaps let air flow through while 
                absorbing moisture 3-4 times better than cotton. That's why you stay cool, dry, 
                and comfortable all night long - even on the warmest nights.
              </p>

              <p className="text-muted-foreground leading-relaxed mb-6">
                But wait, there's more! Bamboo naturally contains something called "bamboo kun" - 
                a built-in antimicrobial agent that fights bacteria and keeps things fresh. This 
                means your bedding stays cleaner between washes, and it's perfect for anyone with 
                allergies or sensitive skin.
              </p>

              <p className="text-muted-foreground leading-relaxed font-medium">
                It's also kind to your hair and skin! The smooth surface means less friction, 
                so you wake up without crazy bed hair or sleep creases on your face. Your morning 
                routine just got a whole lot easier!
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
              <h2 className="text-3xl md:text-4xl font-serif mb-4">Got Questions? We've Got Answers!</h2>
              <p className="text-muted-foreground">Everything you're curious about bamboo bedding</p>
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
            <h2 className="text-3xl md:text-4xl font-serif mb-6">Ready to Sleep Like Never Before?</h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Join the bamboo bedding revolution! Experience the silky softness, 
              stay cool all night, and wake up feeling refreshed. Trust us - 
              your best sleep is waiting.
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
