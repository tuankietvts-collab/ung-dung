import React, { useState, useRef } from 'react';
import {
  Scissors,
  Upload,
  Camera,
  Check,
  X,
  Image as ImageIcon,
  Sparkles,
  RotateCcw,
  Sliders,
  Maximize2
} from 'lucide-react';
import { Exam } from '../types/exam';

interface ImageSnipperModalProps {
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
  onAttachImageToQuestion: (targetType: 'mc' | 'tf' | 'essay', questionId: string, croppedImageUrl: string) => void;
}

export const ImageSnipperModal: React.FC<ImageSnipperModalProps> = ({
  exam,
  isOpen,
  onClose,
  onAttachImageToQuestion,
}) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'mc' | 'tf' | 'essay'; id: string }>({
    type: 'mc',
    id: exam.multipleChoice[0]?.id || 'mc1',
  });

  // Cropping box coordinates (relative percentages 0-100)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 25,
    y: 25,
    w: 55,
    h: 55,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImage(event.target?.result as string);
      setCroppedImage(null);
    };
    reader.readAsDataURL(file);
  };

  // Perform crop on canvas
  const performCrop = () => {
    if (!sourceImage) return;

    const img = new Image();
    img.src = sourceImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const realX = (cropBox.x / 100) * img.naturalWidth;
      const realY = (cropBox.y / 100) * img.naturalHeight;
      const realW = (cropBox.w / 100) * img.naturalWidth;
      const realH = (cropBox.h / 100) * img.naturalHeight;

      canvas.width = Math.max(10, realW);
      canvas.height = Math.max(10, realH);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
        const dataUrl = canvas.toDataURL('image/png');
        setCroppedImage(dataUrl);
      }
    };
  };

  const handleApply = () => {
    const finalImage = croppedImage || sourceImage;
    if (!finalImage) return;

    onAttachImageToQuestion(selectedTarget.type, selectedTarget.id, finalImage);
    onClose();
  };

  // Sample exam image preset for instant testing
  const loadSampleExamPaper = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Paper background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 700, 500);

      // Border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 680, 480);

      // Header text
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('ĐỀ THI KHẢO SÁT CHẤT LƯỢNG MÔN TOÁN 12 (TRÍCH ĐOẠN ĐỀ GỐC)', 30, 45);

      ctx.font = '13px sans-serif';
      ctx.fillText('Câu 3. Cho hình lăng trụ đứng ABC.A\'B\'C\' có đáy là tam giác vuông tại A.', 30, 85);
      ctx.fillText('Hình vẽ thực tế trong đề thi (Cần chụp ảnh cắt và dán vào câu hỏi):', 30, 110);

      // Draw 3D Prism in canvas
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;

      // Base triangle
      ctx.beginPath();
      ctx.moveTo(250, 240);
      ctx.lineTo(440, 240);
      ctx.lineTo(330, 310);
      ctx.closePath();
      ctx.stroke();

      // Top triangle
      ctx.beginPath();
      ctx.moveTo(250, 150);
      ctx.lineTo(440, 150);
      ctx.lineTo(330, 220);
      ctx.closePath();
      ctx.stroke();

      // Vertical edges
      ctx.beginPath();
      ctx.moveTo(250, 150);
      ctx.lineTo(250, 240);
      ctx.moveTo(440, 150);
      ctx.lineTo(440, 240);
      ctx.moveTo(330, 220);
      ctx.lineTo(330, 310);
      ctx.stroke();

      // Vertex labels
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText("A'", 235, 145);
      ctx.fillText("B'", 445, 145);
      ctx.fillText("C'", 325, 215);
      ctx.fillText("A", 235, 245);
      ctx.fillText("B", 445, 245);
      ctx.fillText("C", 325, 325);

      const url = canvas.toDataURL('image/png');
      setSourceImage(url);
      setCroppedImage(null);
      // Center crop on the 3D prism
      setCropBox({ x: 28, y: 22, w: 48, h: 48 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Tính Năng Tự Động Chụp Ảnh Cắt Và Dán Vào Đề Thi (Cách 3)
              </h3>
              <p className="text-xs text-slate-500">
                Khoanh vùng cắt hình vẽ / đồ thị từ đề thi gốc để dán trực tiếp vào câu hỏi tương ứng.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" /> Tải ảnh / PDF đề gốc
            </button>

            <button
              type="button"
              onClick={loadSampleExamPaper}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Dùng đề mẫu có hình học 3D
            </button>
          </div>

          {/* Target question selector */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Dán hình vào câu:</span>
            <select
              value={`${selectedTarget.type}:${selectedTarget.id}`}
              onChange={(e) => {
                const [type, id] = e.target.value.split(':') as ['mc' | 'tf' | 'essay', string];
                setSelectedTarget({ type, id });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {exam.multipleChoice.map((mc, idx) => (
                <option key={mc.id} value={`mc:${mc.id}`}>
                  Câu {idx + 1} (Trắc nghiệm nhiều lựa chọn)
                </option>
              ))}
              {exam.trueFalseQuestions.map((tf, idx) => (
                <option key={tf.id} value={`tf:${tf.id}`}>
                  Câu {exam.multipleChoice.length + idx + 1} (Trắc nghiệm Đúng/Sai)
                </option>
              ))}
              {exam.essays.map((es, idx) => (
                <option key={es.id} value={`essay:${es.id}`}>
                  Câu {exam.multipleChoice.length + exam.trueFalseQuestions.length + idx + 1} (Tự luận)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Snipping Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Source Image with Crop Box */}
          <div className="md:col-span-8 bg-slate-900 rounded-2xl overflow-hidden p-3 flex flex-col items-center justify-center min-h-[340px] relative select-none">
            {sourceImage ? (
              <div className="relative max-w-full max-h-[360px] overflow-hidden rounded-lg bg-black">
                <img
                  src={sourceImage}
                  alt="Đề gốc"
                  className="max-h-[360px] w-auto object-contain block opacity-90"
                />

                {/* Crop Box Overlay */}
                <div
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.w}%`,
                    height: `${cropBox.h}%`,
                  }}
                  className="absolute border-2 border-dashed border-amber-400 bg-amber-500/20 backdrop-blur-2xs shadow-xl flex items-center justify-center pointer-events-none"
                >
                  <span className="bg-amber-600 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded shadow">
                    Vùng hình vẽ sẽ cắt
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 p-8 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-xs">Chưa có ảnh đề thi gốc.</p>
                <p className="text-[11px] text-slate-500">
                  Bấm "Tải ảnh / PDF đề gốc" hoặc bấm "Dùng đề mẫu có hình học 3D" để bắt đầu cắt dán.
                </p>
              </div>
            )}
          </div>

          {/* Right: Controls & Preview */}
          <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 block">
                Điều chỉnh khung cắt hình vẽ:
              </span>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 25, y: 20, w: 50, h: 50 })}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                >
                  Hình chính giữa
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 10, y: 15, w: 80, h: 70 })}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                >
                  Khung rộng
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 10, y: 40, w: 45, h: 45 })}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                >
                  Góc trái dưới
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 45, y: 40, w: 45, h: 45 })}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                >
                  Góc phải dưới
                </button>
              </div>

              {/* Sliders for precise crop adjusting */}
              <div className="space-y-1.5 pt-1 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Vị trí X:</span>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={cropBox.x}
                    onChange={(e) => setCropBox({ ...cropBox, x: Number(e.target.value) })}
                    className="w-28 accent-amber-600"
                  />
                </div>
                <div className="flex justify-between">
                  <span>Vị trí Y:</span>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={cropBox.y}
                    onChange={(e) => setCropBox({ ...cropBox, y: Number(e.target.value) })}
                    className="w-28 accent-amber-600"
                  />
                </div>
                <div className="flex justify-between">
                  <span>Kích thước:</span>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    value={cropBox.w}
                    onChange={(e) => setCropBox({ ...cropBox, w: Number(e.target.value), h: Number(e.target.value) })}
                    className="w-28 accent-amber-600"
                  />
                </div>
              </div>

              {/* Preview of cropped image */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                  Xem trước hình sau khi cắt:
                </span>
                {croppedImage ? (
                  <div className="rounded-xl border border-slate-300 p-2 bg-white flex items-center justify-center max-h-36 overflow-hidden">
                    <img src={croppedImage} alt="Hình cắt" className="max-h-32 object-contain rounded" />
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-slate-400 bg-white text-[11px]">
                    Bấm "Cắt vùng chọn" để xem kết quả
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={performCrop}
                disabled={!sourceImage}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" /> 1. Cắt vùng chọn
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={!sourceImage}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> 2. Dán hình này vào câu hỏi ngay
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
