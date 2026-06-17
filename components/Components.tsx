
import React from 'react';

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const baseStyle = "font-sans font-medium text-[15px] px-6 py-2.5 transition-all duration-200 relative group rounded-[999px] flex items-center justify-center gap-2";
  
  const variants = {
    // Ultra minimal black button
    primary: "bg-[#171717] text-white hover:opacity-80 active:scale-[0.98]",
    // Clean outline button
    secondary: "bg-white border border-[#EEEDE9] text-[#171717] hover:bg-[#F5F4F0] active:scale-[0.98]",
    danger: "bg-[#FFF0F0] text-[#E00000] border border-[#FFE0E0] hover:bg-[#FFE0E0]"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ children, className = '', title }) => {
  return (
    // Clean minimal card
    <div className={`bg-white p-6 relative rounded-2xl border border-[#EEEDE9] transition-colors hover:bg-[#FAFAFA] ${className}`}>
        {title && (
          <h3 className="text-lg font-bold text-[#171717] mb-4 flex items-center gap-2 tracking-tight">
            {title}
          </h3>
        )}
        {children}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children }) => (
  // Minimal outline badge
  <span className="bg-white border border-[#EEEDE9] text-[#171717] text-[13px] font-medium px-3 py-1 rounded-[999px] flex items-center gap-1">
    {children}
  </span>
);



