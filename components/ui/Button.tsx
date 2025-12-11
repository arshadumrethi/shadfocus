import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  themeColorClass?: string; // e.g., 'bg-red-500'
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  themeColorClass,
  ...props 
}) => {
  let baseStyles = "rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-4 text-lg",
  };

  let variantStyles = "";

  if (variant === 'primary') {
    // If a specific theme color is passed, use it, otherwise default
    variantStyles = `${themeColorClass || 'bg-gray-900'} text-white shadow-lg shadow-gray-200/50 hover:opacity-90`;
  } else if (variant === 'secondary') {
    variantStyles = "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm";
  } else if (variant === 'ghost') {
    variantStyles = "bg-transparent text-gray-600 hover:bg-gray-100";
  } else if (variant === 'danger') {
    variantStyles = "bg-red-50 text-red-600 hover:bg-red-100";
  }

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};