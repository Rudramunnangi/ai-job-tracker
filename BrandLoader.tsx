import React from "react";

interface BrandLoaderProps {
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  size = "md",
  label,
  className = "",
}) => {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
    xl: "w-16 h-16",
  };

  const strokeMap = {
    sm: 2.2,
    md: 2,
    lg: 1.8,
    xl: 1.6,
  };

  return (
    <div className={`inline-flex items-center justify-center gap-3 ${className}`} role="status" aria-label={label || "Loading"}>
      <div className={`relative ${sizeMap[size]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full animate-brand-pulse"
        >
          {/* Subtle outer bounding ring */}
          <rect
            x="2"
            y="2"
            width="36"
            height="36"
            rx="5"
            stroke="var(--color-border)"
            strokeWidth="1.2"
          />
          {/* Architectural 'N' Logomark Path */}
          <path
            d="M12 28V12L28 28V12"
            stroke="var(--color-success)"
            strokeWidth={strokeMap[size]}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(34,211,200,0.5)]"
          />
        </svg>
      </div>
      {label && (
        <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
      )}
    </div>
  );
};
