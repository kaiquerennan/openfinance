// Ícones SVG (stroke = currentColor; os da nav usam fill), estilo do app de referência.

import React from "react";

function Svg({
  children,
  size = 18,
  filled = false,
}: {
  children: React.ReactNode;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/* ——— Nav inferior (formas cheias) ——— */

export const IconHome = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M12 2.6c.5 0 1 .16 1.4.46l7 5.2c.7.5 1.1 1.3.9 2.15l-2.1 8.3a2.2 2.2 0 0 1-2.15 1.69H6.95a2.2 2.2 0 0 1-2.14-1.69l-2.1-8.3c-.21-.84.2-1.64.9-2.15l7-5.2c.4-.3.9-.46 1.39-.46Z" />
  </Svg>
);

export const IconArrows = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8 5v13" strokeWidth="2.4" />
    <path d="m4.6 14.5 3.4 3.6 3.4-3.6" strokeWidth="2.4" />
    <path d="M16 19V6" strokeWidth="2.4" />
    <path d="m12.6 9.5 3.4-3.6 3.4 3.6" strokeWidth="2.4" />
  </Svg>
);

export const IconBars = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} filled>
    <rect x="4" y="10" width="3.6" height="10" rx="1.8" />
    <rect x="10.2" y="4" width="3.6" height="16" rx="1.8" />
    <rect x="16.4" y="13" width="3.6" height="7" rx="1.8" />
  </Svg>
);

export const IconWallet = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.2 3 3 0 0 1 21 10v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5ZM5.5 7a.9.9 0 0 0 0 1.8H18A1.2 1.2 0 0 0 16.8 7H5.5Z" />
    <circle cx="16.6" cy="13.6" r="1.3" fill="#fff" />
  </Svg>
);

export const IconTrophy = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M7 3h10v2h3v2.5c0 2.2-1.6 4-3.7 4.4A5.5 5.5 0 0 1 13 15v2h2.5a1.5 1.5 0 0 1 0 3h-7a1.5 1.5 0 0 1 0-3H11v-2a5.5 5.5 0 0 1-3.3-3.1A4.6 4.6 0 0 1 4 7.5V5h3V3Zm-1 4v.5c0 1 .6 1.9 1.4 2.3L7 7H6Zm12 0h-1l-.4 2.8A2.6 2.6 0 0 0 18 7.5V7Z" />
  </Svg>
);

export const IconSparkle = ({ size = 22 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M12 3.5c.3 0 .55.2.63.48l1.05 3.83a3 3 0 0 0 2.1 2.1l3.84 1.06a.65.65 0 0 1 0 1.26l-3.83 1.05a3 3 0 0 0-2.1 2.1l-1.06 3.84a.65.65 0 0 1-1.26 0l-1.05-3.83a3 3 0 0 0-2.1-2.1l-3.84-1.06a.65.65 0 0 1 0-1.26l3.83-1.05a3 3 0 0 0 2.1-2.1l1.06-3.84A.65.65 0 0 1 12 3.5Z" />
    <path d="M19 2.8c.15 0 .27.1.31.24l.3 1.1a1.6 1.6 0 0 0 1.13 1.12l1.1.3a.33.33 0 0 1 0 .64l-1.1.3a1.6 1.6 0 0 0-1.12 1.13l-.3 1.1a.33.33 0 0 1-.64 0l-.3-1.1a1.6 1.6 0 0 0-1.13-1.12l-1.1-.3a.33.33 0 0 1 0-.64l1.1-.3a1.6 1.6 0 0 0 1.12-1.13l.3-1.1A.33.33 0 0 1 19 2.8Z" />
  </Svg>
);

/* ——— Header ——— */

export const IconTarget = ({ size = 20 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconGear = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" />
  </Svg>
);

export const IconPlus = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" strokeWidth="2.4" />
  </Svg>
);

/* ——— Utilitários ——— */

export const IconChevronRight = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="m9 5 7 7-7 7" strokeWidth="2.2" />
  </Svg>
);

export const IconChevronLeft = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="m15 5-7 7 7 7" strokeWidth="2.2" />
  </Svg>
);

export const IconUpDown = ({ size = 12 }: { size?: number }) => (
  <Svg size={size}>
    <path d="m7 9 5-5 5 5M7 15l5 5 5-5" strokeWidth="2.6" />
  </Svg>
);

export const IconSearch = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.8-3.8" />
  </Svg>
);

export const IconSliders = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 4v6M5 14v6M12 4v2M12 10v10M19 4v10M19 18v2" />
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="8" r="2" />
    <circle cx="19" cy="16" r="2" />
  </Svg>
);

export const IconPencil = ({ size = 16 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18l-4 1 1-4L17 3.5Z" />
  </Svg>
);

export const IconTrash = ({ size = 16 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 12.2a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.3l1-12.2" />
  </Svg>
);

export const IconCheck = ({ size = 16 }: { size?: number }) => (
  <Svg size={size}>
    <path d="m4.5 12.5 5 5 10-11" strokeWidth="2.4" />
  </Svg>
);

export const IconClock = ({ size = 14 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconX = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6 6 18" strokeWidth="2.2" />
  </Svg>
);

export const IconSync = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v5h-5" />
  </Svg>
);

export const IconLink = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M10 14a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.1" />
    <path d="M14 10a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.1" />
  </Svg>
);

/* ——— Menu ——— */

export const IconPie = ({ size = 20 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M11 3.2A9 9 0 1 0 20.8 13H11V3.2Z" />
    <path d="M13.5 2.5A9 9 0 0 1 21.5 10.5H13.5V2.5Z" />
  </Svg>
);

export const IconCalendarDots = ({ size = 20 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M7 2.5c.55 0 1 .45 1 1V4h8v-.5a1 1 0 1 1 2 0V4h.5A2.5 2.5 0 0 1 21 6.5v12A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4H6v-.5c0-.55.45-1 1-1ZM5 9v9.5c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5V9H5Z" />
    <circle cx="8" cy="12.5" r="1.1" fill="#fff" stroke="none" />
    <circle cx="12" cy="12.5" r="1.1" fill="#fff" stroke="none" />
    <circle cx="16" cy="12.5" r="1.1" fill="#fff" stroke="none" />
    <circle cx="8" cy="16.5" r="1.1" fill="#fff" stroke="none" />
    <circle cx="12" cy="16.5" r="1.1" fill="#fff" stroke="none" />
  </Svg>
);

export const IconFlow = ({ size = 20 }: { size?: number }) => (
  <Svg size={size} filled>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path
      d="m8 15.5 2-3 1.6 1.5 2.4-3.5 2 2.5"
      stroke="#fff"
      strokeWidth="1.6"
      fill="none"
    />
  </Svg>
);

export const IconCard = ({ size = 20 }: { size?: number }) => (
  <Svg size={size} filled>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <rect x="2.5" y="8.2" width="19" height="2.6" fill="#fff" opacity="0.9" />
    <rect x="5.5" y="14" width="5" height="1.8" rx="0.9" fill="#fff" />
  </Svg>
);

export const IconChat = ({ size = 20 }: { size?: number }) => (
  <Svg size={size} filled>
    <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9c-1.3 0-2.6-.28-3.7-.78L4 21l.9-4A9 9 0 0 1 12 3Z" />
  </Svg>
);
