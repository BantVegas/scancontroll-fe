import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppBackground from "./AppBackground";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type CmykResult = {
  rel_rozdiel: number;
  etiketa?: number;
  master?: number;
};

const CMYK: Record<string, string> = {
  cyan: "#22d3ee",
  magenta: "#f472b6",
  yellow: "#fde047",
  black: "#222",
};
const NAMES: Record<string, string> = {
  cyan: "Cyan",
  magenta: "Magenta",
  yellow: "Yellow",
  black: "Black",
};

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

export default function DenzitaReport() {
  const [operator, setOperator] = useState("");
  const [produkt, setProdukt] = useState("");
  const [datum, setDatum] = useState("");
  const [cas, setCas] = useState("");
  const [masterUrl, setMasterUrl] = useState<string | null>(null);      // BE master
  const [masterFile, setMasterFile] = useState<File | null>(null);      // upload z PC
  const [masterFileUrl, setMasterFileUrl] = useState<string | null>(null);
  const [etiketa, setEtiketa] = useState<File | null>(null);
  const [etiketaUrl, setEtiketaUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, CmykResult> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const now = new Date();
    setDatum(now.toISOString().slice(0, 10));
    setCas(now.toTimeString().slice(0, 5));
  }, []);

  // Načíta master z backendu podľa productNumber
  function loadMasterFromDisk() {
    setError(null);
    setResult(null);
    setMasterFile(null);
    setMasterFileUrl(null);
    if (!produkt.trim()) {
      setError("Zadaj číslo produktu");
      return;
    }
    setMasterUrl(`${API_BASE}/api/master/image?productNumber=${produkt}`);
  }

  // Upload master etikety z ĽUBOVOĽNÉHO zdroja
  function handleUploadMaster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setMasterFile(file);
      setMasterFileUrl(URL.createObjectURL(file));
      setMasterUrl(null); // zruš backend URL
    }
  }

  // Upload etikety (vždy súbor)
  function handleUploadEtiketa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setEtiketa(file);
      setEtiketaUrl(URL.createObjectURL(file));
    }
  }

  // Porovnanie etikiet (POST na /api/denzita-compare)
  async function handleCompare() {
    if (!etiketa || !produkt.trim()) {
      setError("Vyber etiketu a zadaj produktové číslo!");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("etiketa", etiketa);
      form.append("productNumber", produkt);
      if (masterFile) {
        form.append("master", masterFile);
      }
      if (operator) form.append("operator", operator);

      const res = await fetch(`${API_BASE}/api/denzita-compare`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Chyba servera");
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || "Chyba porovnania");
    } finally {
      setLoading(false);
    }
  }

  async function handleRotateMaster() {
    const url = masterFileUrl || masterUrl;
    if (!url) return;
    setLoading(true);
    try {
      const rotated = await rotateImage90(url);
      if (masterFileUrl) setMasterFileUrl(rotated);
      else setMasterUrl(rotated);
    } catch {
      setError("Chyba pri rotácii obrázka");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveReport() {
    if (!result || !produkt) {
      setError("Najprv porovnaj etikety.");
      return;
    }
    setLoading(true);
    setError(null);
    const report = {
      operator: operator || "",
      productCode: produkt,
      datetime: `${datum} ${cas}`,
      cyan: typeof result.cyan?.rel_rozdiel === "number" ? result.cyan.rel_rozdiel : null,
      magenta: typeof result.magenta?.rel_rozdiel === "number" ? result.magenta.rel_rozdiel : null,
      yellow: typeof result.yellow?.rel_rozdiel === "number" ? result.yellow.rel_rozdiel : null,
      black: typeof result.black?.rel_rozdiel === "number" ? result.black.rel_rozdiel : null,
      summary: "OK",
      reportType: "DENZITA",
    };
    try {
      const res = await fetch(`${API_BASE}/api/denzita-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error("Chyba pri ukladaní reportu");
      navigate("/dashboardreport");
    } catch (e: any) {
      setError(e.message || "Chyba pri ukladaní");
    } finally {
      setLoading(false);
    }
  }

  function renderCMYKRow(chan: string, val?: CmykResult) {
    if (!val) return null;
    const delta = val.rel_rozdiel;
    let vyhodnotenie = (
      <span className="text-green-700 font-bold ml-4">OK</span>
    );
    if (Math.abs(delta) >= 7) {
      vyhodnotenie = (
        <span
          className="font-bold ml-4"
          style={{ color: delta > 0 ? CMYK[chan] : "#be185d" }}
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
          style={{ background: CMYK[chan], border: "2px solid #bbb" }}
          title={NAMES[chan]}
        />
        {vyhodnotenie}
      </div>
    );
  }

  return (
    <AppBackground>
      <div className="min-h-screen w-full flex flex-col items-center justify-center py-8 relative">
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
            <div className="flex gap-3 mb-3">
              <button
                className="w-[170px] bg-blue-700 text-white font-bold py-2 rounded-lg hover:bg-blue-800"
                onClick={loadMasterFromDisk}
                type="button"
                disabled={loading || !produkt}
              >
                Načítať master z disku
              </button>
              <label
                className="w-[170px] bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-800 text-center cursor-pointer"
                style={{ display: "inline-block" }}
              >
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleUploadMaster}
                  disabled={loading}
                />
                Nahrať master z PC
              </label>
            </div>
            {masterFileUrl ? (
              <img
                src={masterFileUrl}
                alt="master-upload"
                className="rounded-xl border border-gray-200 mb-2 max-w-[320px] max-h-[210px] object-contain"
                style={{ background: "#fafafa" }}
              />
            ) : masterUrl ? (
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
            {(masterUrl || masterFileUrl) && (
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
              onChange={handleUploadEtiketa}
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
            disabled={(!masterUrl && !masterFileUrl && !masterFile) || !etiketa || loading}
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


