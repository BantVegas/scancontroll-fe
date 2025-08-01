import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppBackground from "./AppBackground";

// Automaticky načítaj BASE URL pre API z .env súboru (VITE_API_BASE_URL)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function rotateImage90(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No context");
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const CMYK = {
  cyan: "#22d3ee",
  magenta: "#f472b6",
  yellow: "#fde047",
  black: "#222",
};
const NAMES = { cyan: "Cyan", magenta: "Magenta", yellow: "Yellow", black: "Black" };

export default function DenzitaReport() {
  const [operator, setOperator] = useState("");
  const [produkt, setProdukt] = useState("");
  const [datum, setDatum] = useState("");
  const [cas, setCas] = useState("");
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [etiketa, setEtiketa] = useState<File | null>(null);
  const [etiketaUrl, setEtiketaUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const now = new Date();
    setDatum(now.toISOString().slice(0, 10));
    setCas(now.toTimeString().slice(0, 5));
  }, []);

  function loadMasterFromDisk() {
    setError(null);
    setResult(null);
    if (!produkt.trim()) {
      setError("Zadaj číslo produktu");
      return;
    }
    setMasterUrl(`${API_BASE}/api/master/image?productNumber=${produkt}`);
  }

  async function handleRotateMaster() {
    if (!masterUrl) return;
    setLoading(true);
    try {
      const rotated = await rotateImage90(masterUrl);
      setMasterUrl(rotated);
    } catch {
      setError("Chyba pri rotácii obrázka");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare() {
    if (!etiketa || !produkt) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("etiketa", etiketa);
      form.append("productNumber", produkt);
      if (operator) form.append("operator", operator);

      const res = await fetch(`${API_BASE}/api/denzita-compare`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Chyba servera");
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || "Chyba porovnania");
    } finally {
      setLoading(false);
    }
  }

  // === OPRAVENÁ časť: SAVE ===
  async function handleSaveReport() {
    if (!result || !produkt) {
      setError("Najprv porovnaj etikety.");
      return;
    }
    setLoading(true);
    setError(null);

    // Extrahuj rel_rozdiel (alebo iný údaj – podľa backendu)
    const report = {
      operator: operator || "",
      productCode: produkt,
      datetime: `${datum} ${cas}`,
      cyan: typeof result.cyan?.rel_rozdiel === "number" ? result.cyan.rel_rozdiel : null,
      magenta: typeof result.magenta?.rel_rozdiel === "number" ? result.magenta.rel_rozdiel : null,
      yellow: typeof result.yellow?.rel_rozdiel === "number" ? result.yellow.rel_rozdiel : null,
      black: typeof result.black?.rel_rozdiel === "number" ? result.black.rel_rozdiel : null,
      summary: "OK",
      reportType: "DENZITA"
    };

    try {
      const res = await fetch(`${API_BASE}/api/denzita-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report)
      });
      if (!res.ok) throw new Error("Chyba pri ukladaní reportu");
      navigate("/dashboardreport");
    } catch (e: any) {
      setError(e.message || "Chyba pri ukladaní");
    } finally {
      setLoading(false);
    }
  }

  function renderCMYKRow(chan: string, val: any) {
    if (!val) return null;
    const delta = val.rel_rozdiel;
    let vyhodnotenie = (
      <span className="text-green-700 font-bold ml-4">OK</span>
    );
    if (Math.abs(delta) >= 7) {
      vyhodnotenie = (
        <span
          className="font-bold ml-4"
          style={{ color: delta > 0 ? CMYK[chan as keyof typeof CMYK] : "#be185d" }}
        >
          {delta > 0 ? "Pridať" : "Ubrať"} {Math.abs(delta)}%
        </span>
      );
    }
    const tooltip = val.etiketa !== undefined && val.master !== undefined
      ? `${val.etiketa}% / ${val.master}%`
      : "";

    return (
      <div className="flex flex-row items-center mb-3 text-lg" key={chan} title={tooltip}>
        <div
          className="w-7 h-7 rounded mr-4"
          style={{ background: CMYK[chan as keyof typeof CMYK], border: "2px solid #bbb" }}
          title={NAMES[chan as keyof typeof NAMES]}
        />
        {vyhodnotenie}
      </div>
    );
  }

  return (
    <AppBackground>
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center py-8 relative"
        style={{ minHeight: "100vh" }}
      >
        <h2 className="text-3xl font-extrabold mb-4 text-gray-900 text-center tracking-tight">
          Porovnanie denzity etikiet
        </h2>

        <div className="flex flex-row gap-6 mb-10 w-full justify-center">
          <input
            type="text"
            className="bg-white/90 text-gray-800 placeholder-gray-500 rounded-xl px-6 py-4 text-lg font-normal focus:outline-none focus:ring focus:ring-blue-200 min-w-[180px] text-center shadow"
            placeholder="Meno operátora"
            value={operator}
            onChange={e => setOperator(e.target.value)}
            autoComplete="off"
          />
          <input
            type="text"
            className="bg-white/90 text-gray-800 placeholder-gray-500 rounded-xl px-6 py-4 text-lg font-normal focus:outline-none focus:ring focus:ring-blue-200 min-w-[180px] text-center shadow"
            placeholder="Produktové číslo"
            value={produkt}
            onChange={e => setProdukt(e.target.value)}
            autoComplete="off"
          />
          <input
            type="date"
            className="bg-white/90 text-gray-800 rounded-xl px-6 py-4 text-lg font-normal text-center shadow min-w-[130px]"
            value={datum}
            onChange={e => setDatum(e.target.value)}
          />
          <input
            type="time"
            className="bg-white/90 text-gray-800 rounded-xl px-6 py-4 text-lg font-normal text-center shadow min-w-[90px]"
            value={cas}
            onChange={e => setCas(e.target.value)}
          />
        </div>

        <div className="flex flex-row gap-24 w-full max-w-4xl justify-center items-start mb-6">
          {/* Master */}
          <div className="flex flex-col items-center flex-1">
            <button
              className="mb-2 w-[270px] bg-blue-700 text-white font-bold py-2 rounded-lg hover:bg-blue-800"
              onClick={loadMasterFromDisk}
              type="button"
              disabled={loading || !produkt}
            >
              Načítať master z disku
            </button>
            {masterUrl ? (
              <img
                src={masterUrl}
                alt="master"
                className="rounded-xl border border-gray-200 mb-2 max-w-[320px] max-h-[210px] object-contain"
                style={{ background: "#fafafa" }}
              />
            ) : (
              <div className="text-gray-400 mb-2 min-h-[110px] flex items-center justify-center font-semibold w-[320px]">
                Master etiketa
              </div>
            )}
            {masterUrl && (
              <button
                className="bg-gray-800 text-white px-4 py-1 rounded-lg font-medium flex items-center gap-2 hover:bg-black"
                onClick={handleRotateMaster}
                disabled={loading}
                type="button"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M17.65 6.35a7.95 7.95 0 0 0-11.3 0m0 0V3m0 3.35h3.34m7.96 7.95A7.95 7.95 0 0 1 6.34 6.34m11.31 0V3m0 3.35h-3.34" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Otočiť master o 90°
              </button>
            )}
          </div>
          {/* Sken etiketa */}
          <div className="flex flex-col items-center flex-1">
            <input
              type="file"
              accept="image/*"
              className="mb-4 w-[270px]"
              onChange={e => {
                const file = e.target.files?.[0] ?? null;
                setEtiketa(file);
                setEtiketaUrl(file ? URL.createObjectURL(file) : null);
              }}
              disabled={loading}
            />
            {etiketaUrl ? (
              <img
                src={etiketaUrl}
                alt="etiketa"
                className="rounded-xl border border-gray-200 mb-2 max-w-[350px] max-h-[230px] object-contain"
                style={{ background: "#fafafa" }}
              />
            ) : (
              <div className="text-gray-400 mb-8 min-h-[110px] flex items-center justify-center font-semibold w-[320px]">
                Sken etiketa
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-4 mt-2">
          <button
            className="bg-green-700 text-white font-bold px-8 py-3 rounded-xl text-lg hover:bg-green-800"
            onClick={handleCompare}
            disabled={!masterUrl || !etiketa || loading}
          >
            {loading ? "Porovnávam..." : "Porovnať"}
          </button>
          <button
            className="bg-purple-700 text-white font-bold px-8 py-3 rounded-xl text-lg hover:bg-purple-800"
            onClick={handleSaveReport}
            disabled={!result || loading}
            type="button"
          >
            Uložiť
          </button>
        </div>
        {error && <div className="text-red-600 mt-6 font-semibold">{error}</div>}

        {/* Výsledky CMYK */}
        {result && (
          <div className="mt-8 w-full max-w-[320px] flex flex-col items-center">
            <h3 className="font-bold text-xl mb-3 text-gray-900 text-left w-full">
              Výsledky CMYK
            </h3>
            <div className="flex flex-col gap-1 w-full">
              {["cyan", "magenta", "yellow", "black"].map(chan =>
                renderCMYKRow(chan, result[chan])
              )}
            </div>
          </div>
        )}
      </div>
    </AppBackground>
  );
}










