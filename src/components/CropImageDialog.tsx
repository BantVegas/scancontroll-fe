import { useRef } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";


interface CropImageDialogProps {
  src: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

export default function CropImageDialog({ src, onCrop, onCancel }: CropImageDialogProps) {
  const cropperRef = useRef<any>(null); // funguje univerzálne

  const handleCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const canvas = cropper.getCroppedCanvas();
      if (canvas) {
        canvas.toBlob((blob: Blob | null) => {
          if (blob) onCrop(blob);
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg flex flex-col items-center">
        <Cropper
          src={src}
          style={{ height: 400, width: 600 }}
          // aspectRatio={0} // = voľný obdĺžnik, môžeš odkomentovať ak chceš
          viewMode={1}
          guides={true}
          dragMode="move"
          cropBoxResizable={true}
          cropBoxMovable={true}
          ref={cropperRef}
        />
        <div className="flex gap-4 mt-4">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={handleCrop}
          >
            Orezať
          </button>
          <button
            className="bg-gray-400 text-white px-4 py-2 rounded"
            onClick={onCancel}
          >
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  );
}








