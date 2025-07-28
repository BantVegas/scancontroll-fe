import React, { useState } from "react";

const windIcons = [
  "/images/A1.png",
  "/images/A2.png",
  "/images/A3.png",
  "/images/A4.png",
];

type WindSelectProps = {
  value: number | null;
  onChange: (idx: number) => void;
};

export default function WindSelect({ value, onChange }: WindSelectProps) {
  return (
    <div className="flex gap-4 mt-2">
      {windIcons.map((src, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onChange(idx)}
          className={`flex flex-col items-center border-2 rounded-xl px-3 py-2 transition
            ${value === idx ? "border-green-600 scale-110 shadow-lg bg-green-100" : "border-gray-300 bg-white hover:bg-gray-100"}
          `}
          style={{ minWidth: 80 }}
        >
          <img
            src={src}
            alt={`Navin A${idx + 1}`}
            className="w-12 h-12 object-contain"
            style={{
              filter: value === idx ? "drop-shadow(0 0 8px #22c55e)" : undefined,
              transition: "filter 0.3s",
            }}
          />
          <span className={`mt-2 font-bold ${value === idx ? "text-green-700" : "text-gray-800"}`}>
            A{idx + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
