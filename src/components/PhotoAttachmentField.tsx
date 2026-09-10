import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, ZoomIn, Loader2 } from 'lucide-react';
import { compressImageFile } from '../utils/imageCompressor';

interface PhotoAttachmentFieldProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  label?: string;
}

export const PhotoAttachmentField: React.FC<PhotoAttachmentFieldProps> = ({
  photos = [],
  onChange,
  maxPhotos = 3,
  label = 'ဘောင်ချာ / ပစ္စည်း ဓာတ်ပုံ ပူးတွဲမှတ်တမ်း (Photo Attachment)',
}) => {
  const [compressing, setCompressing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    const newPhotos = [...photos];

    for (let i = 0; i < files.length; i++) {
      if (newPhotos.length >= maxPhotos) break;
      const file = files[i];
      try {
        const compressedDataUrl = await compressImageFile(file, {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 0.75,
          outputFormat: 'image/webp',
        });
        newPhotos.push(compressedDataUrl);
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }

    onChange(newPhotos);
    setCompressing(false);
    // Reset inputs
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] text-slate-500 font-mono">
          {photos.length} / {maxPhotos} ပုံ
        </span>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Thumbnails list */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-300 shadow-xs bg-white">
              <img
                src={photo}
                alt={`Attachment ${idx + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setPreviewPhoto(photo)}
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(idx)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xs"
                title="ဓာတ်ပုံဖျက်မည်"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action upload buttons */}
      {photos.length < maxPhotos && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={compressing}
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium cursor-pointer transition"
          >
            {compressing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            <span>ကင်မရာ ရိုက်မည်</span>
          </button>

          <button
            type="button"
            disabled={compressing}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium cursor-pointer transition"
          >
            {compressing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            <span>ပြခန်းမှ ရွေးမည်</span>
          </button>
        </div>
      )}

      {/* Enlarged Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-lg max-h-[85vh] p-2 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} alt="Preview" className="max-w-full max-h-[75vh] object-contain rounded-xl" />
            <div className="flex justify-between items-center px-2 pt-2">
              <span className="text-xs text-slate-500">အော့ဖ်လိုင်း ဖိသိပ်ထားသော ဓာတ်ပုံ</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
