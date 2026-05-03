// Workout screen icons — faithful copies of workout-screen.jsx SVG paths.

type IconProps = { color: string; size?: number };

export function IconBack({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 4L6.5 10l6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWifi({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1.5 6c3.6-3.3 9.4-3.3 13 0M3.8 8.5c2.3-2.1 6.1-2.1 8.4 0M6.1 11c1-.9 2.8-.9 3.8 0"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="13.5" r="1" fill={color} />
    </svg>
  );
}

export function IconWifiOff({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1.5 6c1.4-1.3 3.1-2.1 4.9-2.5M9.7 3.6c1.9.4 3.7 1.3 5.1 2.6M3.8 8.5c.7-.7 1.6-1.2 2.5-1.6M9.5 6.9c1 .3 2 .9 2.7 1.6M6.1 11c1-.9 2.8-.9 3.8 0"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="13.5" r="1" fill={color} />
      <path d="M2 2l12 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevron({ color, dir = 'right' }: { color: string; dir?: 'left' | 'right' }) {
  const d = dir === 'right' ? 'M7 4l5 5-5 5' : 'M11 4L6 9l5 5';
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d={d} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlay({ color, size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <path d="M9 6l13 8-13 8V6z" fill={color} />
    </svg>
  );
}

export function IconCheck({ color, size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12 13 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.5" />
      <path d="M8 4.5V8l2.4 1.4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconFlame({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 14c2.8 0 4.5-1.9 4.5-4.3 0-2.4-1.8-3.6-2.5-5.5-.4 1.4-1.4 1.9-2 2.5-.4-1.2.4-3-.5-4.7-.4 2-2.5 3.2-3 5.6-.5 2.7 1 6.4 3.5 6.4z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrophy({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 3h8v3a4 4 0 11-8 0V3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path
        d="M4 4H2v1.5A2 2 0 004 7.5M12 4h2v1.5a2 2 0 01-2 2M6.5 11h3v2H11v1H5v-1h1.5v-2z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function IconTrophyFilled({ color, accentInk }: { color: string; accentInk: string }) {
  return (
    <svg width="58" height="58" viewBox="0 0 16 16" fill="none">
      <path d="M4 3h8v3a4 4 0 11-8 0V3z" fill={accentInk} />
      <path
        d="M4 4H2v1.5A2 2 0 004 7.5M12 4h2v1.5a2 2 0 01-2 2M6.5 11h3v2H11v1H5v-1h1.5v-2z"
        stroke={accentInk}
        strokeWidth="1"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="0" y="0" width="0" height="0" fill={color} />
    </svg>
  );
}

export function IconRunner({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="10" cy="3" r="1.5" fill={color} />
      <path
        d="M5 14l2-3 2 1 1.5-3.5L13 11M3.5 8.5h2L7 6l3 .5 1.5 1.5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDumbbell({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 6v4M4 4v8M12 4v8M14 6v4M4 8h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSwim({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 11c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0M1 13.5c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="11" cy="5" r="1.3" fill={color} />
      <path d="M3 9l3-2 2 1.5L10 7" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Bottom-tab icons
export function TabIconDumb({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9v6M5.5 6.5v11M18.5 6.5v11M21 9v6M5.5 12h13" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function TabIconChart({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3M20 16v-7"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function TabIconFlag({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 3v18M5 4h12l-2 4 2 4H5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function TabIconUser({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.5" stroke={color} strokeWidth="1.7" />
      <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
