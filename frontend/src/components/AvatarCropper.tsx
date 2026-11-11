import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, Check, Upload } from 'lucide-react';

interface AvatarCropperProps {
  initialAvatar: string;
  color: string;
  onChange: (dataUrl: string) => void;
}

const PRESET_EMOJIS = ['🧔🏻', '👩🏻', '👦🏻', '👧🏻', '🧒🏽', '👱🏻‍♀️', '👴🏻', '👵🏻', '🐱', '🐶', '🦊', '🦁'];

export const AvatarCropper: React.FC<AvatarCropperProps> = ({
  initialAvatar,
  color,
  onChange,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImageSrc(result);
        setZoom(1);
        setOffsetX(0);
        setOffsetY(0);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageSrc || !imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    const size = 160;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const scale = Math.max(size / img.width, size / img.height) * zoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (size - drawW) / 2 + offsetX;
    const dy = (size - drawH) / 2 + offsetY;

    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  }, [imageSrc, zoom, offsetX, offsetY]);

  const applyCroppedImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onChange(dataUrl);
    setImageSrc(null);
  };

  const selectEmojiAvatar = (emoji: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="60" fill="${color}"/>
      <text x="60" y="74" font-size="52" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </svg>`;
    const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    onChange(uri);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <img
          src={initialAvatar}
          alt="Avatar"
          className="w-12 h-12 rounded-full object-cover border-2"
          style={{ borderColor: color }}
        />
        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition">
          <Upload className="w-3.5 h-3.5" />
          Importer & Recadrer photo
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      {/* Quick Emoji Avatars */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_EMOJIS.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => selectEmojiAvatar(em)}
            className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-base transition"
            title="Choisir cet avatar"
          >
            {em}
          </button>
        ))}
      </div>

      {/* Interactive Cropper Box when a custom image is loaded */}
      {imageSrc && (
        <div className="p-3 rounded-2xl bg-black/10 dark:bg-black/40 border border-white/10 space-y-2">
          <div className="flex items-center gap-4">
            <canvas
              ref={canvasRef}
              className="w-20 h-20 rounded-full border-2 border-amber-400 shadow-md shrink-0"
            />
            <div className="flex-1 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                <span className="w-14">Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16">Pos. X / Y</span>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  step="2"
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                  className="w-1/2 accent-amber-500"
                />
                <input
                  type="range"
                  min="-60"
                  max="60"
                  step="2"
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                  className="w-1/2 accent-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={applyCroppedImage}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold text-xs hover:bg-emerald-600 transition"
              >
                <Check className="w-3.5 h-3.5" /> Valider le recadrage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

