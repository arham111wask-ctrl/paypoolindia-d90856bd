export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg font-bold ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-hero text-primary-foreground shadow-card">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <circle cx="9" cy="12" r="5" />
          <circle cx="15" cy="12" r="5" />
        </svg>
      </span>
      PayPool
    </span>
  );
}
