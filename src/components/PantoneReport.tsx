import { useState, useRef, useMemo, useEffect } from "react";
import Cropper from "react-cropper";
import type { ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import pantoneRaw from "../assets/pantone-colors.json";
import { useNavigate } from "react-router-dom";

// Typovanie pre pantone
type PantoneEntry = {
  key: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
};

const PANTONE: Record<string, string> = pantoneRaw as Record<string, string>;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const preparedPantone: PantoneEntry[] = Object.entries(PANTONE).map(([name, hex]) => {
  const rgb = hexToRgb(hex);
  return {
    key: name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
    name,
    hex,
    ...rgb,
  };
});

function findPantone(term: string) {
  if (!term) return undefined;
  const cleaned = term.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!cleaned) return undefined;
  return (
    preparedPantone.find((p) => p.key === cleaned) ||
    preparedPantone.find((p) => p.key.startsWith(cleaned)) ||
    preparedPantone.find((p) => p.key.includes(cleaned))
  );
}

const RATING_STYLE: Record<string, string> = {
  "Výborné": "bg-green-500 text-white",
  "Dobre": "bg-yellow-400 text-gray-900",
  "Priemerné": "bg-orange-400 text-white",
  "Slabé": "bg-red-500 text-white",
  "Neznáme": "bg-gray-400 text-white"
};

function ratingToHuman(rating: string, percent: string | number) {
  if (rating === "Výborné") return `Farba je takmer identická (${percent}% zhoda)`;
  if (rating === "Dobre") return `Farba je veľmi podobná (${percent}% zhoda)`;
  if (rating === "Priemerné") return `Viditeľný rozdiel vo farbe (${percent}% zhoda)`;
  if (rating === "Slabé") return `Farba sa nezhoduje (${percent}% zhoda)`;
  return "Výsledok nie je možné určiť";
}

