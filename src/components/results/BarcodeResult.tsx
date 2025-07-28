import React from 'react';

interface BarcodeResultProps {
  barcodeData?: string;
  isValid?: boolean;
  errorMessage?: string;
}

const BarcodeResult: React.FC<BarcodeResultProps> = ({ barcodeData, isValid, errorMessage }) => {
  return (
    <div className="p-4 border rounded shadow bg-white">
      <h3 className="font-semibold mb-2">Výsledok čiarového kódu</h3>
      {barcodeData ? (
        <>
          <p><b>Data:</b> {barcodeData}</p>
          <p className={isValid ? "text-green-600" : "text-red-600"}>
            {isValid ? "Platný čiarový kód" : `Chyba: ${errorMessage || "Neznáma chyba"}`}
          </p>
        </>
      ) : (
        <p>Čiarový kód nebol analyzovaný.</p>
      )}
    </div>
  );
};

export default BarcodeResult;
