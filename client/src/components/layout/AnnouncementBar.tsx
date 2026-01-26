import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Announcement {
  text: string;
  link?: string;
}

const announcements: Announcement[] = [
  { text: "Free Delivery on All Orders Throughout Maldives!", link: "/shipping" },
  { text: "Express Delivery Available in Male' & Hulhumale'", link: "/shipping" },
  { text: "30-Day Free Returns & Exchanges", link: "/returns" },
];

export function AnnouncementBar() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (announcements.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  const current = announcements[currentIndex];

  return (
    <div className="bg-primary text-primary-foreground py-2.5 px-4 relative overflow-hidden">
      <div className="container mx-auto flex items-center justify-center">
        <div className="flex items-center gap-2 animate-in fade-in duration-300" key={currentIndex}>
          {current.link ? (
            <a 
              href={current.link}
              className="text-xs sm:text-sm font-medium tracking-wide text-center hover:underline underline-offset-2 transition-all"
              data-testid="link-announcement"
            >
              {current.text}
            </a>
          ) : (
            <span className="text-xs sm:text-sm font-medium tracking-wide text-center">
              {current.text}
            </span>
          )}
        </div>
        
        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-4 p-1 hover:opacity-70 transition-opacity"
          aria-label="Close announcement"
          data-testid="button-close-announcement"
        >
          <X size={16} />
        </button>
      </div>
      
      {announcements.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          {announcements.map((_, i) => (
            <div 
              key={i} 
              className={`w-1 h-1 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
