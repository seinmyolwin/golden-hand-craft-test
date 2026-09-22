import React, { useState } from 'react';

const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="bg" cx="50%" cy="45%" r="65%"><stop offset="0%" stop-color="%23064e3b"/><stop offset="65%" stop-color="%23022c22"/><stop offset="100%" stop-color="%23021c15"/></radialGradient><linearGradient id="text" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23ffffff"/><stop offset="40%" stop-color="%23fef08a"/><stop offset="80%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23d97706"/></linearGradient><linearGradient id="star" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23ffffff"/><stop offset="30%" stop-color="%23fed75b"/><stop offset="100%" stop-color="%23b45309"/></linearGradient></defs><rect width="512" height="512" rx="108" fill="url(%23bg)"/><path d="M 256 90 C 282 140 314 172 360 186 C 314 200 282 232 256 282 C 230 232 198 200 152 186 C 198 172 230 140 256 90 Z" fill="url(%23star)"/><circle cx="256" cy="186" r="16" fill="%23fff176"/><text x="256" y="365" text-anchor="middle" font-family="'Padauk', 'Noto Sans Myanmar', 'Pyidaungsu', 'Myanmar3', sans-serif" font-size="56" font-weight="900" fill="url(%23text)">ရွှေလက်ရာ</text></svg>`;
const DEFAULT_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_LOGO_SVG)}`;

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  showText?: boolean;
  alt?: string;
  logoUrl?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  showText = true,
  alt = 'ရွှေလက်ရာ',
  logoUrl,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

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
  const primarySrc = logoUrl || '/logo.svg';
  const imageSrc = imgError ? DEFAULT_LOGO_DATA_URL : primarySrc;

  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:scale-105 hover:shadow-amber-500/30 group ring-1 ring-amber-400/40 hover:ring-2 hover:ring-amber-300 ${getDimensionClass()} ${className}`}
      title={alt}
    >
      <img
        src={imageSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover rounded-xl bg-emerald-900"
      />
    </div>
  );
};

export default Logo;
