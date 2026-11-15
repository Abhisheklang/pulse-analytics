import { useId, type SVGProps } from 'react';

// The gradient id must be unique per instance: browsers resolve
// url(#id) to the first matching element in the document, and when that
// copy sits inside a display:none subtree (e.g. MobileNav on desktop)
// the badge paints nothing. A shared static id made the logo invisible
// wherever two copies of this component were mounted.
const SvgLogo = (props: SVGProps<SVGSVGElement>) => {
  const gradientId = `pulse-gradient-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={48} height={48} viewBox="0 0 48 48" {...props}>
      <defs>
        <linearGradient
          id={gradientId}
          x1={0}
          y1={0}
          x2={48}
          y2={48}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0} stopColor="#4f46e5" />
          <stop offset={1} stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x={2} y={2} width={44} height={44} rx={11} fill={`url(#${gradientId})`} />
      <path d="M24 12.5v23" stroke="#fff" strokeWidth={4.6} strokeLinecap="round" />
      <path
        d="M6.5 24h8.5l3.8-9.5 4.2 19 3.5-9.5h15"
        fill="none"
        stroke="#fff"
        strokeWidth={4.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
export default SvgLogo;
