import type { SVGProps } from 'react';

const SvgLogoWhite = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={48} height={48} viewBox="0 0 48 48" {...props}>
    <rect x={3.5} y={3.5} width={41} height={41} rx={10} fill="none" stroke="#fff" strokeWidth={3} />
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
export default SvgLogoWhite;
