import { useState, useRef, useEffect, useCallback } from "react";
// @ts-ignore
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { useNavigate, useLocation } from "react-router-dom";
import AppBackground from "./AppBackground";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

type BarcodeBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "barcode" | "ocr";
  labelIndex?: number;
  error?: string | null;
  masterText?: string;
  scanText?: string;
};
type CroppedLabel = { url: string; w: number; h: number };

const NAVIN_ROTATION = ["A2", "A4", "A1", "A3"] as const;
const mmToPx = (mm: number, dpi = 96) => Math.round((mm / 25.4) * dpi);
// použitie .env (na deploy Vercel/Vite musíš mať nastavené VITE_API_BASE_URL!)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Utils
const rotateImage = (imageUrl: string, degrees: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (degrees % 180 !== 0) [w, h] = [h, w];
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No 2D context");
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });

const dataURLtoFile = (dataurl: string, filename: string) => {
  const [header, body] = dataurl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(body);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new File([arr], filename, { type: mime });
};

async function markOcrFakeError(masterText: string, scanText: string, productNumber: string) {
  try {
    await fetch(`${API_BASE}/api/ai/fake-ocr-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterText, scanText, productNumber }),
    });
  } catch {}
}

function getLabelBoxes(result: any, labelIndex: number): BarcodeBox[] {
  const boxes: BarcodeBox[] = [];
  if (Array.isArray(result?.barcodeData)) {
    for (const b of result.barcodeData as any[]) {
      if (
        b.index === labelIndex &&
        Array.isArray(b.points) &&
        b.points.length === 4 &&
        b.valid === false
      ) {
        const pts = b.points;
        boxes.push({
          x: pts[0].x,
          y: pts[0].y,
          w: Math.abs(pts[1].x - pts[0].x),
          h: Math.abs(pts[3].y - pts[0].y),
          type: "barcode",
          labelIndex: b.index,
          error: b.error ?? "Chyba barcode",
        });
      }
    }
  }
  if (Array.isArray(result?.ocrData)) {
    for (const o of result.ocrData as any[]) {
      if (o.labelIndex === labelIndex && o.error) {
        boxes.push({
          x: o.x,
          y: o.y,
          w: o.w,
          h: o.h,
          type: "ocr",
          labelIndex: o.labelIndex,
          error: o.error,
          masterText: o.masterText,
          scanText: o.scanText,
        });
      }
    }
  }
  return boxes;
}

// --- OverlayCanvas ---
function OverlayCanvas({
  src,
  boxes,
  ackBoxes,
  onBoxClick,
}: {
  src: string;
  boxes: BarcodeBox[];
  ackBoxes: Set<string>;
  onBoxClick?: (boxId: string, boxObj: BarcodeBox) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      setCanvasSize({ w: img.width, h: img.height });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      boxes.forEach((b: BarcodeBox) => {
        ctx.save();
        const id = `${b.labelIndex}-${b.x}-${b.y}-${b.type}`;
        const ack = ackBoxes.has(id);

        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = ack ? "#20c997" : "#d91e18";
        ctx.lineWidth = hovered === id ? 18 : 12;
        if (b.type === "ocr" && !ack) ctx.setLineDash([7, 7]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        if (hovered === id) {
          ctx.globalAlpha = 0.24;
          ctx.fillStyle = "#d91e18";
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.globalAlpha = 1.0;
        }

        if (b.error && !ack) {
          ctx.font = "bold 14px Arial";
          ctx.fillStyle = "#d91e18";
          ctx.fillText(b.error, b.x + 2, b.y + 18);
        }
        if (ack) {
          ctx.font = "bold 14px Arial";
          ctx.fillStyle = "#20c997";
          ctx.fillText("AKCEPT.", b.x + 4, b.y + 18);
        }
        ctx.restore();
      });
    };
  }, [src, boxes, ackBoxes, hovered, canvasSize.w, canvasSize.h]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;
    let found = null;
    for (const b of boxes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        found = `${b.labelIndex}-${b.x}-${b.y}-${b.type}`;
        break;
      }
    }
    setHovered(found);
  };

  const handleMouseLeave = () => setHovered(null);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;
    for (const b of boxes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const id = `${b.labelIndex}-${b.x}-${b.y}-${b.type}`;
        onBoxClick?.(id, b);
        break;
      }
    }
  };

  const hoveredBox = boxes.find(
    (b: BarcodeBox) => `${b.labelIndex}-${b.x}-${b.y}-${b.type}` === hovered
  );

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 240 }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{
          width: "100%",
          maxWidth: 240,
          maxHeight: 180,
          height: "auto",
          borderRadius: 12,
          border: "2px solid #bbb",
          background: "#fff",
          margin: "0 auto",
          display: "block",
          cursor: "pointer",
          transition: "box-shadow 0.2s",
          boxShadow: hovered ? "0 0 0 4px #ffd4d4" : undefined,
        }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        data-tooltip-id="overlay-tooltip"
        data-tooltip-content={
          hoveredBox
            ? hoveredBox.error ||
              (hoveredBox.type === "barcode"
                ? "Chyba čiarového kódu"
                : "Chyba textu")
            : ""
        }
      />
      <Tooltip id="overlay-tooltip" place="top" variant="light" float />
    </div>
  );
}

// --- HLAVNÁ KOMPONENTA ---
export default function CompareResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const operatorState = location.state as any;

  if (!operatorState) {
    return (
      <AppBackground>
        <div className="p-10 text-xl text-red-600 font-bold">
          Chýbajú vstupné údaje. Prosím, začni proces od začiatku.
        </div>
      </AppBackground>
    );
  }

  const operator = operatorState.operator ?? "";
  const zakazka = operatorState.zakazka ?? "";
  const produkt = operatorState.produkt ?? "";
  const stroj = operatorState.stroj ?? "";
  const datum = operatorState.datum ?? "";
  const cas = operatorState.cas ?? "";
  const role = operatorState.role ?? "";

  const [productNumber, setProductNumber] = useState(produkt || "");
  const [productNumberTouched, setProductNumberTouched] = useState(false);
  const [spoolNumber, setSpoolNumber] = useState("");
  const [rows, setRows] = useState("");
  const [cols, setCols] = useState("");
  const [labelWidthMm, setLabelWidthMm] = useState("90");
  const [labelHeightMm, setLabelHeightMm] = useState("60");
  const [horizontalGapMm, setHorizontalGapMm] = useState("0");
  const [verticalGapMm, setVerticalGapMm] = useState("0");
  const [dpi, setDpi] = useState(96);

  const [navIdx, setNavIdx] = useState(0);
  const wind = NAVIN_ROTATION[navIdx];

  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [croppedMasterSize, setCroppedMasterSize] = useState<{ w: number; h: number } | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const cropRef = useRef<any>(null);

  const [stripFile, setStripFile] = useState<File | null>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [showStripCrop, setShowStripCrop] = useState(false);
  const stripCropRef = useRef<any>(null);
  const [tempStripUrl, setTempStripUrl] = useState<string | null>(null);

  const [croppedLabels, setCroppedLabels] = useState<CroppedLabel[]>([]);
  const [result, setResult] = useState<any>(null);
  const [ackBoxes, setAckBoxes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const labelWidthPx = mmToPx(Number(labelWidthMm), dpi);
  const labelHeightPx = mmToPx(Number(labelHeightMm), dpi);

  const toBase64 = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    });

  // --- Master handlers ---
  const onMaster = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setMasterFile(f);
    setCroppedMasterSize(null);
    setCroppedLabels([]);
    setResult(null);
    setNavIdx(0);
    if (f) toBase64(f).then(setMasterUrl).catch(() => setMasterUrl(null));
    else setMasterUrl(null);
  };

  const rotateMaster = async () => {
    if (!masterUrl) return;
    const url = await rotateImage(masterUrl, 90);
    setMasterUrl(url);
    if (masterFile) setMasterFile(dataURLtoFile(url, masterFile.name));
    setNavIdx((i) => (i + 1) % NAVIN_ROTATION.length);
  };

  const autoCropMaster = () => {
    const inst = cropRef.current?.cropper;
    if (!inst) return;
    const cd = inst.getContainerData();
    inst.setCropBoxData({
      width: labelWidthPx,
      height: labelHeightPx,
      left: (cd.width - labelWidthPx) / 2,
      top: (cd.height - labelHeightPx) / 2,
    });
    inst.setAspectRatio(labelWidthPx / labelHeightPx);
    inst.setDragMode("move");
  };

const getCropped = async (): Promise<Blob | null> => {
  const inst = cropRef.current?.cropper;
  if (!inst) return null;
  const canvas = inst.getCroppedCanvas();
  if (!canvas) return null;
  return new Promise((res) => canvas.toBlob(res, "image/png"));
};


  const finishCrop = async () => {
    if (!masterUrl) return;
    const blob = await getCropped();
    if (!blob) return;
    const f = new File([blob], masterFile?.name || "master.png", { type: "image/png" });
    setMasterFile(f);
    setMasterUrl(await toBase64(f));
    const inst = cropRef.current?.cropper;
    if (inst) {
      const d = inst.getData(true);
      setCroppedMasterSize({ w: Math.round(d.width), h: Math.round(d.height) });
    }
    setShowCrop(false);
  };

  // --- Strip handlers ---
  const onStrip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setStripFile(f);
    setCroppedLabels([]);
    setResult(null);
    if (f && f.type.startsWith("image/")) {
      setStripUrl(await toBase64(f));
    } else {
      setStripUrl(null);
    }
  };

  const autoCropStrip = () => {
    stripCropRef.current?.cropper.setDragMode("move");
  };

  const getCroppedStrip = async (): Promise<string | null> => {
    const inst = stripCropRef.current?.cropper;
    if (!inst) return null;
    const canvas = inst.getCroppedCanvas();
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  };

  const finishStripCrop = async () => {
    const url = await getCroppedStrip();
    if (!url) return;
    setStripUrl(url);
    setShowStripCrop(false);
    setTempStripUrl(null);
  };

  // --- Grid crop ---
  const cropStripToGrid = useCallback(() => {
    if (!stripUrl || !rows || !cols || !croppedMasterSize) return;
    const img = new window.Image();
    img.src = stripUrl;
    img.onload = () => {
      const nR = Number(rows),
        nC = Number(cols),
        w = croppedMasterSize.w,
        h = croppedMasterSize.h,
        gX = mmToPx(Number(horizontalGapMm), dpi),
        gY = mmToPx(Number(verticalGapMm), dpi);
      const arr: CroppedLabel[] = [];
      for (let r = 0; r < nR; r++) {
        for (let c = 0; c < nC; c++) {
          const sx = c * (w + gX),
            sy = r * (h + gY);
          const cnv = document.createElement("canvas");
          cnv.width = w;
          cnv.height = h;
          const ctx = cnv.getContext("2d");
          if (ctx) ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
          arr.push({ url: cnv.toDataURL("image/png"), w, h });
        }
      }
      setCroppedLabels(arr);
    };
  }, [stripUrl, rows, cols, croppedMasterSize, horizontalGapMm, verticalGapMm, dpi]);

  useEffect(() => {
    if (croppedMasterSize && stripUrl && rows && cols) cropStripToGrid();
  }, [croppedMasterSize, stripUrl, rows, cols, cropStripToGrid]);

  // --- Compare & API ---
  const ensureMasterFile = async () => {
    if (masterFile) return masterFile;
    if (masterUrl) return dataURLtoFile(masterUrl, "auto-master.png");
    return null;
  };

  const doCompare = async () => {
    setProductNumberTouched(true);
    if (!productNumber.trim()) {
      alert("Číslo produktu je povinné!");
      return;
    }
    if (!spoolNumber.trim()) {
      alert("Číslo kotúča je povinné!");
      return;
    }
    setLoading(true);
    try {
      const mf = await ensureMasterFile();
      if (!mf || !stripFile || !rows || !cols || !productNumber.trim() || !spoolNumber.trim()) {
        alert("Vyplň všetky polia a nahraj master + pás.");
        return;
      }
      const fd = new FormData();
      fd.append("master", mf);
      fd.append("scan", stripFile);
      fd.append("rows", rows);
      fd.append("cols", cols);
      fd.append("wind", wind);
      fd.append("labelWidthPx", String(croppedMasterSize?.w || labelWidthPx));
      fd.append("labelHeightPx", String(croppedMasterSize?.h || labelHeightPx));
      fd.append("horizontalGapMm", horizontalGapMm);
      fd.append("verticalGapMm", verticalGapMm);
      fd.append("dpi", String(dpi));
      fd.append("spoolNumber", spoolNumber);
      fd.append("productNumber", productNumber.trim());

      const res = await fetch(`${API_BASE}/api/compare`, { method: "POST", body: fd });
      const json = await res.json();
      setResult(json);
      setAckBoxes(new Set());
    } catch (err) {
      alert("Chyba porovnania");
    } finally {
      setLoading(false);
    }
  };

  const handleBoxClick = (id: string, box: BarcodeBox) => {
    setAckBoxes((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else {
        ns.add(id);
        if (box.type === "ocr" && box.masterText && box.scanText) {
          markOcrFakeError(box.masterText, box.scanText, productNumber);
        }
      }
      return ns;
    });
  };

  // --- Save / Load master ---
  const handleSaveMaster = async () => {
    setProductNumberTouched(true);
    const pn = productNumber.trim();
    if (!pn || !masterFile || !croppedMasterSize) {
      alert("Vyplň číslo produktu, nahraj a orež master.");
      return;
    }
    if (!spoolNumber.trim()) {
      alert("Vyplň číslo kotúča");
      return;
    }
    const meta = {
      productNumber: pn,
      spoolNumber,
      rows,
      cols,
      labelWidthMm,
      labelHeightMm,
      horizontalGapMm,
      verticalGapMm,
      dpi,
      cropSize: croppedMasterSize,
      wind,
    };
    const fd = new FormData();
    fd.append("productNumber", pn);
    fd.append("master", masterFile, `${pn}.png`);
    fd.append("params", JSON.stringify(meta));
    try {
      const res = await fetch(`${API_BASE}/api/master/save`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Status " + res.status);
      alert("Master úspešne uložený na server.");
    } catch (err) {
      alert("Chyba pri ukladaní masteru.");
    }
  };

  // --- Načítanie master etikety z backendu ---
  const handleLoadMaster = async () => {
    const pn = productNumber.trim();
    setProductNumberTouched(true);
    if (!pn) {
      alert("Zadaj číslo produktu");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/master/load?productNumber=${encodeURIComponent(pn)}`
      );
      if (!res.ok) {
        throw new Error("Nepodarilo sa načítať master etiketu: " + res.status);
      }
      const data = await res.json();
      const m = data.meta || {};
      const idx = NAVIN_ROTATION.indexOf(m.wind) >= 0 ? NAVIN_ROTATION.indexOf(m.wind) : 0;
      setNavIdx(idx);
      let b64: string = data.pngBase64;
      setMasterUrl(b64);
      setMasterFile(null);
      setSpoolNumber(m.spoolNumber || "");
      setRows(m.rows || "");
      setCols(m.cols || "");
      setLabelWidthMm(m.labelWidthMm || "90");
      setLabelHeightMm(m.labelHeightMm || "60");
      setHorizontalGapMm(m.horizontalGapMm || "0");
      setVerticalGapMm(m.verticalGapMm || "0");
      setDpi(m.dpi || 96);
      setCroppedMasterSize(m.cropSize || null);
      setCroppedLabels([]);
      setResult(null);
      alert("Master načítaný.");
    } catch (err: any) {
      alert(err.message || "Nepodarilo sa načítať master.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Render Labels Grid ---
  const renderLabelsGrid = () => {
    if (!croppedLabels.length) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-6">
        {croppedLabels.map((label, i) => {
          const idx = i + 1;
          const boxes = result ? getLabelBoxes(result, idx) : [];
          const bc = result?.barcodeData?.find((b: any) => b.index === idx);
          const oc = result?.ocrData?.filter((o: any) => o.labelIndex === idx) || [];
          return (
            <div key={i} className="flex flex-col items-center">
              <OverlayCanvas
                src={label.url}
                boxes={boxes}
                ackBoxes={ackBoxes}
                onBoxClick={handleBoxClick}
              />
              <div className="text-xs mt-1 font-semibold">Etiketa č.{idx}</div>
              <div className="text-xs text-gray-500 mb-1">
                {label.w} × {label.h} px
              </div>
              {bc && (
                <div className="text-xs">
                  {bc.valid ? (
                    <span className="text-green-700">✅ Čiarový kód OK</span>
                  ) : (
                    <span className="text-red-600">{bc.error}</span>
                  )}
                </div>
              )}
              {oc[0] && (
                <div className="text-xs">
                  {oc[0].error ? (
                    <span className="text-red-600">{oc[0].error}</span>
                  ) : (
                    <span className="text-green-700">{oc[0].scanText}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const reportState = {
    operator,
    zakazka,
    produkt,
    stroj,
    datum,
    cas,
    role,
    productNumber,
    spoolNumber,
    rows,
    cols,
    labelWidthMm,
    labelHeightMm,
    horizontalGapMm,
    verticalGapMm,
    dpi,
    wind,
    expectedWind: result?.expectedWind || wind,
    detectedWind: result?.detectedWind,
    windResult: result?.windResult,
    windDetail: result?.windDetail,
    barcodeData: result?.barcodeData || [],
    ocrData: result?.ocrData || [],
    colorData: result?.colorData || [],
    croppedLabels,
  };

  const [inputMode, setInputMode] = useState<"manual" | "disk">("manual");

  return (
    <AppBackground>
      <img
        src="/images/navin.png"
        alt="Navin"
        className="absolute top-28 right-28 w-36 h-auto z-50 pointer-events-none"
        style={{ boxShadow: "0 2px 8px #0002", borderRadius: 10 }}
      />

      <div className="flex flex-row gap-14 py-14 w-full max-w-7xl items-start">
        {/* FORM */}
        <div className="rounded-2xl shadow-xl p-8 w-[340px] flex flex-col bg-white/90">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setInputMode("manual")}
              className={`flex-1 py-2 rounded-l-lg border ${
                inputMode === "manual"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Vyplniť ručne
            </button>
            <button
              onClick={() => setInputMode("disk")}
              className={`flex-1 py-2 rounded-r-lg border ${
                inputMode === "disk"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Z disku
            </button>
          </div>

          {inputMode === "manual" && (
            <>
              <label>Číslo produktu *</label>
              <input
                type="text"
                value={productNumber}
                onChange={(e) => setProductNumber(e.target.value)}
                onBlur={() => setProductNumberTouched(true)}
                className={`w-full border p-2 rounded mb-1 ${productNumberTouched && productNumber.trim() === "" ? "border-red-600" : ""}`}
                required
                autoFocus
              />
              {productNumberTouched && productNumber.trim() === "" && (
                <div className="text-red-600 text-xs mb-2">Vyplň číslo produktu</div>
              )}
              <label>Číslo kotúča *</label>
              <input
                type="number"
                min={1}
                value={spoolNumber}
                onChange={(e) => setSpoolNumber(e.target.value)}
                className={`w-full border p-2 rounded mb-4 ${spoolNumber.trim() === "" ? "border-red-600" : ""}`}
                required
              />
              {spoolNumber.trim() === "" && (
                <div className="text-red-600 text-xs mb-2">Vyplň číslo kotúča</div>
              )}
              <label>Počet riadkov *</label>
              <input
                type="number"
                min={1}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <label>Počet stĺpcov *</label>
              <input
                type="number"
                min={1}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <label>Šírka etikety (mm)</label>
              <input
                type="number"
                min={1}
                value={labelWidthMm}
                onChange={(e) => setLabelWidthMm(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <label>Výška etikety (mm)</label>
              <input
                type="number"
                min={1}
                value={labelHeightMm}
                onChange={(e) => setLabelHeightMm(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <label>Horizontálna medzera (mm)</label>
              <input
                type="number"
                min={0}
                value={horizontalGapMm}
                onChange={(e) => setHorizontalGapMm(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <label>Vertikálna medzera (mm)</label>
              <input
                type="number"
                min={0}
                value={verticalGapMm}
                onChange={(e) => setVerticalGapMm(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <label className="text-xs">DPI (zvyčajne 96):</label>
              <input
                type="number"
                min={30}
                max={1200}
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                className="w-full border p-1 rounded mb-6"
              />

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={handleSaveMaster}
                  className="flex-1 bg-blue-500 text-white p-2 rounded"
                >
                  Uložiť master
                </button>
              </div>
            </>
          )}

          {inputMode === "disk" && (
            <>
              <label>Číslo produktu *</label>
              <input
                type="text"
                value={productNumber}
                onChange={(e) => setProductNumber(e.target.value)}
                onBlur={() => setProductNumberTouched(true)}
                className={`w-full border p-2 rounded mb-1 ${productNumberTouched && productNumber.trim() === "" ? "border-red-600" : ""}`}
              />
              {productNumberTouched && productNumber.trim() === "" && (
                <div className="text-red-600 text-xs mb-2">Vyplň číslo produktu</div>
              )}
              <label>Číslo kotúča *</label>
              <input
                type="number"
                min={1}
                value={spoolNumber}
                onChange={(e) => setSpoolNumber(e.target.value)}
                className={`w-full border p-2 rounded mb-4 ${spoolNumber.trim() === "" ? "border-red-600" : ""}`}
                required
              />
              {spoolNumber.trim() === "" && (
                <div className="text-red-600 text-xs mb-2">Vyplň číslo kotúča</div>
              )}
              <button
                onClick={handleLoadMaster}
                disabled={!productNumber.trim() || loading}
                className="bg-blue-600 text-white p-2 rounded w-full mb-6 disabled:opacity-50"
              >
                Načítať master
              </button>
            </>
          )}

          <button
            onClick={doCompare}
            disabled={
              loading ||
              !productNumber.trim() ||
              !spoolNumber.trim() ||
              !rows ||
              !cols ||
              (!masterUrl && !masterFile) ||
              !stripUrl
            }
            className="mt-6 w-full bg-green-500 text-white p-3 rounded disabled:opacity-50"
          >
            {loading ? "Porovnávam…" : "Porovnať"}
          </button>
        </div>

        {/* Pravý panel */}
        <div className="flex-1">
          <div className="flex gap-12 mb-4">
            {/* Master */}
            <div className="flex flex-col items-center">
              <label className="font-bold mb-2">Master etiketa</label>
              <input
                type="file"
                accept="image/*"
                onChange={onMaster}
                className="mb-4"
              />
              {masterUrl && (
                <>
                  <img
                    src={masterUrl}
                    alt="master"
                    className="max-w-[180px] max-h-[140px] object-contain rounded mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={rotateMaster}
                      className="bg-blue-600 text-white px-2 py-1 rounded"
                    >
                      Otočiť ({NAVIN_ROTATION[navIdx]})
                    </button>
                    <button
                      onClick={() => setShowCrop(true)}
                      className="bg-gray-700 text-white px-2 py-1 rounded"
                    >
                      Orež
                    </button>
                  </div>
                  {croppedMasterSize && (
                    <div className="text-xs text-gray-500 mt-1">
                      {croppedMasterSize.w}×{croppedMasterSize.h}px
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Strip */}
            <div className="flex flex-col items-center">
              <label className="font-bold mb-2">Pás etikiet</label>
              <input
                type="file"
                accept="image/*"
                onChange={onStrip}
                className="mb-4"
              />
              {stripUrl ? (
                <>
                  <img
                    src={stripUrl}
                    alt="strip"
                    className="max-w-[320px] max-h-[220px] object-contain rounded mb-2"
                  />
                  <button
                    onClick={() => {
                      setTempStripUrl(stripUrl);
                      setShowStripCrop(true);
                    }}
                    className="bg-gray-700 text-white px-2 py-1 rounded"
                  >
                    Orezať pás
                  </button>
                </>
              ) : (
                <p className="text-gray-400">Nahraj pás, aby sa zobrazil náhľad</p>
              )}
            </div>
          </div>

          {renderLabelsGrid()}
        </div>
      </div>

      {/* Crop master modal */}
      {showCrop && masterUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <Cropper
              src={masterUrl}
              style={{ height: 400, width: 600 }}
              guides
              dragMode="move"
              cropBoxResizable={false}
              cropBoxMovable
              ref={cropRef}
              viewMode={1}
              autoCropArea={1}
              ready={autoCropMaster}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={finishCrop}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Orezať
              </button>
              <button
                onClick={() => setShowCrop(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop strip modal */}
      {showStripCrop && tempStripUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <Cropper
              src={tempStripUrl}
              style={{ height: 400, width: 800 }}
              guides
              dragMode="move"
              cropBoxResizable
              cropBoxMovable
              ref={stripCropRef}
              viewMode={1}
              autoCropArea={1}
              ready={autoCropStrip}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={finishStripCrop}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Orezať pás
              </button>
              <button
                onClick={() => setShowStripCrop(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailný report */}
      {result && (
        <button
          className="fixed bottom-6 right-8 bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg z-50 text-lg font-semibold hover:bg-blue-800 transition"
          onClick={() =>
            navigate("/compare-report", {
              state: reportState,
            })
          }
        >
          Detailný report všetkých chýb
        </button>
      )}
    </AppBackground>
  );
}

















