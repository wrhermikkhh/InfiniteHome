import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Video } from "lucide-react";
import apparelImage from "@assets/generated_images/woman_in_beige_loungewear_reading.png";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  date: z.string().min(1, "Please select a preferred date"),
  topic: z.string().min(1, "Please tell us what you'd like to discuss"),
});

export default function Consultation() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      date: "",
      topic: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: "Request Received",
      description: "We'll be in touch shortly to confirm your virtual appointment.",
    });
    form.reset();
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      <div className="pt-32 pb-24 container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          
          <div className="space-y-8">
            <div>
              <span className="text-sm font-bold uppercase tracking-widest text-primary mb-2 block">Infinite Home Live</span>
              <h1 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">Virtual Styling Consultation</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Connect with our design experts from the comfort of your home. We'll walk you through our collections, help you mix and match colors, and answer any questions you have about our fabrics.
              </p>
            </div>

            <div className="bg-secondary/20 p-8 space-y-6 border border-border">
              <h3 className="font-serif text-xl">What to expect:</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Video className="mt-1 mr-4 text-primary shrink-0" size={20} />
                  <div>
                    <span className="font-bold block text-sm uppercase tracking-wide">Video Call</span>
                    <p className="text-sm text-muted-foreground">A 30-minute Zoom call with a dedicated stylist.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Calendar className="mt-1 mr-4 text-primary shrink-0" size={20} />
                  <div>
                    <span className="font-bold block text-sm uppercase tracking-wide">Flexible Scheduling</span>
                    <p className="text-sm text-muted-foreground">Choose a time that works for you, including evenings and weekends.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Clock className="mt-1 mr-4 text-primary shrink-0" size={20} />
                  <div>
                    <span className="font-bold block text-sm uppercase tracking-wide">Personalized Advice</span>
                    <p className="text-sm text-muted-foreground">Get tailored recommendations based on your sleep style and home decor.</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="aspect-video rounded-lg overflow-hidden relative">
              <img src={apparelImage} alt="Consultation" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="bg-white p-8 md:p-12 shadow-sm border border-border h-fit sticky top-32">
            <h2 className="text-2xl font-serif mb-6">Book Your Appointment</h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} className="rounded-none border-border focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest">Email</FormLabel>
                        <FormControl>
                          <Input placeholder="email@example.com" {...field} className="rounded-none border-border focus-visible:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest">Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+960..." {...field} className="rounded-none border-border focus-visible:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest">Preferred Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="rounded-none border-border focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest">What are you looking for?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="I'm interested in bamboo sheets..." 
                          className="resize-none rounded-none border-border focus-visible:ring-primary min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-12 rounded-none uppercase tracking-widest font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                  Request Appointment
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
