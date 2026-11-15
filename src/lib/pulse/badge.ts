// SVG generator for the public "live badge" (extracted from the badge route
// so its width math is unit-testable). The badge is two segments: a dark
// label segment and a gradient value segment; each segment is sized from its
// text length (~7px per character at 11px Verdana) plus padding.

export function badgeSvg(label: string, value: string) {
  const labelWidth = Math.round(label.length * 7) + 16;
  const width = labelWidth + Math.round(value.length * 7) + 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#4f46e5"/></linearGradient>
  <rect width="${width}" height="20" rx="3" fill="#1e1b4b"/>
  <rect x="${labelWidth}" width="${width - labelWidth}" height="20" fill="url(#g)"/>
  <g fill="#ffffff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="8" y="14">${label}</text>
    <text x="${labelWidth + 10}" y="14">${value}</text>
  </g>
</svg>`;
}
