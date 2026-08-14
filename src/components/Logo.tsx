import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtext?: string;
  className?: string;
  animated?: boolean;
  variant?: 'default' | 'emerald' | 'indigo' | 'amber';
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  subtext,
  className = '',
  animated = true,
  variant = 'default'
}) => {
  // Dimensions map
  const iconBoxSizes = {
    sm: 'w-7 h-7 rounded-lg border-2 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]',
    md: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 sm:border-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]',
    lg: 'w-12 h-12 rounded-2xl border-2.5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]',
    xl: 'w-16 h-16 rounded-2xl border-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
  };

  const textSizes = {
    sm: 'text-xs sm:text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl'
  };

  // Color theme variants matching Neo-Brutalist App Colors
  const bgColors = {
    default: 'bg-emerald-400 text-slate-900 border-slate-900',
    emerald: 'bg-emerald-500 text-white border-slate-900',
    indigo: 'bg-indigo-600 text-white border-slate-900',
    amber: 'bg-amber-400 text-slate-950 border-slate-900'
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* NEO-BRUTALIST SIGNATURE LOGO ICON EMBLEM */}
      <div 
        className={`relative ${iconBoxSizes[size]} ${bgColors[variant]} flex items-center justify-center shrink-0 overflow-hidden group transition-all duration-300 ${
          animated ? 'hover:scale-105 hover:-rotate-2 active:scale-95' : ''
        }`}
      >
        {/* Custom SVG Vault Shield + Split Lightning Graphic */}
        <svg 
          viewBox="0 0 36 36" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5 transition-transform duration-300 group-hover:scale-105"
        >
          {/* Background Outer Circle */}
          <rect x="3" y="3" width="30" height="30" rx="7" fill="#0f172a" stroke="#0f172a" strokeWidth="2" />
          
          {/* Left Side Vault Door (Emerald) */}
          <path 
            d="M7 8C7 6.89543 7.89543 6 9 6H17V30H9C7.89543 30 7 29.1046 7 28V8Z" 
            fill="#10b981" 
            stroke="#0f172a" 
            strokeWidth="1.5"
          />

          {/* Right Side Vault Door (Indigo) */}
          <path 
            d="M19 6H27C28.1046 6 29 6.89543 29 8V28C29 29.1046 28.1046 30 27 30H19V6Z" 
            fill="#6366f1" 
            stroke="#0f172a" 
            strokeWidth="1.5"
          />

          {/* Center Split Slash (Golden Yellow) */}
          <path 
            d="M20 5L12 31" 
            stroke="#facc15" 
            strokeWidth="3" 
            strokeLinecap="round"
          />

          {/* Central Vault Dial / Lock Wheel */}
          <circle 
            cx="18" 
            cy="18" 
            r="5" 
            fill="#ffffff" 
            stroke="#0f172a" 
            strokeWidth="2"
          />

          {/* Central Lock Keyhole Dot */}
          <circle 
            cx="18" 
            cy="18" 
            r="1.75" 
            fill="#0f172a" 
          />
        </svg>

        {/* Top-Right Sparkle Dot */}
        <div className="absolute top-1 right-1 w-2 h-2 bg-amber-300 rounded-full border border-slate-900 shadow-sm" />
      </div>

      {/* TYPOGRAPHY BRANDING */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h1 className={`${textSizes[size]} font-black tracking-tight font-display uppercase text-slate-900 leading-none flex items-center`}>
              <span>SPLIT</span>
              <span className="text-emerald-600 ml-1">VAULT</span>
            </h1>

            {/* Subtext Tag Badge */}
            {subtext && (
              <span className="text-[9px] font-mono font-black uppercase bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                {subtext}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Logo;
