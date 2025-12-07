import { TrendingDown } from "lucide-react";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

export function Logo({ className = "", showTagline = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <TrendingDown className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold">Resolve</span>
        {showTagline && (
          <span className="text-xs text-muted-foreground">Re-solve the past. Resolve the future.</span>
        )}
      </div>
    </div>
  );
}
