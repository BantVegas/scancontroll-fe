import React from 'react';

interface TextResultProps {
  extractedText?: string;
  errors?: string[];
}

const TextResult: React.FC<TextResultProps> = ({ extractedText, errors }) => {
  return (
    <div className="p-4 border rounded shadow bg-white">
      <h3 className="font-semibold mb-2">Výsledok OCR textu</h3>
      {extractedText ? (
        <pre className="whitespace-pre-wrap bg-gray-100 p-2 rounded text-sm">{extractedText}</pre>
      ) : (
        <p>Žiadny extrahovaný text.</p>
      )}
      {errors && errors.length > 0 && (
        <div className="mt-2 text-red-600">
          <b>Chyby v texte:</b>
          <ul className="list-disc ml-5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TextResult;