export default function PantoneCompare() {
  const [pantoneCode, setPantoneCode] = useState<string>("");
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [resultObj, setResultObj] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(false);
  const [operator, setOperator] = useState<string>("");
  const [productCode, setProductCode] = useState<string>("");
  const [datetime, setDatetime] = useState(() => {
    const now = new Date();
    return now.toLocaleString("sk-SK", {
      day: "numeric", month: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  });
  const [query, setQuery] = useState<string>("");
  const [showPalette, setShowPalette] = useState(false);
  const cropperRef = useRef<ReactCropperElement>(null);
  const navigate = useNavigate();

  // Dynamická BASE_URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const BACKEND_URL = `${API_BASE}/api/pantone/compare`;

  useEffect(() => {
    const intv = setInterval(() => {
      const now = new Date();
      setDatetime(now.toLocaleString("sk-SK", {
        day: "numeric", month: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }));
    }, 1000);
    return () => clearInterval(intv);
  }, []);

  const pantoneEntries = useMemo(() => preparedPantone, []);
  const pantoneNames = useMemo(() => pantoneEntries.map(p => p.name), [pantoneEntries]);
  const filteredAll = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return pantoneEntries;
    return pantoneEntries.filter((p) => p.name.toLowerCase().includes(term));
  }, [query, pantoneEntries]);
  const entry = findPantone(pantoneCode);

  async function handleCompare() {
    if (!entry || !cropperRef.current || !operator || !productCode) return;
    const cropper = cropperRef.current.cropper;
    if (!cropper) return;
    const croppedDataUrl = cropper.getCroppedCanvas({ width: 100, height: 100 }).toDataURL();
    const base64 = croppedDataUrl.split(",")[1];

    setLoading(true);
    setDetail(false);
    setResultObj(null);

    const reqBody = {
      pantoneCode: entry.name,
      imageBase64: base64,
      operator,
      productCode,
      datetime,
    };

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) throw new Error("Chyba porovnania");
      const data = await res.json();
      setResultObj(data);

      // --- Ulož do localStorage pre dashboard ---
      const saved = JSON.parse(localStorage.getItem("pantoneReports") || "[]");
      localStorage.setItem("pantoneReports", JSON.stringify([
        ...saved,
        { ...data, operator, productCode, datetime, pantoneCode: entry.name }
      ]));

      setTimeout(() => {
        navigate("/dashboardreport");
      }, 1000);
    } catch (e: any) {
      setResultObj(null);
      alert("Chyba porovnania: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-start relative"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#b0b0b0",
        backgroundImage:
          "linear-gradient(rgba(120,120,120,0.18),rgba(120,120,120,0.16)),url('/images/logo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "rgba(0,0,0,0.17)",
          pointerEvents: "none",
        }}
      />
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center py-8 px-3">
        <h2 className="text-4xl font-bold text-center mb-8 text-white drop-shadow-xl">
          Porovnanie Pantone farieb
        </h2>
        {/* Operátor/Product/Čas */}
        <div className="flex flex-row flex-wrap gap-6 mb-8 w-full justify-center">
          <input
            type="text"
            className="bg-[#dddddd]/90 text-gray-600 placeholder-gray-500 rounded-xl px-8 py-4 text-xl font-normal focus:outline-none focus:ring focus:ring-blue-200 min-w-[220px] text-center shadow"
            placeholder="Meno operátora"
            value={operator}
            onChange={e => setOperator(e.target.value)}
            autoComplete="off"
          />
          <input
            type="text"
            className="bg-[#dddddd]/90 text-gray-600 placeholder-gray-500 rounded-xl px-8 py-4 text-xl font-normal focus:outline-none focus:ring focus:ring-blue-200 min-w-[220px] text-center shadow"
            placeholder="Produktové číslo"
            value={productCode}
            onChange={e => setProductCode(e.target.value)}
            autoComplete="off"
          />
          <input
            type="text"
            className="bg-[#f6f7fa] text-gray-700 rounded-xl px-8 py-4 text-xl font-normal min-w-[240px] text-center shadow"
            value={datetime}
            readOnly
            tabIndex={-1}
          />
        </div>
        {/* Flex hlavný workflow */}
        <div className="w-full flex flex-col md:flex-row gap-12 items-start justify-center mb-10 mt-2">
          {/* Pantone box vľavo */}
          <div className="flex flex-col items-center w-full md:w-1/2 gap-2">
            <input
              type="text"
              list="pantone-autocomplete"
              className="border-2 border-gray-400 px-6 py-4 rounded-lg text-2xl text-center font-mono focus:ring focus:outline-none shadow-md bg-white/90 min-w-[160px] max-w-[220px] mb-2"
              value={pantoneCode}
              placeholder="Pantone (napr. 485C)"
              onChange={e => setPantoneCode(e.target.value)}
              autoComplete="off"
              style={{ fontWeight: "bold", letterSpacing: "1px" }}
            />
            <datalist id="pantone-autocomplete">
              {pantoneNames.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {/* Box farby */}
            <div
              className="w-24 h-16 rounded shadow border mb-2 transition-all"
              style={{
                background: entry ? entry.hex : "#fff",
                borderColor: "#aaa",
                boxShadow: "0 1px 2px #0002",
              }}
            />
            <div className="text-[13px] text-gray-200 font-mono text-center min-h-[18px] mb-2">
              {entry ? entry.name : "—"}
            </div>
            {/* Výsledok */}
            {resultObj && (
              <div className="flex flex-col items-center w-full max-w-xs gap-1 mt-2">
                <span
                  className={`px-4 py-2 rounded-2xl text-lg font-bold mb-2 shadow-sm border ${RATING_STYLE[resultObj.rating]} border-gray-300 drop-shadow`}
                >
                  {resultObj.rating}
                </span>
                <div className="text-base font-medium text-white mb-1 drop-shadow">
                  {ratingToHuman(resultObj.rating, resultObj.matchPercent)}
                </div>
                <button
                  onClick={() => setDetail(d => !d)}
                  className="text-xs underline text-blue-200 hover:text-blue-100"
                >
                  {detail ? "Skryť detail" : "Detail"}
                </button>
                {detail && resultObj && (
                  <div className="mt-2 bg-white/90 border border-gray-200 rounded-xl p-3 text-[13px] text-gray-800 shadow">
                    <div><b>Pantone:</b> {resultObj.pantoneCode} ({resultObj.pantoneHex})</div>
                    <div>
                      <b>Originál RGB:</b> {resultObj.refR}, {resultObj.refG}, {resultObj.refB}
                    </div>
                    <div>
                      <b>Sken RGB:</b> {resultObj.sampleR}, {resultObj.sampleG}, {resultObj.sampleB}
                    </div>
                    <div>
                      <b>ΔE2000:</b> {resultObj.deltaE2000?.toFixed(2)}
                    </div>
                    <div>
                      <b>ΔE76:</b> {resultObj.deltaE76?.toFixed(2)}
                    </div>
                    <div>
                      <b>RGB vzdialenosť:</b> {resultObj.rgbDistance?.toFixed(2)}
                    </div>
                    <div>
                      <b>% zhody:</b> {resultObj.matchPercent}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Nahrávanie etikety vpravo */}
          <div className="flex flex-col items-center w-full md:w-1/2 gap-3">
            <input
              type="file"
              accept="image/*"
              className="block text-xs bg-white/80 rounded mb-3 w-full"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  alert("Obrázok je príliš veľký (max. 2MB)");
                  return;
                }
                const reader = new FileReader();
                reader.onload = ev => setCropUrl(ev.target?.result as string);
                reader.readAsDataURL(file);
              }}
            />
            {cropUrl && (
              <Cropper
                src={cropUrl}
                style={{ height: 180, width: "100%", maxWidth: 340, background: "#f3f3f3" }}
                aspectRatio={2 / 1}
                guides={false}
                viewMode={1}
                dragMode="move"
                ref={cropperRef}
              />
            )}
            <div className="text-[11px] text-gray-300 mt-1">Vyber / crop etiketu</div>
            <div className="flex flex-row gap-3 mt-3">
              <button
                className="px-8 py-3 bg-blue-700 text-white rounded font-bold shadow hover:bg-blue-800 transition disabled:opacity-40 text-lg"
                disabled={loading || !cropUrl || !entry || !operator || !productCode}
                onClick={handleCompare}
              >
                {loading ? "Porovnáva sa..." : "Porovnať"}
              </button>
            </div>
          </div>
        </div>
        {/* Pantone paleta - zatahovacia */}
        <div className="rounded-2xl shadow p-6 mt-8 border border-[#dde2e6] bg-white/20 backdrop-blur-md w-full max-w-5xl">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <h3 className="text-xl font-semibold text-white drop-shadow">Paleta Pantone</h3>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Filtrovať..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="border px-3 py-2 rounded text-sm font-mono focus:ring focus:outline-none transition-all duration-200 bg-white/70"
                style={{ width: 160 }}
              />
              <button
                className={`px-4 py-2 text-xs rounded font-semibold transition-all duration-150 ${
                  showPalette
                    ? "bg-gray-800 text-white hover:bg-black"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                onClick={() => setShowPalette(v => !v)}
              >
                {showPalette ? "Skryť skalu" : "Ukázať skalu"}
              </button>
            </div>
          </div>
          <div
            className={`transition-all duration-300 overflow-hidden ${
              showPalette ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="grid md:grid-cols-6 sm:grid-cols-4 grid-cols-2 gap-3 max-h-[340px] overflow-auto pr-1">
              {filteredAll.map(p => (
                <div
                  key={p.name}
                  className="border rounded-md flex flex-col items-center p-2 text-center cursor-pointer select-none hover:shadow transition-all bg-white/70"
                  style={{ background: p.hex + "12" }}
                  onClick={() => setPantoneCode(p.name)}
                >
                  <div
                    className="w-full h-10 rounded mb-1"
                    style={{
                      background: p.hex,
                      border: "1px solid #bbb",
                      boxShadow: "0 1px 2px 0 #0001",
                    }}
                  />
                  <div className="text-[10px] font-medium leading-tight" style={{ color: "#222" }}>
                    {p.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}












