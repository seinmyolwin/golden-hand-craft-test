import React from 'react';

const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="%23064e3b"/><circle cx="256" cy="212" r="80" fill="%23fef08a"/><text x="256" y="430" font-size="70" font-weight="bold" fill="%23ffffff" text-anchor="middle" font-family="sans-serif">ရွှေလက်ရာ</text></svg>`;
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
  const imageSrc = logoUrl || DEFAULT_LOGO_DATA_URL;

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
        className="w-full h-full object-cover rounded-xl"
      />
    </div>
  );
};

export default Logo;
