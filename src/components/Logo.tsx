import React from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  showText?: boolean;
  alt?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  showText = true,
  alt = 'ရွှေလက်ရာ',
  onClick,
}) => {
  const getDimensionClass = () => {
    if (typeof size === 'number') {
      return '';
    }
    switch (size) {
      case 'xs':
        return 'w-6 h-6';
      case 'sm':
        return 'w-9 h-9';
      case 'md':
        return 'w-10 h-10';
      case 'lg':
        return 'w-16 h-16';
      case 'xl':
        return 'w-20 h-20';
      case '2xl':
        return 'w-24 h-24';
      default:
        return 'w-10 h-10';
    }
  };

  const style = typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:scale-105 hover:shadow-amber-500/30 group ring-1 ring-amber-400/40 hover:ring-2 hover:ring-amber-300 ${getDimensionClass()} ${className}`}
      title={alt}
    >
      <svg
        viewBox="0 0 512 512"
        className="w-full h-full object-contain transition-transform duration-500 group-hover:rotate-1"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={alt}
        role="img"
      >
        <defs>
          {/* Background Radial Vignette */}
          <radialGradient id="logoBgGrad" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#2a2721" />
            <stop offset="65%" stopColor="#18191c" />
            <stop offset="100%" stopColor="#0f1012" />
          </radialGradient>

          {/* Outer Gold Ring Gradient with shimmer */}
          <linearGradient id="logoGoldRing" x1="20%" y1="10%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="#785317" />
            <stop offset="25%" stopColor="#eab308" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="75%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>

          {/* Shimmer Light Beam Effect */}
          <linearGradient id="logoShimmerBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Star Gradient with Golden Highlights */}
          <linearGradient id="logoGoldStar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="12%" stopColor="#fff8d4" />
            <stop offset="40%" stopColor="#fed75b" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Central Sphere Gradient */}
          <radialGradient id="logoGoldSphere" cx="36%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#fff176" />
            <stop offset="65%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#854d0e" />
          </radialGradient>

          {/* Burmese Typography Gradient */}
          <linearGradient id="logoGoldText" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffbe0" />
            <stop offset="30%" stopColor="#ffde59" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* Squircle Rounded Dark Canvas Background */}
        <rect width="512" height="512" rx="108" fill="url(#logoBgGrad)" />

        {/* Outer Fine Gold Circle */}
        <circle cx="256" cy="256" r="226" fill="none" stroke="url(#logoGoldRing)" strokeWidth="4" opacity="0.95" />

        {/* Subtle decorative rays */}
        <g opacity="0.35">
          <line x1="256" y1="36" x2="256" y2="60" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
          <line x1="256" y1="452" x2="256" y2="476" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
          <line x1="36" y1="256" x2="60" y2="256" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
          <line x1="452" y1="256" x2="476" y2="256" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Main 4-pointed Concave Star Emblem with Center Cutout */}
        <g className="transition-transform duration-700 origin-center group-hover:scale-105">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 256 108
               C 286 160 322 196 374 212
               C 322 228 286 264 256 320
               C 226 264 190 228 138 212
               C 190 196 226 160 256 108 Z
               M 256 165
               C 240 193 216 205 186 212
               C 216 219 240 231 256 258
               C 272 231 296 219 326 212
               C 296 205 272 193 256 165 Z"
            fill="url(#logoGoldStar)"
          />

          {/* Central Glowing Gold Sphere with lively sparkle */}
          <circle cx="256" cy="212" r="19" fill="url(#logoGoldSphere)" />
          <circle cx="251" cy="207" r="4" fill="#ffffff" opacity="0.9" />
        </g>

        {/* Diagonal Sheen Overlay */}
        <rect width="512" height="512" rx="108" fill="url(#logoShimmerBeam)" pointerEvents="none" />

        {/* Burmese Brand Text: ရွှေလက်ရာ */}
        {showText && (
          <text
            x="256"
            y="422"
            textAnchor="middle"
            fontFamily="'Padauk', 'Noto Sans Myanmar', 'Pyidaungsu', 'Myanmar3', sans-serif"
            fontSize="46"
            fontWeight="bold"
            letterSpacing="1px"
            fill="url(#logoGoldText)"
          >
            ရွှေလက်ရာ
          </text>
        )}
      </svg>
    </div>
  );
};

export default Logo;
