import { useId } from "react";

type CompetitionLogoProps = { size?: number; animated?: boolean; className?: string; style?: React.CSSProperties };

function Mark({ size }: { size: number }) {
  const uid = useId().replaceAll(":", "");
  const shield = `${uid}-cos-shield`;
  const metal = `${uid}-cos-metal`;
  const blue = `${uid}-cos-blue`;
  const shadow = `${uid}-cos-shadow`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={shield} x1="16" y1="8" x2="86" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#356FE7" />
          <stop offset=".48" stopColor="#1746A2" />
          <stop offset="1" stopColor="#0C1D3D" />
        </linearGradient>
        <linearGradient id={metal} x1="27" y1="23" x2="72" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset=".52" stopColor="#BBD6FF" />
          <stop offset="1" stopColor="#6CA2FF" />
        </linearGradient>
        <linearGradient id={blue} x1="31" y1="34" x2="69" y2="69" gradientUnits="userSpaceOnUse">
          <stop stopColor="#76AEFF" />
          <stop offset="1" stopColor="#2364DE" />
        </linearGradient>
        <filter id={shadow} x="3" y="2" width="94" height="102" filterUnits="userSpaceOnUse">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dy="2" />
          <feComponentTransfer><feFuncA type="linear" slope=".3" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter={`url(#${shadow})`}>
        <path d="M50 5 87 20v31c0 21.5-13.8 35.4-37 44C26.8 86.4 13 72.5 13 51V20L50 5Z" fill={`url(#${shield})`} />
        <path d="M50 9 83 22.4V51c0 18.8-11.8 31.6-33 39.7C28.8 82.6 17 69.8 17 51V22.4L50 9Z" stroke={`url(#${metal})`} strokeOpacity=".72" strokeWidth="1.5" />
        <path d="M50 16v7" stroke="#91BAFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="14" r="2.5" fill="#DDEBFF" />
        <path d="M50 31v38M50 39H35a7 7 0 0 0-7 7v2M50 61h15a7 7 0 0 0 7-7v-2" stroke={`url(#${metal})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="31" r="5.5" fill={`url(#${blue})`} stroke="#E6F0FF" strokeWidth="2" />
        <circle cx="28" cy="52" r="5.5" fill={`url(#${blue})`} stroke="#E6F0FF" strokeWidth="2" />
        <circle cx="72" cy="48" r="5.5" fill={`url(#${blue})`} stroke="#E6F0FF" strokeWidth="2" />
        <path d="M36 76h28" stroke="#91BAFF" strokeOpacity=".72" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CompetitionLogo({ size = 42, animated = false, className, style }: CompetitionLogoProps) {
  if (!animated) return <span className={className} style={style} aria-hidden="true"><Mark size={size} /></span>;
  return (
    <span className={className ? `competition-loader-indicator ${className}` : "competition-loader-indicator"} style={style} role="status" aria-label="Loading CompetitionOS">
      <span className="competition-loader-orbit competition-loader-orbit--outer" />
      <span className="competition-loader-orbit competition-loader-orbit--inner" />
      <span className="competition-loader-bounce"><span className="competition-loader-spin"><Mark size={size} /></span></span>
      <span className="sr-only">Loading CompetitionOS</span>
    </span>
  );
}
