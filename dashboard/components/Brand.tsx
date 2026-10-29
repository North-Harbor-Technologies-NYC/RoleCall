// Brand marks, inline so the wordmark uses the page font (an <img> SVG cannot see web fonts).
// The mark is a geometric sketch from the 2026-10-29 handoff; redraw before a public launch.

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="11" fill="#2B7A50" />
      <polygon points="15,10.5 18.5,20 11.5,20" fill="#17150F" />
      <rect x="22" y="14" width="15" height="3.5" rx="1.75" fill="#FFFDF8" />
      <circle cx="15" cy="27" r="2.4" fill="#FFFDF8" opacity=".45" />
      <rect x="22" y="25.25" width="11" height="3.5" rx="1.75" fill="#FFFDF8" opacity=".45" />
      <circle cx="15" cy="35" r="2.4" fill="#FFFDF8" opacity=".45" />
      <rect x="22" y="33.25" width="13" height="3.5" rx="1.75" fill="#FFFDF8" opacity=".45" />
    </svg>
  );
}

export function Wordmark() {
  return <>Role<b>Call</b></>;
}

// North Harbor lockup D. Sidebar footer and sign-in footer only.
export function NorthHarbor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 229.42 47" role="img" aria-label="North Harbor Technologies">
      <rect x="0.5" y="0.5" width="228.42" height="46" fill="none" stroke="rgba(15,15,18,0.18)" strokeWidth="1" rx="2" />
      <text x="14" y="23.5" fontFamily="var(--rc-mono), ui-monospace, Menlo, monospace" fontWeight="400" fontSize="11" letterSpacing="3.08" fill="rgba(15,15,18,0.45)" dominantBaseline="central">NH · 25</text>
      <g transform="translate(94.22, 10.5)">
        <circle cx="13" cy="13" r="8.84" fill="none" stroke="#0F0F12" strokeWidth="0.9" />
        <circle cx="13" cy="13" r="4.862" fill="none" stroke="#0F0F12" strokeWidth="0.7" opacity="0.45" />
        <polygon points="2.2152,13 13,14.2376 23.7848,13 13,11.7624" fill="#0F0F12" opacity="0.5" />
        <polygon points="13,24.6688 14.5028,13 11.4972,13" fill="#0F0F12" opacity="0.92" />
        <polygon points="13,1.3312 14.5028,13 11.4972,13" fill="#6E8696" />
        <circle cx="13" cy="13" r="1.1492" fill="#0F0F12" />
      </g>
      <text x="174.82" y="18.6" fontFamily="var(--rc-font), Helvetica Neue, Helvetica, Arial, sans-serif" fontWeight="500" fontSize="14" letterSpacing="-0.35" fill="#0F0F12" textAnchor="middle" dominantBaseline="central">North Harbor</text>
      <text x="174.82" y="31.2" fontFamily="var(--rc-mono), ui-monospace, Menlo, monospace" fontWeight="400" fontSize="8" letterSpacing="1.28" fill="rgba(15,15,18,0.45)" textAnchor="middle" dominantBaseline="central">TECHNOLOGIES</text>
    </svg>
  );
}
