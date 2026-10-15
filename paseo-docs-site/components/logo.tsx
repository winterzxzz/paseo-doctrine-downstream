/** Three stops in the SLP colors: Supervisor, Lead, Peer. */
export function Logo({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#111211" />
      <circle cx="12" cy="7" r="2.4" fill="#c06c9a" />
      <circle cx="12" cy="12.5" r="2.4" fill="#e0a458" />
      <circle cx="12" cy="18" r="2.4" fill="#7fa8bd" />
    </svg>
  );
}
