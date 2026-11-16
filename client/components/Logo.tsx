import { useId } from 'react';

export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const bgGradId = `edugenius-bg-${uid}`;
  const capGradId = `edugenius-cap-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={bgGradId}
          x1="12"
          y1="10"
          x2="90"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#463BFF" />
          <stop offset="55%" stopColor="#522DF6" />
          <stop offset="100%" stopColor="#631CE8" />
        </linearGradient>

        <linearGradient
          id={capGradId}
          x1="46"
          y1="26"
          x2="66"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="38%" stopColor="#FFFFFF" />
          <stop offset="72%" stopColor="#2EE89B" />
          <stop offset="100%" stopColor="#00E285" />
        </linearGradient>
      </defs>

      {/* Rounded squircle badge */}
      <rect x="2" y="2" width="96" height="96" rx="28" fill={`url(#${bgGradId})`} />

      {/* Emerald droplet hanging from the right side of the cap */}
      <path
        d="M69.2 33.5C69.8 36.2 69.6 39.2 68.7 41.9C67.8 44.5 67.4 46.8 68.4 48.6C69.4 50.2 71.9 50.4 73.1 48.9C74.5 47.2 74.1 44.6 73.1 41.8C72.2 39.2 72.1 36.1 72.7 33.4L69.2 33.5Z"
        fill="#00E285"
      />

      {/* Top arched cap transitioning from white on the left to emerald on the right */}
      <path
        d="M24.6 31.1C33.4 28.4 42.1 25.4 49.9 25.3C58.2 25.2 68.2 27.6 74.7 30.8C77.2 32.0 77.6 34.4 75.8 35.6C73.9 36.8 70.6 36.4 67.5 34.9C61.8 32.1 55.6 28.5 50.0 28.3C42.5 28.1 34.1 31.3 25.8 33.8L24.6 31.1Z"
        fill={`url(#${capGradId})`}
      />

      {/* Crisp geometric white "A" */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 28.1L69.8 73.1L64.8 75.2L58.7 61.3H41.3L35.2 75.2L30.2 73.1L50 28.1ZM50 39.6L43.4 55.8H56.6L50 39.6Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
