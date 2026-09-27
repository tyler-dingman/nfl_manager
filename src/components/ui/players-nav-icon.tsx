import type { LucideProps } from 'lucide-react';

export function PlayersNavIcon({ size = 24, strokeWidth = 1.8, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19" />
      <path d="M16 4.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 13.2a4.5 4.5 0 0 1 3 4.3V19" />
    </svg>
  );
}
