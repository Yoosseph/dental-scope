/** Original line icons (24px grid, 1.6 stroke). */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m6 12.5 4 4 8-9" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l16 16M9.6 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.2 7.6A15.7 15.7 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1" />
  </Svg>
);
export const IconGhost = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" strokeDasharray="2.2 2.4" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" fillOpacity={0.25} stroke="none" />
  </Svg>
);
export const IconIsolate = (p: P) => (
  <Svg {...p}>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconFocus = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);
export const IconReset = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
    <path d="M4.5 4.5V9H9" />
  </Svg>
);
export const IconRotate = (p: P) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="9" ry="4" />
    <path d="m16 5.6 2 2.4-2.6 1.4" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
  </Svg>
);
export const IconTree = (p: P) => (
  <Svg {...p}>
    <path d="M5 4v14a2 2 0 0 0 2 2h3M5 9h5M5 14h5" />
    <rect x="12" y="6.5" width="8" height="5" rx="1.2" />
    <rect x="12" y="11.5" width="8" height="5" rx="1.2" transform="translate(0 5)" />
  </Svg>
);
export const IconWarning = (p: P) => (
  <Svg {...p}>
    <path d="M12 4 21 19.5H3Z" />
    <path d="M12 10v4.5M12 17h.01" />
  </Svg>
);
export const IconSection = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v18" strokeDasharray="2 2" />
    <path d="M12 6c-4 0-6 2.7-6 6s2 6 6 6" />
    <path d="M12 6c4 0 6 2.7 6 6s-2 6-6 6" opacity={0.35} />
  </Svg>
);
export const IconLabel = (p: P) => (
  <Svg {...p}>
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9.4l4.6 5-4.6 5H5.5A1.5 1.5 0 0 1 4 13.5z" />
    <path d="M8 19v-4" />
    <circle cx="8" cy="20" r=".8" fill="currentColor" />
  </Svg>
);
export const IconExplode = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="6" height="6" rx="1.2" />
    <path d="M5 5l2.5 2.5M19 5l-2.5 2.5M5 19l2.5-2.5M19 19l-2.5-2.5" />
  </Svg>
);
export const IconTooth = (p: P) => (
  <Svg {...p}>
    <path d="M7.3 3.9c1.6-.6 3.1-.1 4.7.6 1.6-.7 3.1-1.2 4.7-.6 2 .8 2.3 3.4 1.6 5.6-.6 2-1 3.6-1.3 5.8-.2 1.1-1.5 1.2-1.8.2l-1.3-4.2c-.4-1-1.6-1-1.9 0L10.7 15.5c-.3 1-1.6.9-1.8-.2-.3-2.2-.7-3.8-1.3-5.8-.7-2.2-.4-4.8 1.7-5.6z" />
  </Svg>
);
export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
  </Svg>
);
export const IconFlip = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v18M8 7 4 12l4 5M16 7l4 5-4 5" />
  </Svg>
);
export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  </Svg>
);
/** Fixed orbit: a ring around a fixed centre point. */
export const IconOrbitFixed = (p: P) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="8.5" ry="4" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <path d="m18.5 6.8 1.6 1.6-2.2.6" />
  </Svg>
);
/** Free orbit: a pivot that can be moved. */
export const IconOrbitFree = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
    <path d="m10.5 5 1.5-1.5L13.5 5M10.5 19l1.5 1.5 1.5-1.5M5 10.5 3.5 12 5 13.5M19 10.5l1.5 1.5-1.5 1.5" />
  </Svg>
);
