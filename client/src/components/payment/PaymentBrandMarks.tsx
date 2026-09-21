import { cn } from "@/lib/utils";

type PaymentBrandMarksProps = {
  className?: string;
};

export function PaymentBrandMarks({ className }: PaymentBrandMarksProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} role="img" aria-label="RedotPay, USDT and USDC">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#14213d" />
        <path d="M10 22V10h6.2c3.6 0 5.8 1.6 5.8 4.4 0 2.1-1.3 3.6-3.5 4.2L22.8 22h-3.7l-3.8-3.1h-1.9V22H10Zm3.4-6h2.4c1.9 0 2.8-.5 2.8-1.6 0-1.1-.9-1.6-2.8-1.6h-2.4V16Z" fill="#fff" />
      </svg>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#26a17b" />
        <path d="M7.5 10h17v3.1h-6.7V22h-3.6v-8.9H7.5V10Zm3.2-3h10.6v2H10.7V7Z" fill="#fff" />
      </svg>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#eef6ff" stroke="#2775ca" />
        <path d="M18.8 9.5h-1.6v1.2c-2.7.3-4.3 1.8-4.3 3.8 0 2.3 1.9 3.1 4.3 3.7v2.1c-1.2-.2-2.2-.8-3.1-1.7l-1.4 1.6c1.1 1.1 2.6 1.8 4.5 2v1.3h1.6v-1.3c2.8-.3 4.3-1.8 4.3-3.8 0-2.3-1.9-3.1-4.3-3.7v-2.1c1 .2 1.8.6 2.6 1.2l1.3-1.7c-1-.8-2.3-1.3-3.9-1.5V9.5Zm-2.4 4.8c0-.6.3-1 1-1.2v2.4c-.7-.3-1-.6-1-1.2Zm3.4 3.9c0 .6-.4 1-1 1.2v-2.5c.7.3 1 .7 1 1.3Z" fill="#2775ca" />
      </svg>
    </div>
  );
}