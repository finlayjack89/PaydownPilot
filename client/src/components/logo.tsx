import { TrendingDown } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <TrendingDown className="h-6 w-6 text-primary-foreground" />
      </div>
      <span className="text-xl font-bold">Paydown Pilot</span>
    </div>
  );
}
