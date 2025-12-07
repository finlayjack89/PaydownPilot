export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <span className="text-xl font-bold text-primary-foreground">R</span>
      </div>
      <span className="text-xl font-bold">Resolve</span>
    </div>
  );
}
