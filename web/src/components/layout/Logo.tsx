import { useId } from 'react';

export function LogoMark({ className = 'size-7' }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--c-accent)" />
          <stop offset="1" stopColor="var(--c-violet)" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 4.5 7v8.4c0 6.9 4.8 12.4 11.5 14.1 6.7-1.7 11.5-7.2 11.5-14.1V7L16 2.5Z"
        fill={`url(#${id})`}
        opacity="0.16"
      />
      <path
        d="M16 2.5 4.5 7v8.4c0 6.9 4.8 12.4 11.5 14.1 6.7-1.7 11.5-7.2 11.5-14.1V7L16 2.5Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 15.5h13" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 19.5h8" stroke="var(--c-violet)" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
      <path d="M13.5 11.5h5" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
