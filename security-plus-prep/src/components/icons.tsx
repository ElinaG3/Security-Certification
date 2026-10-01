// Inline stroke-SVG icon set — no emoji, no icon font, no external
// dependency. Every icon shares the same viewBox/stroke conventions so
// they drop in at any size via the `size` prop.

export interface IconProps {
  size?: number;
  className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function HomeIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function BookIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z" />
    </svg>
  );
}

export function TargetIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function UserIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PlusIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function FlagIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M5 3v18" />
      <path d="M5 4h11.5a1 1 0 0 1 .8 1.6L14.5 9l2.8 3.4a1 1 0 0 1-.8 1.6H5" />
    </svg>
  );
}

export function BookOpenIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M12 6.5c-1.6-1.2-4-1.8-8-1.8v13c4 0 6.4.6 8 1.8" />
      <path d="M12 6.5c1.6-1.2 4-1.8 8-1.8v13c-4 0-6.4.6-8 1.8" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function BrainIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M9 4.5a2.5 2.5 0 0 0-2.5 2.5v.3A3 3 0 0 0 4 10a3 3 0 0 0 1 5.6V17a2.5 2.5 0 0 0 2.5 2.5 2 2 0 0 0 2-2V6.5A2 2 0 0 0 9 4.5Z" />
      <path d="M15 4.5a2.5 2.5 0 0 1 2.5 2.5v.3A3 3 0 0 1 20 10a3 3 0 0 1-1 5.6V17a2.5 2.5 0 0 1-2.5 2.5 2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function ClockIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CheckIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function CalendarIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function TranslateIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9Z" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}
