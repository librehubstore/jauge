/** Jauge : arc de cadran avec aiguille, sans référence à une marque existante. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 21l5-6" stroke="var(--accent-fg)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2" fill="var(--accent-fg)" />
    </svg>
  );
}
