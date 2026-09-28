// Empty-state illustrations for the Vault sections, drawn in the style of the
// ReUI c-empty patterns: inline SVG, theme tokens only (border, muted,
// muted-foreground), so they follow light/dark mode with no image assets.

const svgProps = {
  width: 200,
  height: 130,
  viewBox: '0 0 200 130',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
} as const;

/** API keys: a key card with a masked secret, like a payment card for a key. */
export function ApiKeyIllustration() {
  return (
    <svg {...svgProps}>
      <rect x="48" y="14" width="120" height="76" rx="10" className="fill-muted/50" transform="rotate(6 108 52)" />
      <rect x="36" y="20" width="128" height="80" rx="10" className="fill-background stroke-border" strokeWidth="1.5" />

      {/* Key glyph */}
      <g className="stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="60" cy="44" r="7" />
        <path d="M67 44 H86 M80 44 V49 M85 44 V48" />
      </g>
      <circle cx="60" cy="44" r="2" className="fill-muted-foreground/20" />

      {/* Masked secret: prefix pill + dot groups */}
      <rect x="52" y="62" width="20" height="9" rx="3" className="fill-muted-foreground/15" />
      <g className="fill-muted-foreground/20">
        <circle cx="80" cy="66.5" r="2" />
        <circle cx="87" cy="66.5" r="2" />
        <circle cx="94" cy="66.5" r="2" />
        <circle cx="101" cy="66.5" r="2" />
      </g>
      <g className="fill-muted-foreground/15">
        <circle cx="113" cy="66.5" r="2" />
        <circle cx="120" cy="66.5" r="2" />
        <circle cx="127" cy="66.5" r="2" />
        <circle cx="134" cy="66.5" r="2" />
      </g>

      {/* Name line + status dot */}
      <rect x="52" y="82" width="44" height="3" rx="1.5" className="fill-muted-foreground/10" />
      <rect x="126" y="79" width="24" height="9" rx="4.5" className="fill-muted-foreground/10" />
      <circle cx="132" cy="83.5" r="2" className="fill-muted-foreground/30" />

      <circle cx="26" cy="52" r="3" className="fill-muted-foreground/10" />
      <circle cx="180" cy="38" r="2" className="fill-muted-foreground/15" />
      <path d="M174 72 L178 68 L178 76 Z" className="fill-muted-foreground/10" />
    </svg>
  );
}

/** Shared credentials: one signed-in account fanned out to several teammates. */
export function SharedCredentialIllustration() {
  const people = [
    { x: 40, y: 34 },
    { x: 40, y: 96 },
    { x: 160, y: 34 },
    { x: 160, y: 96 },
  ];
  return (
    <svg {...svgProps}>
      {/* Connectors */}
      <g className="stroke-muted-foreground/20" strokeWidth="1.5" strokeDasharray="3 3">
        {people.map((p) => (
          <line key={`${p.x}-${p.y}`} x1="100" y1="65" x2={p.x} y2={p.y} />
        ))}
      </g>
      <g className="fill-muted-foreground/30">
        <circle cx="70" cy="49.5" r="2" />
        <circle cx="130" cy="80.5" r="2" />
      </g>

      {/* Teammates */}
      {people.map((p) => (
        <g key={`p-${p.x}-${p.y}`}>
          <circle cx={p.x} cy={p.y} r="14" className="fill-muted/60 stroke-border" strokeWidth="1.5" />
          <circle cx={p.x} cy={p.y - 4} r="4.5" className="fill-muted-foreground/25" />
          <path
            d={`M${p.x - 8} ${p.y + 10} a8 7 0 0 1 16 0 Z`}
            className="fill-muted-foreground/20"
          />
        </g>
      ))}

      {/* Shared account: a padlock tile */}
      <rect x="80" y="45" width="40" height="40" rx="11" className="fill-background stroke-border" strokeWidth="1.5" />
      <path
        d="M93 62 V58 a7 7 0 0 1 14 0 V62"
        className="stroke-muted-foreground/40"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="90" y="62" width="20" height="14" rx="3" className="fill-muted-foreground/20" />
      <circle cx="100" cy="68.5" r="2" className="fill-foreground/60" />
    </svg>
  );
}

/** Shared MCP servers: stacked server units linked out to a tool node. */
export function McpServerIllustration() {
  const units = [30, 54, 78];
  return (
    <svg {...svgProps}>
      {units.map((y, i) => (
        <g key={y} opacity={i === 2 ? 0.55 : 1}>
          <rect
            x="44"
            y={y}
            width="92"
            height="20"
            rx="5"
            className={i === 0 ? 'fill-background stroke-border' : 'fill-muted/50 stroke-border'}
            strokeWidth="1.5"
          />
          <circle cx="56" cy={y + 10} r="2.5" className={i === 0 ? 'fill-foreground/60' : 'fill-muted-foreground/25'} />
          <circle cx="64" cy={y + 10} r="2.5" className="fill-muted-foreground/20" />
          <g className="stroke-muted-foreground/20" strokeWidth="1.5" strokeLinecap="round">
            <line x1="104" y1={y + 7} x2="126" y2={y + 7} />
            <line x1="104" y1={y + 13} x2="120" y2={y + 13} />
          </g>
        </g>
      ))}

      {/* Link from the top unit to an agent/tool node */}
      <path
        d="M136 40 H150 Q158 40 158 48 V56"
        className="stroke-muted-foreground/25"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        fill="none"
      />
      <circle cx="158" cy="68" r="12" className="fill-background stroke-border" strokeWidth="1.5" />
      <circle cx="158" cy="68" r="4.5" className="fill-muted-foreground/25" />
      <circle cx="158" cy="68" r="1.8" className="fill-foreground/60" />

      <circle cx="26" cy="46" r="3" className="fill-muted-foreground/10" />
      <circle cx="182" cy="30" r="2" className="fill-muted-foreground/15" />
      <path d="M178 100 L182 96 L182 104 Z" className="fill-muted-foreground/10" />
    </svg>
  );
}
