import React, { useRef, useEffect } from "react";

export type BarcodeBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "barcode" | "ocr";
};

type OverlayCanvasProps = {
  src: string;
  boxes: BarcodeBox[];
};

export default function OverlayCanvas({ src, boxes }: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // prispôsobím veľkosť canvasu na rozmer obrázka
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // vykreslíme všetky boxy
      boxes.forEach((b) => {
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        ctx.save();
        ctx.strokeStyle = b.type === "ocr" ? "#d91e18" : "red";
        ctx.lineWidth = b.type === "ocr" ? 3 : 4;
        if (b.type === "ocr") ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.rect(
          b.x * scaleX,
          b.y * scaleY,
          b.w * scaleX,
          b.h * scaleY
        );
        ctx.stroke();
        ctx.restore();
      });
    };
  }, [src, boxes]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "auto",
        borderRadius: 16,
        border: "2px solid #bbb",
        background: "#fff",
      }}
    />
  );
}
