import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scissors,
  Upload,
  Check,
  X,
  Image as ImageIcon,
  Sparkles,
  Clipboard,
  RefreshCw,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { Exam } from '../types/exam';

interface ImageSnipperModalProps {
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
  onAttachImageToQuestion: (targetType: 'mc' | 'tf' | 'essay', questionId: string, croppedImageUrl: string) => void;
  initialImage?: string | null;
  initialTarget?: { type: 'mc' | 'tf' | 'essay'; id: string } | null;
}

export const ImageSnipperModal: React.FC<ImageSnipperModalProps> = ({
  exam,
  isOpen,
  onClose,
  onAttachImageToQuestion,
  initialImage,
  initialTarget,
}) => {
  const [sourceImage, setSourceImage] = useState<string | null>(initialImage || null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'mc' | 'tf' | 'essay'; id: string }>(() => {
    if (initialTarget) return initialTarget;
    if (exam.multipleChoice && exam.multipleChoice.length > 0) {
      return { type: 'mc', id: exam.multipleChoice[0].id };
    }
    if (exam.trueFalseQuestions && exam.trueFalseQuestions.length > 0) {
      return { type: 'tf', id: exam.trueFalseQuestions[0].id };
    }
    return { type: 'essay', id: exam.essays[0]?.id || 'essay_1' };
  });

  const [lastAttachedQuestionTitle, setLastAttachedQuestionTitle] = useState<string | null>(null);
  const [statusTip, setStatusTip] = useState<string | null>(null);

  // Crop coordinates in percentage (0-100)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 20,
    y: 20,
    w: 60,
    h: 55,
  });

  // Interactive mouse drag to crop
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Sync initialImage and initialTarget when modal opens or props change
  useEffect(() => {
    if (initialImage) {
      setSourceImage(initialImage);
    }
    if (initialTarget) {
      setSelectedTarget(initialTarget);
    }
    setLastAttachedQuestionTitle(null);
  }, [initialImage, initialTarget, isOpen]);

  // Perform crop on canvas
  const performCrop = useCallback(() => {
    if (!sourceImage) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = sourceImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const realX = Math.max(0, (cropBox.x / 100) * img.naturalWidth);
      const realY = Math.max(0, (cropBox.y / 100) * img.naturalHeight);
      const realW = Math.max(10, Math.min(img.naturalWidth - realX, (cropBox.w / 100) * img.naturalWidth));
      const realH = Math.max(10, Math.min(img.naturalHeight - realY, (cropBox.h / 100) * img.naturalHeight));

      canvas.width = realW;
      canvas.height = realH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, realW, realH);
        ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
        const dataUrl = canvas.toDataURL('image/png', 0.95);
        setCroppedImage(dataUrl);
      }
    };
  }, [sourceImage, cropBox]);

  // Recalculate crop whenever cropBox changes and sourceImage exists
  useEffect(() => {
    if (sourceImage) {
      const t = setTimeout(() => {
        performCrop();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [cropBox, sourceImage, performCrop]);

  // Listen for Clipboard Paste (Ctrl+V) anywhere in window when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setSourceImage(ev.target?.result as string);
              setCroppedImage(null);
            };
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

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

  // Interactive mouse events on image to draw bounding box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageElementRef.current) return;
    const rect = imageElementRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setIsDragging(true);
    setDragStart({ x: xPct, y: yPct });
    setCropBox({ x: xPct, y: yPct, w: 2, h: 2 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart || !imageElementRef.current) return;
    const rect = imageElementRef.current.getBoundingClientRect();
    const currentXPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const currentYPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const left = Math.min(dragStart.x, currentXPct);
    const top = Math.min(dragStart.y, currentYPct);
    const width = Math.max(5, Math.abs(currentXPct - dragStart.x));
    const height = Math.max(5, Math.abs(currentYPct - dragStart.y));

    setCropBox({ x: left, y: top, w: width, h: height });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    performCrop();
  };

  const getTargetLabel = () => {
    if (selectedTarget.type === 'mc') {
      const idx = exam.multipleChoice.findIndex((q) => q.id === selectedTarget.id);
      return `Câu ${idx !== -1 ? idx + 1 : 1} (Phần I - Trắc nghiệm)`;
    } else if (selectedTarget.type === 'tf') {
      const idx = exam.trueFalseQuestions.findIndex((q) => q.id === selectedTarget.id);
      return `Câu ${(exam.multipleChoice?.length || 0) + (idx !== -1 ? idx + 1 : 1)} (Phần II - Đúng/Sai)`;
    } else {
      const idx = exam.essays.findIndex((q) => q.id === selectedTarget.id);
      return `Câu ${(exam.multipleChoice?.length || 0) + (exam.trueFalseQuestions?.length || 0) + (idx !== -1 ? idx + 1 : 1)} (Phần III)`;
    }
  };

  const handleApplyAndClose = () => {
    const finalImage = croppedImage || sourceImage;
    if (!finalImage) return;

    onAttachImageToQuestion(selectedTarget.type, selectedTarget.id, finalImage);
    onClose();
  };

  const handleApplyAndContinue = () => {
    const finalImage = croppedImage || sourceImage;
    if (!finalImage) return;

    onAttachImageToQuestion(selectedTarget.type, selectedTarget.id, finalImage);
    setLastAttachedQuestionTitle(getTargetLabel());

    // Auto advance target to next question for rapid multi-question snipping
    if (selectedTarget.type === 'mc') {
      const currIdx = exam.multipleChoice.findIndex((q) => q.id === selectedTarget.id);
      if (currIdx !== -1 && currIdx + 1 < exam.multipleChoice.length) {
        setSelectedTarget({ type: 'mc', id: exam.multipleChoice[currIdx + 1].id });
      } else if (exam.trueFalseQuestions.length > 0) {
        setSelectedTarget({ type: 'tf', id: exam.trueFalseQuestions[0].id });
      }
    } else if (selectedTarget.type === 'tf') {
      const currIdx = exam.trueFalseQuestions.findIndex((q) => q.id === selectedTarget.id);
      if (currIdx !== -1 && currIdx + 1 < exam.trueFalseQuestions.length) {
        setSelectedTarget({ type: 'tf', id: exam.trueFalseQuestions[currIdx + 1].id });
      } else if (exam.essays.length > 0) {
        setSelectedTarget({ type: 'essay', id: exam.essays[0].id });
      }
    }
  };

  // Sample exam paper with 3D prism & graph for testing
  const loadSampleExamPaper = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 600);

      // Grid line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(15, 15, 770, 570);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('ĐỀ THI KHẢO SÁT CHẤT LƯỢNG MÔN TOÁN (TRÍCH ĐOẠN ĐỀ GỐC CÓ HÌNH)', 35, 50);

      ctx.font = '14px sans-serif';
      ctx.fillText('Câu 3. Cho hình chóp S.ABCD có đáy ABCD là hình vuông cạnh a, SA vuông góc với đáy.', 35, 95);
      ctx.fillText('Hình vẽ thực tế trong đề thi (Khoanh chuột kéo chọn vùng hình bên dưới để dán vào câu):', 35, 125);

      // Draw 3D Pyramid
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 2.5;

      // Base
      ctx.beginPath();
      ctx.moveTo(250, 420);
      ctx.lineTo(520, 420);
      ctx.lineTo(600, 320);
      ctx.stroke();

      // Dashed base lines
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(250, 420);
      ctx.lineTo(330, 320);
      ctx.lineTo(600, 320);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top S
      const Sx = 330;
      const Sy = 180;

      // Lateral edges
      ctx.beginPath();
      ctx.moveTo(Sx, Sy);
      ctx.lineTo(250, 420);
      ctx.moveTo(Sx, Sy);
      ctx.lineTo(520, 420);
      ctx.moveTo(Sx, Sy);
      ctx.lineTo(600, 320);
      ctx.stroke();

      // Dashed SA
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(Sx, Sy);
      ctx.lineTo(330, 320);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('S', Sx - 5, Sy - 10);
      ctx.fillText('A', 315, 335);
      ctx.fillText('B', 230, 435);
      ctx.fillText('C', 530, 435);
      ctx.fillText('D', 615, 325);

      const url = canvas.toDataURL('image/png');
      setSourceImage(url);
      setCroppedImage(null);
      setCropBox({ x: 25, y: 22, w: 55, h: 58 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] overflow-y-auto shadow-2xl p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Công Cụ Cắt Ảnh & Dán Trực Tiếp Vào Câu Hỏi</span>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Chuẩn GDPT 2018
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Khoanh chuột kéo chọn vùng hình ảnh phức tạp (hình học không gian 3D, đồ thị hàm số, bảng biến thiên) từ đề gốc và dán ngay vào câu hỏi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
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
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Upload className="w-4 h-4 text-indigo-200" /> Tải Ảnh Đề Gốc
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const clipItems = await navigator.clipboard.read();
                  for (const item of clipItems) {
                    const imgType = item.types.find(t => t.startsWith('image/'));
                    if (imgType) {
                      const blob = await item.getType(imgType);
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setSourceImage(ev.target?.result as string);
                        setCroppedImage(null);
                      };
                      reader.readAsDataURL(blob);
                      break;
                    }
                  }
                } catch {
                  setStatusTip('Vui lòng chụp màn hình (Win + Shift + S) rồi bấm Ctrl + V để dán hình!');
                  setTimeout(() => setStatusTip(null), 4000);
                }
              }}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Dán nhanh hình chụp từ Clipboard (Ctrl + V)"
            >
              <Clipboard className="w-4 h-4 text-amber-600" /> Dán từ Clipboard (Ctrl + V)
            </button>

            <button
              type="button"
              onClick={loadSampleExamPaper}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600" /> Dùng Hình Mẫu Toán 3D
            </button>
          </div>

          {/* Target Question Dropdown */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <span className="font-extrabold text-slate-700 whitespace-nowrap">
              🎯 Dán Vào Câu:
            </span>
            <select
              value={`${selectedTarget.type}:${selectedTarget.id}`}
              onChange={(e) => {
                const [type, id] = e.target.value.split(':') as ['mc' | 'tf' | 'essay', string];
                setSelectedTarget({ type, id });
              }}
              className="bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 max-w-xs truncate cursor-pointer shadow-2xs"
            >
              {exam.multipleChoice.map((mc, idx) => (
                <option key={mc.id} value={`mc:${mc.id}`}>
                  [Phần I] Câu {idx + 1}: {mc.question.replace(/^[#*_\s]+/, '').slice(0, 42)}...
                </option>
              ))}
              {exam.trueFalseQuestions.map((tf, idx) => (
                <option key={tf.id} value={`tf:${tf.id}`}>
                  [Phần II] Câu {exam.multipleChoice.length + idx + 1}: {tf.prompt.slice(0, 42)}...
                </option>
              ))}
              {exam.essays.map((es, idx) => (
                <option key={es.id} value={`essay:${es.id}`}>
                  [Phần III] Câu {exam.multipleChoice.length + exam.trueFalseQuestions.length + idx + 1}: {es.question.slice(0, 42)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Success toast inside modal after attaching */}
        {lastAttachedQuestionTitle && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã dán thành công hình ảnh vào <b>{lastAttachedQuestionTitle}</b>!</span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium">
              Bạn có thể tiếp tục chọn câu khác hoặc bấm Đóng.
            </span>
          </div>
        )}

        {statusTip && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{statusTip}</span>
            </div>
          </div>
        )}

        {/* Main Snipping Canvas & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Canvas (Interactive drag-to-crop) */}
          <div className="lg:col-span-8 bg-slate-900 rounded-3xl overflow-hidden p-4 flex flex-col items-center justify-center min-h-[380px] relative select-none border border-slate-800">
            {sourceImage ? (
              <div
                ref={imageContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="relative max-w-full max-h-[420px] overflow-hidden rounded-xl bg-black cursor-crosshair shadow-lg"
              >
                <img
                  ref={imageElementRef}
                  src={sourceImage}
                  alt="Đề gốc"
                  draggable={false}
                  className="max-h-[420px] w-auto object-contain block opacity-95 select-none pointer-events-none"
                />

                {/* Interactive Crop Box Overlay */}
                <div
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.w}%`,
                    height: `${cropBox.h}%`,
                  }}
                  className="absolute border-2 border-dashed border-amber-400 bg-amber-500/25 backdrop-blur-[1px] shadow-2xl flex items-center justify-center pointer-events-none rounded-lg"
                >
                  <div className="bg-amber-500 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                    <Scissors className="w-3 h-3" />
                    <span>Vùng hình sẽ dán vào câu</span>
                  </div>
                </div>

                <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
                  <span className="px-3 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium backdrop-blur-xs">
                    💡 Kéo rê chuột trực tiếp trên ảnh để khoanh vùng hình vẽ cần cắt
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 p-8 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">Chưa có ảnh đề thi gốc</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Bấm <b>"Tải Ảnh Đề Gốc"</b>, hoặc bấm <b>"Dán từ Clipboard (Ctrl + V)"</b>, hoặc bấm <b>"Dùng Hình Mẫu Toán 3D"</b> để bắt đầu cắt dán.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Adjustments & Cropped Preview */}
          <div className="lg:col-span-4 bg-slate-50 p-5 rounded-3xl border border-slate-200 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-2">
                  Khung Cắt Nhanh (Preset):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 20, y: 15, w: 60, h: 60 })}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                  >
                    Chính giữa
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 5, y: 10, w: 90, h: 80 })}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                  >
                    Toàn bộ ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 5, y: 30, w: 50, h: 55 })}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                  >
                    Nửa trái
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 45, y: 30, w: 50, h: 55 })}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                  >
                    Nửa phải
                  </button>
                </div>
              </div>

              {/* Cropped Preview */}
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                  Hình Đã Cắt Sẵn Sàng Dán:
                </span>
                {croppedImage ? (
                  <div className="rounded-2xl border-2 border-emerald-300 p-2.5 bg-white flex items-center justify-center max-h-44 overflow-hidden shadow-2xs">
                    <img src={croppedImage} alt="Hình cắt" className="max-h-40 object-contain rounded-lg" />
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-400 bg-white text-xs">
                    Kéo chuột trên ảnh để tạo vùng cắt
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleApplyAndContinue}
                disabled={!sourceImage}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-101 active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>Dán Vào {getTargetLabel()} & Tiếp Tục Câu Khác</span>
              </button>

              <button
                type="button"
                onClick={handleApplyAndClose}
                disabled={!sourceImage}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Hoàn Tất & Đóng Cửa Sổ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
