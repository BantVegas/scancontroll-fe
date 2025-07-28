import React from "react";

type AppBackgroundProps = {
  children: React.ReactNode;
  className?: string;
  [key: string]: any; // umožní ďalšie props (napr. id, style atď.)
};

export default function AppBackground({ children, className = "", ...rest }: AppBackgroundProps) {
  return (
    <div
      className={`min-h-screen min-w-full flex flex-col items-center justify-center relative ${className}`}
      style={{
        backgroundImage: "url('/images/logo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#979797",
        ...(rest.style || {}),
      }}
      {...rest}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.13)",
          zIndex: 0,
        }}
      />
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
