
import React from 'react';

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const baseStyle = "font-sans font-semibold text-sm px-6 py-2.5 transition-all duration-300 relative overflow-hidden group rounded-lg active:scale-95 flex items-center justify-center gap-2";
  
  const variants = {
    // Elegant Teal Button with shadow
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20 hover:shadow-brand-600/30",
    // Clean White Button with border
    secondary: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-brand-600 hover:border-brand-200 shadow-sm",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
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
    // Clean White Card with soft lift on hover
    <div className={`bg-white p-6 relative group rounded-2xl border border-slate-100 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 ${className}`}>
        {title && (
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            {title}
          </h3>
        )}
        {children}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children }) => (
  // Soft Teal Capsule
  <span className="bg-brand-50 border border-brand-100 text-brand-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
    {children}
  </span>
);
