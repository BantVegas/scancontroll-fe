import React, { useState, useEffect } from "react";
import AppBackground from "./AppBackground";
import { CheckCircle2, Info } from "lucide-react";

// Automaticky načítaj BASE URL pre API z .env súboru (VITE_API_BASE_URL)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type ScanReport = {
  id: number;
  reportType: string;
  operator: string;
  productCode: string;
  jobNumber?: string;
  machine?: string;
  datetime: string;
  detailsJson?: string;
  etikety?: any[];
  windResult?: string;
  detectedWind?: string;
  barcodeResult?: string;
  ocrResult?: string;
  colorResult?: string;
  note?: string;
  fileSize?: number;
};

const CMYK_COLORS = {
  cyan: "#22d3ee",
  magenta: "#f472b6",
  yellow: "#fde047",
  black: "#222",
};
const NAMES = {
  cyan: "Cyan",
  magenta: "Magenta",
  yellow: "Yellow",
  black: "Black",
};
const MAX_DETAIL_SIZE = 20 * 1024 * 1024;

const pick = (...args: any[]) => args.find((v) => v !== undefined && v !== null);

export default function DashboardReport() {
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [typeFilter, setTypeFilter] = useState<"" | "COMPARE" | "DENZITA" | "PANTONE">("");
  const [loading, setLoading] = useState(false);
  const [modalDetail, setModalDetail] = useState<null | ScanReport>(null);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report`);
      const data = await res.json();
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Naozaj chceš vymazať tento report?")) return;
    await fetch(`${API_BASE}/api/report/${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r.id !== id));
    setModalDetail(null);
  }

  const Badge = ({
    children,
    color = "gray",
  }: {
    children: React.ReactNode;
    color?: string;
  }) => (
    <span
      className={
        "inline-block rounded-full px-3 py-1 text-xs font-semibold mr-2 " +
        (color === "green"
          ? "bg-green-100 text-green-700"
          : color === "red"
          ? "bg-red-100 text-red-700"
          : color === "yellow"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-200 text-gray-800")
      }
    >
      {children}
    </span>
  );

  function renderColorDiff(etiketa: any) {
    if (etiketa.colorDiff != null) {
      return (
        <span className="ml-2 text-xs text-blue-700">
          ΔE: {etiketa.colorDiff}
        </span>
      );
    }
    if (etiketa.colorValues && typeof etiketa.colorValues === "object") {
      return (
        <span className="ml-2 text-xs text-blue-700">
          {Object.entries(etiketa.colorValues)
            .map(([ch, v]) =>
              `${ch.toUpperCase()}: ${parseFloat(v as string).toFixed(2)}`
            )
            .join(" | ")}
        </span>
      );
    }
    return null;
  }

  // UNIVERZÁLNY detail merge pre všetky typy reportov
  function parseDetails(report: ScanReport) {
    let detail: any = { ...report };
    try {
      if (report.detailsJson) {
        const parsed = JSON.parse(report.detailsJson);
        if (typeof parsed === "object" && parsed !== null) {
          detail = { ...report, ...parsed };
        }
      }
    } catch {}
    return detail;
  }

  function renderDetailCard(r: ScanReport) {
    if (r.fileSize && r.fileSize > MAX_DETAIL_SIZE) {
      return (
        <div className="text-red-700 text-lg font-bold p-6">
          Tento report je príliš veľký (&gt; 20MB) a nemožno ho zobraziť v dashboarde.
          <br />
          Skontrolujte výstup na serveri alebo stiahnite súbor ručne.
        </div>
      );
    }

    const detail = parseDetails(r);

    // === COMPARE ===
    if ((r.reportType ?? "").toUpperCase() === "COMPARE") {
      const windResult = pick(detail.windResult, r.windResult, "-");
      const detectedWind = pick(detail.detectedWind, r.detectedWind, "-");
      const barcodeResult = pick(detail.barcodeResult, r.barcodeResult, "-");
      const ocrResult = pick(detail.ocrResult, r.ocrResult, "-");
      const colorResult = pick(detail.colorResult, r.colorResult, "-");
      const note = pick(detail.note, r.note, "");
      const etikety = detail.etikety || [];

      return (
        <div className="flex flex-col gap-4 w-full text-[1.05rem]">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="text-blue-700" size={28} />
            <h2 className="text-2xl font-bold text-blue-900">
              Výsledok kontroly etikiet
            </h2>
            <span className="text-gray-500 ml-auto font-mono">{r.datetime}</span>
          </div>
          <div className="flex flex-wrap gap-8 font-semibold text-base mb-1">
            <span>Operátor: <span className="font-bold text-gray-900">{pick(detail.operator, r.operator, "-")}</span></span>
            <span>Produkt: <span className="font-bold text-gray-900">{pick(detail.productCode, r.productCode, "-")}</span></span>
            <span>Zakázka: <span className="font-bold text-gray-900">{pick(detail.jobNumber, r.jobNumber, "-")}</span></span>
            <span>Stroj: <span className="font-bold text-gray-900">{pick(detail.machine, r.machine, "-")}</span></span>
            <span>Kotúč: <span className="font-bold text-gray-900">{pick(detail.spoolNumber, "-")}</span></span>
          </div>
          <hr className="my-1 border-gray-200" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 text-lg">
            <div>
              <b>NAVIN:</b>{" "}
              {windResult === "OK" ? (
                <Badge color="green">{windResult} {detectedWind && `(${detectedWind})`}</Badge>
              ) : windResult !== "-" ? (
                <Badge color="red">{windResult} {detectedWind && `(${detectedWind})`}</Badge>
              ) : (
                <Badge color="gray">-</Badge>
              )}
            </div>
            <div>
              <b>Čiarový kód:</b>{" "}
              {barcodeResult && barcodeResult.toLowerCase().includes("chyba") ? (
                <Badge color="red">Chyba</Badge>
              ) : (
                <Badge color="green">OK</Badge>
              )}
            </div>
            <div>
              <b>Text:</b>{" "}
              {ocrResult && ocrResult.toLowerCase().includes("chyba") ? (
                <Badge color="red">Chyba</Badge>
              ) : (
                <Badge color="green">OK</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-row gap-5 mb-2 items-center text-lg">
            <b>Farebnosť:</b>{" "}
            {colorResult && colorResult !== "OK" ? (
              <Badge color="yellow">Chyba</Badge>
            ) : (
              <Badge color="green">OK</Badge>
            )}
          </div>
          <div className="text-sm text-gray-500">Detegovaný navin: {detectedWind || "-"}</div>
          {note && (
            <div className="my-1 text-gray-800 italic bg-blue-50 p-2 rounded-xl">
              <span className="font-semibold">Poznámka:</span> {note}
            </div>
          )}
          <div>
            <div className="font-bold mb-2 text-lg text-blue-800">Výsledky jednotlivých etikiet:</div>
            <div className="flex flex-col gap-1">
              {(etikety || []).map((etiketa: any) => (
                <div
                  key={etiketa.index}
                  className="pt-2 pb-3 px-2 border-b border-gray-200 last:border-0 bg-white"
                  style={{
                    background:
                      etiketa.barcodeError || etiketa.ocrError || etiketa.colorError
                        ? "#fff7f7"
                        : "#f6fefb",
                  }}
                >
                  <div className="font-semibold text-base mb-1">
                    Etiketa č.{etiketa.index}
                  </div>
                  <div>
                    <b>Čiarový kód:</b>{" "}
                    {etiketa.barcodeError ? (
                      <span className="text-red-700 font-semibold">{etiketa.barcodeError}</span>
                    ) : (
                      <span className="text-green-700 font-semibold">OK</span>
                    )}
                  </div>
                  <div>
                    <b>Text:</b>{" "}
                    {etiketa.ocrError ? (
                      <span className="text-red-700 font-semibold">{etiketa.ocrError}</span>
                    ) : (
                      <span className="text-green-700 font-semibold">OK</span>
                    )}
                  </div>
                  <div>
                    <b>Farebnosť:</b>{" "}
                    {etiketa.colorError ? (
                      <span className="text-yellow-600 font-semibold">{etiketa.colorError}</span>
                    ) : (
                      <span className="text-green-700 font-semibold">OK</span>
                    )}
                    {renderColorDiff(etiketa)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <button
              className="text-gray-400 hover:text-red-600 font-semibold text-sm"
              onClick={() => handleDelete(r.id)}
            >
              Vymazať
            </button>
          </div>
        </div>
      );
    }

    // === DENZITA ===
    if ((r.reportType ?? "").toUpperCase() === "DENZITA") {
      // fallback na všetky možné polia (čísla alebo stringy)
      const cyan = pick(detail.c, detail.cyan, detail.C, detail.CYAN);
      const magenta = pick(detail.m, detail.magenta, detail.M, detail.MAGENTA);
      const yellow = pick(detail.y, detail.yellow, detail.Y, detail.YELLOW);
      const black = pick(detail.k, detail.black, detail.K, detail.BLACK);
      return (
        <div className="flex flex-col gap-3 w-full">
          <h2 className="text-2xl font-bold mb-2 text-cyan-900 flex items-center gap-2">
            <Info className="text-cyan-500" /> Výsledky CMYK
          </h2>
          <div className="flex flex-wrap gap-6 font-semibold text-base">
            <span>Operátor: <span className="font-bold text-gray-900">{pick(detail.operator, r.operator, "-")}</span></span>
            <span>Produkt: <span className="font-bold text-gray-900">{pick(detail.productCode, r.productCode, "-")}</span></span>
            <span className="text-gray-500 ml-auto">{r.datetime}</span>
          </div>
          <hr className="my-2" />
          {[{ key: "cyan", value: cyan }, { key: "magenta", value: magenta }, { key: "yellow", value: yellow }, { key: "black", value: black }].map(({ key, value }) => (
            <div key={key} className="flex items-center mb-1 text-lg">
              <div
                className="w-7 h-7 rounded mr-4 border-2 border-gray-300"
                style={{
                  background: CMYK_COLORS[key as keyof typeof CMYK_COLORS],
                }}
                title={NAMES[key as keyof typeof NAMES]}
              />
              <span className="font-semibold mr-3">{NAMES[key as keyof typeof NAMES]}</span>
              <span className="text-gray-700 mr-2">
                {value !== undefined && value !== null && value !== ""
                  ? (isNaN(Number(value)) ? value : `${Number(value).toFixed(2)}%`)
                  : "-"}
              </span>
              {value !== undefined && value !== null && value !== "" && !isNaN(Number(value)) && Math.abs(Number(value)) >= 7 && (
                <span
                  className="font-bold"
                  style={{
                    color: Number(value) > 0 ? CMYK_COLORS[key as keyof typeof CMYK_COLORS] : "#be185d",
                  }}
                >
                  {Number(value) > 0 ? "Pridať" : "Ubrať"} {Math.abs(Number(value))}%
                </span>
              )}
              {value !== undefined && value !== null && value !== "" && !isNaN(Number(value)) && Math.abs(Number(value)) < 7 && (
                <span className="text-green-700 font-bold ml-2">OK</span>
              )}
            </div>
          ))}
          {detail.summary && (
            <div className="text-xs text-gray-500 mt-2">{detail.summary}</div>
          )}
          <div className="flex gap-4 mt-4">
            <button
              className="text-gray-400 hover:text-red-600 font-semibold text-sm"
              onClick={() => handleDelete(r.id)}
            >
              Vymazať
            </button>
          </div>
          <div className="text-xs text-gray-300 mt-3">
            <b>DEBUG:</b> {JSON.stringify(detail)}
          </div>
        </div>
      );
    }

    // === PANTONE ===
    if ((r.reportType ?? "").toUpperCase() === "PANTONE") {
      return (
        <div className="flex flex-col gap-3 w-full">
          <h2 className="text-2xl font-bold mb-2 text-pink-900 flex items-center gap-2">
            <Info className="text-pink-500" /> Porovnanie Pantone
          </h2>
          <div className="flex flex-wrap gap-6 font-semibold text-base">
            <span>Operátor: <span className="font-bold text-gray-900">{pick(detail.operator, r.operator, "-")}</span></span>
            <span>Produkt: <span className="font-bold text-gray-900">{pick(detail.productCode, r.productCode, "-")}</span></span>
            <span className="text-gray-500 ml-auto">{r.datetime}</span>
          </div>
          <hr className="my-2" />
          <div className="flex flex-col gap-2 text-base">
            <div>
              <b>Pantone:</b> {pick(detail.pantoneCode, detail.pantone, "-")}
              <span
                style={{
                  background: pick(detail.pantoneHex, "#eee"),
                  border: "1px solid #ccc",
                  padding: "0 10px",
                  borderRadius: 6,
                  marginLeft: 8,
                  color: "#222",
                }}
              >
                {pick(detail.pantoneHex, "-")}
              </span>
            </div>
            <div>
              <b>Originál RGB:</b> {pick(detail.refR, detail.rgbRef, "-")},{" "}
              {pick(detail.refG, "-")}, {pick(detail.refB, "-")}
            </div>
            <div>
              <b>Sken RGB:</b> {pick(detail.sampleR, "-")}, {pick(detail.sampleG, "-")},{" "}
              {pick(detail.sampleB, "-")}
            </div>
            <div>
              <b>ΔE2000:</b>{" "}
              {pick(detail.deltaE2000, detail.de2000, "-") !== "-"
                ? Number(pick(detail.deltaE2000, detail.de2000)).toFixed(2)
                : "-"}
            </div>
            <div>
              <b>ΔE76:</b>{" "}
              {pick(detail.deltaE76, detail.de76, "-") !== "-"
                ? Number(pick(detail.deltaE76, detail.de76)).toFixed(2)
                : "-"}
            </div>
            <div>
              <b>% zhody:</b>{" "}
              {pick(detail.matchPercent, "-") !== "-"
                ? Number(pick(detail.matchPercent)).toFixed(1) + "%"
                : "-"}
            </div>
            <div>
              <b>Vyhodnotenie:</b> {pick(detail.rating, "-")}
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            <button
              className="text-gray-400 hover:text-red-600 font-semibold text-sm"
              onClick={() => handleDelete(r.id)}
            >
              Vymazať
            </button>
          </div>
          <div className="text-xs text-gray-300 mt-3">
            <b>DEBUG:</b> {JSON.stringify(detail)}
          </div>
        </div>
      );
    }

    // === neznámy typ reportu ===
    return (
      <div className="text-gray-500 p-4">
        <h2 className="text-xl font-bold mb-2">Detail reportu</h2>
        <p>
          <b>ID:</b> {r.id}
        </p>
        <p>
          <b>Typ:</b> {r.reportType}
        </p>
        <p>
          <b>Dátum:</b> {r.datetime}
        </p>
        <div className="text-xs text-gray-300 mt-3">
          <b>DEBUG:</b> {JSON.stringify(detail)}
        </div>
      </div>
    );
  }

  const filtered = typeFilter
    ? reports.filter(
        (r) => (r.reportType ?? "").toUpperCase() === typeFilter
      )
    : reports;

  return (
    <AppBackground>
      <div className="relative z-20 w-full max-w-5xl flex flex-col items-center py-10 px-3">
        <h1 className="text-4xl font-bold text-white mb-10 drop-shadow-xl">
          Reporty zo Scancontroll
        </h1>
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setTypeFilter("")}
            className={`px-5 py-2 rounded-xl font-semibold shadow ${
              typeFilter === ""
                ? "bg-blue-700 text-white"
                : "bg-white/20 text-white"
            }`}
          >
            Všetky
          </button>
          <button
            onClick={() => setTypeFilter("COMPARE")}
            className={`px-5 py-2 rounded-xl font-semibold shadow ${
              typeFilter === "COMPARE"
                ? "bg-blue-700 text-white"
                : "bg-white/20 text-white"
            }`}
          >
            Porovnanie
          </button>
          <button
            onClick={() => setTypeFilter("DENZITA")}
            className={`px-5 py-2 rounded-xl font-semibold shadow ${
              typeFilter === "DENZITA"
                ? "bg-cyan-700 text-white"
                : "bg-white/20 text-white"
            }`}
          >
            Denzita
          </button>
          <button
            onClick={() => setTypeFilter("PANTONE")}
            className={`px-5 py-2 rounded-xl font-semibold shadow ${
              typeFilter === "PANTONE"
                ? "bg-pink-700 text-white"
                : "bg-white/20 text-white"
            }`}
          >
            Pantone
          </button>
        </div>
        <div className="w-full max-w-3xl bg-white/85 rounded-xl shadow-lg overflow-x-auto">
          {loading ? (
            <div className="text-center text-gray-400 py-8 text-lg">
              Načítava sa...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-lg">
              Žiadne záznamy
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Dátum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Produktové číslo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Operátor
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-50 cursor-pointer transition"
                    onClick={() => setModalDetail(r)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800 font-mono">
                      {r.datetime}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-blue-900 font-semibold">
                      {r.productCode}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.operator}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-blue-500 hover:underline text-xs">
                        Detail
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl relative animate-fadeIn flex flex-col"
            style={{
              maxHeight: "96vh",
              minHeight: 300,
              padding: 0,
            }}
          >
            <button
              onClick={() => setModalDetail(null)}
              className="absolute top-6 right-8 text-gray-500 hover:text-red-600 text-3xl font-bold z-50"
              style={{
                background: "#fff",
                borderRadius: "100%",
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 6px #0001",
              }}
              title="Zavrieť"
            >
              ✕
            </button>
            <div
              className="overflow-y-auto p-10"
              style={{ maxHeight: "90vh" }}
            >
              {renderDetailCard(modalDetail)}
            </div>
          </div>
        </div>
      )}
    </AppBackground>
  );
} 






















