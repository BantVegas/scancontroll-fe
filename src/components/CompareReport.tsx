import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppBackground from "./AppBackground";

const DIFF_LIMIT = 2.5;

type BarcodeItem = { index: number; valid: boolean; error?: string | null };
type OcrItem = { labelIndex: number; error?: string | null };
type ColorItem = { labelIndex?: number; summary?: string; cyan?: any; magenta?: any; yellow?: any; black?: any };
type CroppedLabel = { url: string; w: number; h: number; ok?: boolean };

interface LocationState {
  operator?: string;
  jobNumber?: string;
  zakazka?: string;
  productNumber?: string;
  produkt?: string;
  machine?: string;
  stroj?: string;
  spoolNumber?: string;
  expectedWind?: string;
  detectedWind?: string;
  windResult?: string;
  windDetail?: string;
  barcodeData?: BarcodeItem[];
  ocrData?: OcrItem[];
  colorData?: ColorItem[];
  croppedLabels?: CroppedLabel[];
}

async function saveReportToServer(report: any) {
  const res = await fetch("http://localhost:8080/api/report/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  const data = await res.json();
  if (res.ok) {
    alert("Report uložený!\n" + (data.txt ?? ""));
    return true;
  } else {
    alert("Chyba pri ukladaní reportu: " + (data.error ?? "Neznáma chyba"));
    return false;
  }
}

export default function CompareReport() {
  const { state = {} } = useLocation();
  const navigate = useNavigate();

  // Rozbalenie údajov + fallbacky
  const {
    operator = "",
    jobNumber,
    zakazka,
    productNumber,
    produkt,
    machine,
    stroj,
    spoolNumber = "",
    expectedWind = "",
    detectedWind = "",
    windResult = "",
    windDetail = "",
    barcodeData = [],
    ocrData = [],
    colorData = [],
    croppedLabels = [],
  } = state as LocationState;

  // Fallback aj na string (niekedy je v query)
  function getSafeValue(primary?: string, secondary?: string, paramName?: string) {
    if (primary && typeof primary === "string" && primary.trim() && primary !== "-") return primary;
    if (secondary && typeof secondary === "string" && secondary.trim() && secondary !== "-") return secondary;
    try {
      const params = new URLSearchParams(window.location.search);
      const val = params.get(paramName || "");
      if (val && val.trim() && val !== "-") return val;
    } catch { }
    return "-";
  }

  const _jobNumber = getSafeValue(jobNumber, zakazka, "jobNumber");
  const _productCode = getSafeValue(productNumber, produkt, "productNumber");
  const _machine = machine ?? stroj ?? "-";

  // *** VŽDY AKTUÁLNY ČAS ***
  const _datetime = useMemo(() => {
    return new Date().toLocaleString("sk-SK", {
      hour12: false,
      timeZone: "Europe/Bratislava"
    });
  }, []);

  const barcodeFailIndexes = useMemo(
    () => (barcodeData || []).filter(b => b && b.valid === false).map(b => b.index),
    [barcodeData]
  );
  const ocrFailIndexes = useMemo(
    () => [...new Set((ocrData || []).filter(o => o && o.error).map(o => o.labelIndex))],
    [ocrData]
  );
  const imageOk = !croppedLabels.length || croppedLabels.every(l => l.ok);
  const barcodeOk = barcodeFailIndexes.length === 0;
  const ocrOk = ocrFailIndexes.length === 0;
  const colorVerdict = useMemo(() => {
    if (!Array.isArray(colorData) || colorData.length === 0) return "-";
    return colorData.some(c => c.summary && c.summary !== "OK") ? "Chyba" : "OK";
  }, [colorData]);

  const textErrors = ocrData?.filter(o => o && o.error).length || 0;
  const barcodeErrors = barcodeData?.filter(b => b && b.valid === false).length || 0;
  const summary = [
    `NAVIN: ${windResult === "OK" ? "OK" : "Chyba"}`,
    `Čiarový kód: ${barcodeErrors === 0 ? "OK" : "Chyba v " + barcodeErrors + " etikete/kách"}`,
    `Text: ${textErrors === 0 ? "OK" : "Chyba v " + textErrors + " riadku/riadkoch"}`,
    `Farebnosť: ${colorData?.some(c => c.summary && c.summary !== "OK") ? "Chyba" : "OK"}`,
    `Obraz: ${imageOk ? "OK" : "Chyba"}`
  ].join(" | ");

  const [note, setNote] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);

  async function handleSave() {
    const missing: string[] = [];
    if (!_productCode || _productCode === "-") missing.push("číslo produktu");
    if (!_jobNumber || _jobNumber === "-") missing.push("číslo zákazky");
    setMissingFields(missing);
    if (missing.length > 0) {
      return;
    }

    // POSIELAJ VŠETKY DÁTUMY ROVNAKO
    const report = {
      reportType: "COMPARE",
      operator,
      jobNumber: _jobNumber,
      zakazka: _jobNumber,
      productNumber: _productCode,
      produkt: _productCode,
      machine: _machine,
      stroj: _machine,
      datum: _datetime,
      datetime: _datetime,
      controlDate: _datetime,
      summary,
      textErrors,
      barcodeErrors,
      expectedWind,
      detectedWind,
      windResult,
      windDetail,
      barcodeData,
      ocrData,
      colorData,
      croppedLabels,
      note,
      compareDetail: {
        expectedWind,
        detectedWind,
        windResult,
        windDetail,
        barcodeData,
        ocrData,
        colorData,
        croppedLabels,
        note,
      },
      barcodeResult: barcodeOk
        ? "OK"
        : `Chyba v etikete č.${barcodeFailIndexes.join(", ")}`,
      ocrResult: ocrOk
        ? "OK"
        : `Chyba v texte etiketa č.${ocrFailIndexes.join(", ")}`,
      colorResult: colorVerdict
    };
    console.log("Report na uloženie:", report);

    const ok = await saveReportToServer(report);
    if (ok) navigate("/dashboard");
  }

  function handlePrint() {
    window.print();
  }

  function getLabelBadge(idx: number) {
    const barcode = barcodeData.find(b => b.index === idx);
    const ocrErrs = ocrData.filter(o => o.labelIndex === idx && o.error);
    return (
      <div className="flex flex-col gap-2 w-full items-center mt-2">
        {barcode && barcode.valid === false ? (
          <div className="px-4 py-1 bg-red-100 text-red-700 rounded-xl text-sm border border-red-300 text-center">
            Čiarový kód: {barcode.error || "Chyba"}
          </div>
        ) : (
          <div className="px-4 py-1 bg-green-100 text-green-800 rounded-xl text-sm border border-green-300 text-center">
            Čiarový kód: OK
          </div>
        )}
        {ocrErrs.length ? (
          <div className="px-4 py-1 bg-red-100 text-red-700 rounded-xl text-sm border border-red-300 text-center">
            Text: Chyba {ocrErrs.length === 1 ? "v 1 riadku" : `v ${ocrErrs.length} riadkoch`}
          </div>
        ) : (
          <div className="px-4 py-1 bg-green-100 text-green-800 rounded-xl text-sm border border-green-300 text-center">
            Text: OK
          </div>
        )}
      </div>
    );
  }

  function renderColorTable() {
    if (!Array.isArray(colorData) || colorData.length === 0) return null;
    const fmt = (n: any) =>
      n === null || n === undefined || isNaN(Number(n))
        ? "-"
        : Number(n).toFixed(1);
    const channels = [
      { key: "cyan", label: "C" },
      { key: "magenta", label: "M" },
      { key: "yellow", label: "Y" },
      { key: "black", label: "K" }
    ];
    function formatDiffSegments(c: any) {
      return channels.map(ch => {
        const channel = c[ch.key];
        const val = (channel && typeof channel.rozdiel === "number")
          ? channel.rozdiel
          : (channel && channel.rozdiel !== undefined
            ? Number(channel.rozdiel)
            : null);
        if (val === null || isNaN(val)) {
          return (
            <span key={ch.label} className="mr-3 font-mono text-gray-400">{ch.label}:-</span>
          );
        }
        const abs = Math.abs(val);
        const ok = abs < DIFF_LIMIT;
        return (
          <span
            key={ch.label}
            className={`mr-3 font-mono font-semibold ${ok ? "text-green-700" : "text-red-600"}`}
          >
            {ch.label}:{val.toFixed(1)}
          </span>
        );
      });
    }

    return (
      <div className="mt-12 w-full max-w-5xl mx-auto">
        <h3 className="font-bold text-lg mb-3">
          Vyhodnotenie farebnosti (CMYK)
        </h3>
        <table className="w-full bg-white rounded shadow text-sm">
          <thead>
            <tr className="border-b text-gray-700">
              <th className="py-2 px-3 text-left">Etiketa</th>
              <th className="py-2 px-3 text-left">C/M/Y/K etiketa</th>
              <th className="py-2 px-3 text-left">Rozdiel C/M/Y/K</th>
              <th className="py-2 px-3 text-left">Výsledok</th>
            </tr>
          </thead>
          <tbody>
            {colorData.map((c, i) => {
              const cy = c.cyan || {};
              const mg = c.magenta || {};
              const yl = c.yellow || {};
              const bk = c.black || {};
              return (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-2 px-3 font-semibold">
                    Etiketa č.{c.labelIndex ?? i + 1}
                  </td>
                  <td className="py-2 px-3 font-mono">
                    C:{fmt(cy.etiketa)}&nbsp; M:{fmt(mg.etiketa)}&nbsp; Y:{fmt(yl.etiketa)}&nbsp; K:{fmt(bk.etiketa)}
                  </td>
                  <td className="py-2 px-3">{formatDiffSegments(c)}</td>
                  <td className="py-2 px-3">
                    {c.summary === "OK" ? (
                      <span className="text-green-700 font-bold">OK</span>
                    ) : (
                      <span className="text-red-600 font-bold">
                        {c.summary || "Chyba"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-xs text-gray-500 mt-2">
          Zelená: |rozdiel| &lt; {DIFF_LIMIT}, červená: ≥ {DIFF_LIMIT}
        </div>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <AppBackground className="bg-white min-h-screen">
      <div className="flex flex-col md:flex-row w-full max-w-[1440px] mx-auto py-8 px-6 gap-8">
        {/* Ľavý SUMMARY panel */}
        <div className="flex flex-col gap-3 min-w-[400px] max-w-[600px] bg-white/95 p-8 rounded-2xl shadow border border-gray-200">
          <h1 className="font-bold text-3xl mb-5 mt-2">Výsledky porovnania etikiet</h1>
          {/* NAVIN výsledok */}
          <div className="text-lg mb-2">
            <b>NAVIN:</b>{" "}
            {windResult === "OK" ? (
              <span className="text-green-700 ml-2">
                {detectedWind || expectedWind} – OK
              </span>
            ) : (
              <span className="text-red-600 ml-2">
                chyba (detegovaný: <b>{detectedWind || "-"}</b>
                {expectedWind && (
                  <> , očakávaný: <b>{expectedWind}</b></>
                )}
                )
                {windDetail && (
                  <div className="text-xs text-gray-500 mt-1">{windDetail}</div>
                )}
              </span>
            )}
          </div>
          <div className="text-lg">
            <b>Čiarový kód:</b>{" "}
            {barcodeOk
              ? <span className="text-green-700 ml-2">OK</span>
              : <span className="text-red-600 ml-2">Etiketa č.{barcodeFailIndexes.join(", ")}</span>
            }
          </div>
          <div className="text-lg">
            <b>Text:</b>{" "}
            {ocrOk
              ? <span className="text-green-700 ml-2">OK</span>
              : <span className="text-red-600 ml-2">Etiketa č.{ocrFailIndexes.join(", ")}</span>
            }
          </div>
          <div className="text-lg">
            <b>Farebnosť:</b>{" "}
            {colorVerdict === "OK"
              ? <span className="text-green-700 ml-2">OK</span>
              : colorVerdict === "Chyba"
                ? <span className="text-red-600 ml-2">Chyba</span>
                : <span className="text-gray-500 ml-2">–</span>
            }
          </div>
          <div className="text-lg">
            <b>Obraz:</b>{" "}
            {imageOk
              ? <span className="text-green-700 ml-2">OK</span>
              : <span className="text-red-600 ml-2">Chyba</span>
            }
          </div>
          {missingFields.length > 0 && (
            <div className="text-red-600 mt-4 font-semibold">
              Chýba: {missingFields.join(", ")} – nemožno uložiť report!
            </div>
          )}
        </div>

        {/* Pravý panel - údaje */}
        <div className="flex-1 flex flex-col md:items-end items-start">
          <div className="bg-white/90 rounded-xl p-7 shadow max-w-xl w-full mb-6 border border-gray-300">
            <div className="font-bold text-2xl mb-3">Výsledky kontroly etikiet</div>
            <div className="text-gray-800 text-lg">
              <div>
                Meno operátora: <b>{operator || "-"}</b>
              </div>
              <div>
                Číslo zákazky:{" "}
                <b className={_jobNumber === "-" ? "text-red-600" : ""}>{_jobNumber}</b>
              </div>
              <div>
                Číslo produktu:{" "}
                <b className={_productCode === "-" ? "text-red-600" : ""}>{_productCode}</b>
              </div>
              <div>Stroj: <b>{_machine}</b></div>
              <div>Číslo kotúča: <b>{spoolNumber || "-"}</b></div>
              <div>Dátum a čas kontroly: <b>{_datetime}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid etikiet s badge pod obrázkom */}
      <div className="mt-6 px-6 pb-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-12 gap-y-16 max-w-[1440px] mx-auto">
        {croppedLabels.map((label, i) => (
          <div key={i} className="flex flex-col items-center">
            <img
              src={label.url}
              alt={`Etiketa č.${i + 1}`}
              className="rounded-xl shadow-md border border-gray-200 object-contain"
              style={{ width: 260, height: 360, background: "#f9f9f9" }}
            />
            <div className="mt-2 font-semibold text-base text-gray-700">
              Etiketa č.{i + 1}
            </div>
            <div className="text-xs text-gray-500">
              {label.w} × {label.h} px
            </div>
            {getLabelBadge(i + 1)}
          </div>
        ))}
      </div>

      {/* Poznámka od operátora */}
      <div className="max-w-4xl w-full mx-auto mt-10 mb-10 px-4">
        <label className="block mb-2 font-semibold text-xl text-gray-800">
          Poznámka operátora:
        </label>
        <textarea
          className="w-full min-h-[80px] max-h-[300px] border border-gray-400 rounded-xl p-4 text-lg"
          placeholder="Sem môže operátor napísať poznámku k výsledku kontroly..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      {/* Tabuľka farebnosti */}
      {renderColorTable()}

      {/* Akcie - tlačidlá */}
      <div className="flex gap-8 mt-12 justify-center print:hidden mb-24">
        <button
          onClick={handleSave}
          disabled={_productCode === "-" || _jobNumber === "-"}
          className="bg-green-600 hover:bg-green-700 text-white text-lg px-10 py-4 rounded-xl shadow font-semibold transition disabled:opacity-60"
        >
          Uložiť Report
        </button>
        <button
          onClick={handlePrint}
          className="bg-blue-700 hover:bg-blue-800 text-white text-lg px-10 py-4 rounded-xl shadow font-semibold transition"
        >
          Vytlačiť ako PDF
        </button>
      </div>
    </AppBackground>
  );
}








































