/** A path through three stops: the daemon in the middle, a client on each side. */
export function Logo({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#111211" />
      <path d="M5.5 15.5c2.2 0 2.8-7 6.5-7s4.3 7 6.5 7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8.5" r="2" fill="#1f6fe5" />
    </svg>
  );
}
