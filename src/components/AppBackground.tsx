import React from "react";

export default function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen min-w-full flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: "url('/images/logo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#979797", // fallback šedá
      }}
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
