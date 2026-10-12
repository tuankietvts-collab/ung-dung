import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles,
  RotateCcw,
  Keyboard,
  Check,
  Delete,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Type,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
  Calculator,
  Laptop,
  Atom,
  Flame,
  Dna,
  BookOpen,
  Split,
  Space,
  X,
  Send,
  PenTool,
  CheckCircle2
} from 'lucide-react';

// Import mathlive to register <math-field>
import 'mathlive';
import { MathRenderer } from './MathRenderer';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

export interface MathLiveFieldProps {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  mode?: 'short_answer' | 'essay';
  minHeight?: string;
}

export const MathLiveField: React.FC<MathLiveFieldProps> = ({
  value,
  onChange,
  placeholder = 'Chạm vào để nhập đáp số / công thức toán...',
  disabled = false,
  label,
  className = '',
  mode = 'short_answer',
  minHeight = '56px',
}) => {
  const mfRef = useRef<any>(null);

  // Studio Modal State: Khi học sinh bấm vào ô trả lời thì mở giao diện nhập liệu tập trung
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value || '');

  const [keypadTab, setKeypadTab] = useState<
    'basic_math' | 'equations' | 'trig_calc' | 'physics' | 'chemistry' | 'biology' | 'templates'
  >('basic_math');
  const [isFastTextMode, setIsFastTextMode] = useState(false);

  // Sync draftValue whenever value changes externally
  useEffect(() => {
    setDraftValue(value || '');
  }, [value]);

  // Turn off MathLive native virtual keyboard completely (eliminate duplicate bottom keyboard)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).mathVirtualKeyboard) {
      try {
        const mvk = (window as any).mathVirtualKeyboard;
        mvk.policy = 'manual';
        if (typeof mvk.hide === 'function') {
          mvk.hide();
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Sync value and attach events to <math-field> inside studio
  useEffect(() => {
    if (!isStudioOpen) return;
    const mf = mfRef.current;
    if (!mf) return;

    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.setAttribute('math-virtual-keyboard-policy', 'manual');
    mf.smartFence = true;
    mf.smartSuperscript = true;
    mf.readOnly = false;

    if (mf.value !== (draftValue || '')) {
      mf.value = draftValue || '';
    }

    const handleInput = () => {
      const latex = mf.value || '';
      setDraftValue(latex);
    };

    mf.addEventListener('input', handleInput);

    // Auto-focus after opening studio
    setTimeout(() => {
      try {
        mf.focus();
      } catch {
        // ignore
      }
    }, 100);

    return () => {
      mf.removeEventListener('input', handleInput);
    };
  }, [isStudioOpen]);

  // Insert command into Mathfield
  const insertCmd = useCallback((latex: string, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) {
      setDraftValue((prev) => (prev || '') + latex);
      return;
    }

    try {
      mf.focus();
      if (typeof mf.insert === 'function') {
        mf.insert(latex, { focus: true, selectionMode: 'placeholder' });
      } else {
        mf.executeCommand(['insert', latex]);
      }
      const updated = mf.value || '';
      setDraftValue(updated);
    } catch {
      const nextVal = (draftValue || '') + latex;
      if (mf) mf.value = nextVal;
      setDraftValue(nextVal);
    }
  }, [draftValue]);

  // Backspace - Delete backward character or token
  const handleBackspace = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) {
      const trimmed = (draftValue || '').replace(/(\\[a-zA-Z]+|\{[^}]*\}|.)\s*$/, '');
      setDraftValue(trimmed);
      return;
    }

    try {
      mf.focus();
      let res = false;
      if (typeof mf.executeCommand === 'function') {
        res = mf.executeCommand('deleteBackward');
        if (!res) {
          res = mf.executeCommand(['deleteBackward']);
        }
      }
      
      const currentVal = mf.value || '';
      if (!res || currentVal === (draftValue || '')) {
        const trimmed = (draftValue || '').replace(/(\\[a-zA-Z]+|\{[^}]*\}|.)\s*$/, '');
        mf.value = trimmed;
        setDraftValue(trimmed);
      } else {
        setDraftValue(currentVal);
      }
    } catch {
      const trimmed = (draftValue || '').replace(/(\\[a-zA-Z]+|\{[^}]*\}|.)\s*$/, '');
      if (mf) mf.value = trimmed;
      setDraftValue(trimmed);
    }
  }, [draftValue]);

  // Move cursor Left
  const handleMoveLeft = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      mf.executeCommand('moveToPreviousChar');
    } catch {
      // ignore
    }
  }, []);

  // Move cursor Right
  const handleMoveRight = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      mf.executeCommand('moveToNextChar');
    } catch {
      // ignore
    }
  }, []);

  // Move cursor UP (Lên)
  const handleMoveUp = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      const moved = mf.executeCommand('moveUp');
      if (!moved) {
        mf.executeCommand('moveToPreviousPlaceholder');
      }
    } catch {
      // ignore
    }
  }, []);

  // Move cursor DOWN (Xuống)
  const handleMoveDown = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      const moved = mf.executeCommand('moveDown');
      if (!moved) {
        mf.executeCommand('moveToNextPlaceholder');
      }
    } catch {
      // ignore
    }
  }, []);

  // Jump to Next Placeholder
  const handleNextPlaceholder = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      mf.executeCommand('moveToNextPlaceholder');
    } catch {
      // ignore
    }
  }, []);

  // Insert New Line / Multiline Row (Xuống dòng)
  const handleInsertNewline = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      const added = mf.executeCommand('addRowAfter');
      if (!added) {
        if (typeof mf.insert === 'function') {
          mf.insert(' \\\\ ', { focus: true });
        } else {
          mf.executeCommand(['insert', ' \\\\ ']);
        }
      }
      setDraftValue(mf.value || '');
    } catch {
      const next = (draftValue || '') + ' \\\\ ';
      if (mf) mf.value = next;
      setDraftValue(next);
    }
  }, [draftValue]);

  // Undo
  const handleUndo = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      mf.executeCommand('undo');
      setDraftValue(mf.value || '');
    } catch {
      // ignore
    }
  }, []);

  // Redo
  const handleRedo = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.focus();
      mf.executeCommand('redo');
      setDraftValue(mf.value || '');
    } catch {
      // ignore
    }
  }, []);

  // Clear draft
  const clearDraft = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (mf) {
      mf.value = '';
      mf.focus();
    }
    setDraftValue('');
  }, []);

  // Mở trình soạn thảo
  const handleOpenStudio = () => {
    if (disabled) return;
    setDraftValue(value || '');
    setIsStudioOpen(true);
  };

  // Xác nhận & Gửi kết quả: Lưu vào state của bài thi và đóng giao diện nhập
  const handleConfirmAndSubmit = () => {
    onChange(draftValue || '');
    setIsStudioOpen(false);
  };

  // Hủy & Đóng
  const handleCancel = () => {
    setDraftValue(value || '');
    setIsStudioOpen(false);
  };

  // Xóa trực tiếp từ ngoài
  const handleClearDirect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setDraftValue('');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>{label}</span>
        </label>
      )}

      {/* ========================================================================= */}
      {/* KHUNG HIỂN THỊ ĐÁP SỐ CHÍNH TRONG BÀI THI (NORMAL ANSWER BOX)              */}
      {/* Bấm vào để mở giao diện soạn thảo tập trung                                 */}
      {/* ========================================================================= */}
      <div
        onClick={handleOpenStudio}
        className={`w-full min-h-[56px] px-4 py-3 bg-white border-2 rounded-2xl transition-all cursor-pointer shadow-xs group flex items-center justify-between gap-3 ${
          disabled
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-90'
            : value?.trim()
            ? 'border-indigo-400 hover:border-indigo-600 bg-indigo-50/20 hover:shadow-md'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          {value?.trim() ? (
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đáp số đã lưu:</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 overflow-x-auto py-1">
                <MathRenderer content={`$${value}$`} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-slate-400 group-hover:text-indigo-600 transition-colors">
              <PenTool className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-sm sm:text-base font-semibold">{placeholder}</span>
            </div>
          )}
        </div>

        {/* Nút hành động nhanh bên ngoài */}
        <div className="flex items-center gap-1.5 shrink-0">
          {value?.trim() && !disabled && (
            <button
              type="button"
              onClick={handleClearDirect}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Xóa đáp số"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {!disabled && (
            <div className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 group-hover:bg-indigo-700 transition-all shadow-xs">
              <Keyboard className="w-3.5 h-3.5" />
              <span>{value?.trim() ? 'Sửa' : 'Nhập'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GIAO DIỆN NHẬP LIỆU TẬP TRUNG (INTERACTIVE MATH INPUT STUDIO / MODAL)      */}
      {/* Phía trên: Khung hiển thị lớn quan sát dễ dàng                             */}
      {/* Phía dưới: Bàn phím số liệu và ký hiệu khoa học                            */}
      {/* Nút gửi: Bấm vào gửi kết quả vào ô bài thi                                 */}
      {/* ========================================================================= */}
      {isStudioOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className="w-full sm:max-w-3xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. HEADER STUDIO: Tiêu đề + Nút Gửi Kết Quả nổi bật */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Bàn Phím Khoa Học & Soạn Thảo Toán</h3>
                  <p className="text-[10px] text-slate-300">Nhập ở bàn phím bên dưới và quan sát trực tiếp kết quả ở khung trên</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* NÚT GỬI KẾT QUẢ / XÁC NHẬN NỔI BẬT */}
                <button
                  type="button"
                  onClick={handleConfirmAndSubmit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Gửi Kết Quả</span>
                </button>
              </div>
            </div>

            {/* 2. PHẦN PHÍA TRÊN: KHUNG HIỂN THỊ CÔNG THỨC TRỰC QUAN LỚN & ĐIỀU KHIỂN */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Công Thức Đang Soạn Thảo (Quan Sát Trực Quan):</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsFastTextMode(!isFastTextMode)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      isFastTextMode
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Type className="w-3 h-3 inline mr-1" />
                    {isFastTextMode ? 'Chuyển sang gõ trực quan' : 'Gõ phím chữ/số thường'}
                  </button>

                  {draftValue && (
                    <button
                      type="button"
                      onClick={clearDraft}
                      className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                    >
                      Xóa hết
                    </button>
                  )}
                </div>
              </div>

              {/* KHUNG NHẬP WYSIWYG PHÍA TRÊN */}
              <div className="bg-white rounded-2xl border-2 border-indigo-400 shadow-sm p-1">
                {!isFastTextMode ? (
                  React.createElement('math-field', {
                    ref: mfRef,
                    style: { minHeight: '64px', maxHeight: '140px' },
                    placeholder: 'Bấm các phím ở dưới để tạo công thức...',
                    'math-virtual-keyboard-policy': 'manual',
                    inputmode: 'none',
                    class:
                      'w-full px-4 py-3 bg-white text-slate-900 text-xl sm:text-2xl font-bold transition-all block cursor-text select-text leading-relaxed overflow-x-auto',
                  })
                ) : (
                  <textarea
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    rows={3}
                    placeholder="Gõ trực tiếp đáp số hoặc lời giải..."
                    className="w-full px-4 py-2.5 bg-white text-slate-900 text-base font-bold outline-none rounded-xl"
                  />
                )}
              </div>

              {/* THANH ĐIỀU HƯỚNG CON TRỎ: LÊN, XUỐNG, TRÁI, PHẢI, XUỐNG DÒNG, XÓA LÙI */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="flex items-center gap-1 flex-wrap bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 px-1 hidden sm:inline">Con trỏ:</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleMoveUp}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95"
                    title="Di chuyển LÊN TRÊN"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Lên</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleMoveDown}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95"
                    title="Di chuyển XUỐNG DƯỚI"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Xuống</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleMoveLeft}
                    className="px-2 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95"
                    title="Sang TRÁI"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Trái</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleMoveRight}
                    className="px-2 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95"
                    title="Sang PHẢI"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Phải</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleNextPlaceholder}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-lg border border-indigo-200 cursor-pointer active:scale-95"
                    title="Ô kế tiếp (Tab)"
                  >
                    <span>⇥ Ô kế</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInsertNewline}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Xuống dòng mới (Enter)"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>Xuống dòng</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd('\\enspace ', e)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Dấu cách"
                  >
                    <Space className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">Cách</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleUndo}
                    className="p-1 bg-white hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-2xs cursor-pointer active:scale-95"
                    title="Hoàn tác (Undo)"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleRedo}
                    className="p-1 bg-white hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-2xs cursor-pointer active:scale-95"
                    title="Làm lại (Redo)"
                  >
                    <Redo2 className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  {/* NÚT XÓA LÙI (BACKSPACE) NỔI BẬT */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleBackspace}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Xóa ký tự hoặc công thức sai (Backspace)"
                  >
                    <Delete className="w-4 h-4" />
                    <span>Xóa (⌫)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. PHẦN PHÍA DƯỚI: BÀN PHÍM SỐ LIỆU & KÝ HIỆU KHOA HỌC (SCROLLABLE & TOUCH-FRIENDLY) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-100 select-none scrollbar-thin">
              {/* THANH TABS BÀN PHÍM */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
                {[
                  { id: 'basic_math', label: 'Số & Cơ bản (π, e)', icon: Calculator, color: 'indigo' },
                  { id: 'equations', label: '[Ngoặc Vuông] & Hệ PT (⇒, ⇔)', icon: Split, color: 'purple' },
                  { id: 'trig_calc', label: 'Lượng Giác & Giải Tích', icon: Sparkles, color: 'blue' },
                  { id: 'physics', label: 'Vật Lý (Vector, Ω, λ)', icon: Atom, color: 'emerald' },
                  { id: 'chemistry', label: 'Hóa Học (Phản ứng, Ion)', icon: Flame, color: 'amber' },
                  { id: 'biology', label: 'Sinh Học (Lai tạo, Kiểu gen)', icon: Dna, color: 'teal' },
                  { id: 'templates', label: 'Mẫu Tự Luận Như Giấy Thi', icon: BookOpen, color: 'rose' },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = keypadTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setKeypadTab(t.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* NỘI DUNG BÀN PHÍM TAB 1: SỐ & CƠ BẢN (π, e, a/b, √x) */}
              {keypadTab === 'basic_math' && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5">
                    {[
                      { label: 'π', cmd: '\\pi ', tip: 'Số Pi (3.14159...)' },
                      { label: 'e', cmd: 'e', tip: 'Số e (Cơ số tự nhiên 2.718...)' },
                      { label: 'a/b', cmd: '\\frac{#@}{#?}', tip: 'Phân số 2 tầng' },
                      { label: '√x', cmd: '\\sqrt{#?}', tip: 'Căn bậc 2' },
                      { label: 'ⁿ√x', cmd: '\\sqrt[#?]{#?}', tip: 'Căn bậc n' },
                      { label: 'x²', cmd: '^2', tip: 'Bình phương' },
                      { label: 'xⁿ', cmd: '^{#?}', tip: 'Số mũ n' },
                      { label: 'x₁', cmd: '_{#?}', tip: 'Chỉ số dưới' },
                      { label: '|x|', cmd: '|#?|', tip: 'Trị tuyệt đối' },
                      { label: '±', cmd: '\\pm ', tip: 'Cộng trừ' },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => insertCmd(item.cmd, e)}
                        className="py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer font-serif"
                        title={item.tip}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5">
                    {['7', '8', '9', '+', '-', 'x', 'y', 'z', 't', 'm'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => insertCmd(key, e)}
                        className="py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 text-slate-900 font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer font-mono"
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5">
                    {['4', '5', '6', '\\times ', '\\div ', '(', ')', '[', ']', '='].map((item, idx) => {
                      const display = item === '\\times ' ? '×' : item === '\\div ' ? '÷' : item;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => insertCmd(item, e)}
                          className="py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 text-slate-900 font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer font-mono"
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5">
                    {['1', '2', '3', '0', ',', '.', ';', '\\infty ', '+\\infty ', '-\\infty '].map((item, idx) => {
                      const display =
                        item === '\\infty ' ? '∞' :
                        item === '+\\infty ' ? '+∞' :
                        item === '-\\infty ' ? '-∞' : item;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => insertCmd(item, e)}
                          className="py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 text-slate-900 font-mono font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NỘI DUNG BÀN PHÍM TAB 2: NGOẶC VUÔNG 2-3 NGHIỆM, HỆ PT, DẤU SUY RA, TƯƠNG ĐƯƠNG */}
              {keypadTab === 'equations' && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '⇒ (Suy ra)', cmd: '\\implies ', tip: 'Dấu suy ra' },
                      { label: '⇔ (Tương đương)', cmd: '\\iff ', tip: 'Dấu tương đương' },
                      { label: '→ (Mũi tên)', cmd: '\\to ', tip: 'Mũi tên' },
                      {
                        label: '[ 2 nghiệm (Hoặc)',
                        cmd: '\\left[\\begin{array}{l} #? \\\\ #? \\end{array}\\right.',
                        tip: 'Ngoặc vuông mở 2 nhánh nghiệm phương trình lượng giác'
                      },
                      {
                        label: '[ 3 nghiệm (Hoặc)',
                        cmd: '\\left[\\begin{array}{l} #? \\\\ #? \\\\ #? \\end{array}\\right.',
                        tip: 'Ngoặc vuông mở 3 nhánh nghiệm'
                      },
                      {
                        label: '{ Hệ 2 PT (Và)',
                        cmd: '\\begin{cases} #? \\\\ #? \\end{cases}',
                        tip: 'Ngoặc nhọn hệ 2 phương trình'
                      },
                      {
                        label: '{ Hệ 3 PT (Và)',
                        cmd: '\\begin{cases} #? \\\\ #? \\\\ #? \\end{cases}',
                        tip: 'Ngoặc nhọn hệ 3 phương trình'
                      },
                      { label: '(a; b)', cmd: '(#?; #?)', tip: 'Khoảng nghiệm' },
                      { label: '[a; b]', cmd: '[#?; #?]', tip: 'Đoạn nghiệm' },
                      { label: '∪', cmd: '\\cup ', tip: 'Hợp' },
                      { label: '∩', cmd: '\\cap ', tip: 'Giao' },
                      { label: 'k ∈ ℤ', cmd: 'k \\in \\mathbb{Z}', tip: 'Điều kiện k nguyên' },
                      { label: '∈', cmd: '\\in ', tip: 'Thuộc' },
                      { label: '∉', cmd: '\\notin ', tip: 'Không thuộc' },
                      { label: 'ℝ', cmd: '\\mathbb{R}', tip: 'Tập số thực' },
                      { label: '∅', cmd: '\\varnothing', tip: 'Tập rỗng' },
                      { label: '≠', cmd: '\\ne ', tip: 'Khác' },
                      { label: '≤', cmd: '\\le ', tip: 'Nhỏ hơn hoặc bằng' },
                      { label: '≥', cmd: '\\ge ', tip: 'Lớn hơn hoặc bằng' },
                    ].map((btn, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => insertCmd(btn.cmd, e)}
                        className="px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-purple-300 hover:bg-purple-50 hover:border-purple-500 text-purple-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                        title={btn.tip}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* NỘI DUNG BÀN PHÍM TAB 3: LƯỢNG GIÁC & GIẢI TÍCH */}
              {keypadTab === 'trig_calc' && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { label: 'sin', cmd: '\\sin(#?)', tip: 'Hàm Sin' },
                    { label: 'cos', cmd: '\\cos(#?)', tip: 'Hàm Cos' },
                    { label: 'tan', cmd: '\\tan(#?)', tip: 'Hàm Tan' },
                    { label: 'cot', cmd: '\\cot(#?)', tip: 'Hàm Cot' },
                    { label: 'arcsin', cmd: '\\arcsin(#?)', tip: 'Hàm Arcsin' },
                    { label: 'arccos', cmd: '\\arccos(#?)', tip: 'Hàm Arccos' },
                    { label: 'k2π', cmd: 'k2\\pi ', tip: 'Chu kỳ 2 Pi' },
                    { label: 'kπ', cmd: 'k\\pi ', tip: 'Chu kỳ Pi' },
                    { label: 'π/2', cmd: '\\frac{\\pi}{2}', tip: 'Góc 90 độ' },
                    { label: 'π/3', cmd: '\\frac{\\pi}{3}', tip: 'Góc 60 độ' },
                    { label: 'π/4', cmd: '\\frac{\\pi}{4}', tip: 'Góc 45 độ' },
                    { label: 'π/6', cmd: '\\frac{\\pi}{6}', tip: 'Góc 30 độ' },
                    { label: '∫ dx', cmd: '\\int_{#?}^{#?} #?\\,dx', tip: 'Tích phân xác định' },
                    { label: '∫', cmd: '\\int #?\\,dx', tip: 'Nguyên hàm' },
                    { label: 'lim', cmd: '\\lim_{x \\to #?}', tip: 'Giới hạn' },
                    { label: "y'", cmd: "y'", tip: 'Đạo hàm bậc nhất' },
                    { label: "y''", cmd: "y''", tip: 'Đạo hàm bậc 2' },
                    { label: "f'(x)", cmd: "f'(x)", tip: 'Đạo hàm f(x)' },
                    { label: 'ln', cmd: '\\ln(#?)', tip: 'Logarit tự nhiên ln' },
                    { label: 'log_a', cmd: '\\log_{#?}(#?)', tip: 'Logarit cơ số a' },
                    { label: 'eˣ', cmd: 'e^{#?}', tip: 'Hàm số mũ e' },
                    { label: 'Δ', cmd: '\\Delta', tip: 'Biệt thức Delta' },
                    { label: 'C_n^k', cmd: 'C_{#?}^{#?}', tip: 'Tổ hợp' },
                    { label: 'A_n^k', cmd: 'A_{#?}^{#?}', tip: 'Chỉnh hợp' },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => insertCmd(btn.cmd, e)}
                      className="px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-400 text-blue-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                      title={btn.tip}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {/* NỘI DUNG BÀN PHÍM TAB 4: MÔN VẬT LÝ */}
              {keypadTab === 'physics' && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { label: 'v⃗', cmd: '\\vec{v}', tip: 'Vector vận tốc' },
                    { label: 'a⃗', cmd: '\\vec{a}', tip: 'Vector gia tốc' },
                    { label: 'F⃗', cmd: '\\vec{F}', tip: 'Vector lực tác dụng' },
                    { label: 'p⃗', cmd: '\\vec{p}', tip: 'Vector động lượng' },
                    { label: 'B⃗', cmd: '\\vec{B}', tip: 'Vector cảm ứng từ' },
                    { label: 'E⃗', cmd: '\\vec{E}', tip: 'Vector cường độ điện trường' },
                    { label: 'Δt', cmd: '\\Delta t', tip: 'Độ biến thiên thời gian' },
                    { label: 'Δl', cmd: '\\Delta l', tip: 'Độ giãn lò xo' },
                    { label: 'ω', cmd: '\\omega', tip: 'Tần số góc (rad/s)' },
                    { label: 'λ', cmd: '\\lambda', tip: 'Bước sóng' },
                    { label: 'T', cmd: 'T', tip: 'Chu kỳ (s)' },
                    { label: 'f', cmd: 'f', tip: 'Tần số (Hz)' },
                    { label: 'φ', cmd: '\\varphi', tip: 'Pha ban đầu' },
                    { label: 'Ω', cmd: '\\Omega', tip: 'Điện trở Ôm' },
                    { label: 'μF', cmd: '\\mu\\text{F}', tip: 'Điện dung Micro Fara' },
                    { label: 'μ', cmd: '\\mu', tip: 'Hệ số ma sát' },
                    { label: 'm/s', cmd: '\\text{m/s}', tip: 'm/s' },
                    { label: 'm/s²', cmd: '\\text{m/s}^2', tip: 'm/s²' },
                    { label: '°C', cmd: '^\\circ\\text{C}', tip: 'Độ C' },
                    { label: 'rad', cmd: '\\text{rad}', tip: 'Radian' },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => insertCmd(btn.cmd, e)}
                      className="px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                      title={btn.tip}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {/* NỘI DUNG BÀN PHÍM TAB 5: MÔN HÓA HỌC */}
              {keypadTab === 'chemistry' && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { label: '→ (Tạo thành)', cmd: '\\to ', tip: 'Mũi tên phản ứng' },
                    { label: '⇌ (Thuận nghịch)', cmd: '\\rightleftharpoons ', tip: 'Cân bằng thuận nghịch' },
                    { label: '→(t°)', cmd: '\\xrightarrow{t^\\circ} ', tip: 'Phản ứng nhiệt độ' },
                    { label: '→(xt, t°)', cmd: '\\xrightarrow{\\text{xt, } t^\\circ} ', tip: 'Xúc tác nhiệt độ' },
                    { label: '↓ (Kết tủa)', cmd: '\\downarrow ', tip: 'Chất kết tủa' },
                    { label: '↑ (Thoát khí)', cmd: '\\uparrow ', tip: 'Khí bay lên' },
                    { label: 'H₂O', cmd: '\\text{H}_2\\text{O}', tip: 'Nước' },
                    { label: 'CO₂', cmd: '\\text{CO}_2', tip: 'Khí Carbonic' },
                    { label: 'H⁺', cmd: '\\text{H}^+', tip: 'Ion H+' },
                    { label: 'OH⁻', cmd: '\\text{OH}^-', tip: 'Ion OH-' },
                    { label: 'SO₄²⁻', cmd: '\\text{SO}_4^{2-}', tip: 'Ion SO4 2-' },
                    { label: 'Fe³⁺', cmd: '\\text{Fe}^{3+}', tip: 'Ion Fe 3+' },
                    { label: '— (Liên kết đơn)', cmd: '-', tip: 'Liên kết đơn' },
                    { label: '= (Liên kết đôi)', cmd: '=', tip: 'Liên kết đôi' },
                    { label: '≡ (Liên kết ba)', cmd: '\\equiv ', tip: 'Liên kết ba' },
                    { label: 'n = m/M', cmd: 'n = \\frac{m}{M}', tip: 'Số mol' },
                    { label: 'C_M = n/V', cmd: 'C_M = \\frac{n}{V}', tip: 'Nồng độ mol' },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => insertCmd(btn.cmd, e)}
                      className="px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-400 text-amber-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                      title={btn.tip}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {/* NỘI DUNG BÀN PHÍM TAB 6: MÔN SINH HỌC */}
              {keypadTab === 'biology' && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { label: '× (Phép lai)', cmd: '\\times ', tip: 'Phép lai' },
                    { label: 'P (Thế hệ P)', cmd: 'P: ', tip: 'Thế hệ P' },
                    { label: 'F₁', cmd: 'F_1', tip: 'Thế hệ F1' },
                    { label: 'F₂', cmd: 'F_2', tip: 'Thế hệ F2' },
                    { label: 'G_P', cmd: 'G_P: ', tip: 'Giao tử P' },
                    { label: '♀ (Mẹ)', cmd: '\\female ', tip: 'Giới tính cái' },
                    { label: '♂ (Bố)', cmd: '\\male ', tip: 'Giới tính đực' },
                    { label: 'AaBb', cmd: 'AaBb', tip: 'Dị hợp 2 cặp' },
                    { label: 'AB/ab', cmd: '\\frac{AB}{ab}', tip: 'Liên kết gen' },
                    { label: 'Ab/aB', cmd: '\\frac{Ab}{aB}', tip: 'Dị hợp tử chéo' },
                    { label: '2n', cmd: '2n', tip: 'Lưỡng bội 2n' },
                    { label: 'n', cmd: 'n', tip: 'Đơn bội n' },
                    { label: '2n + 1', cmd: '2n + 1', tip: 'Thể ba' },
                    { label: 'Iᴬ', cmd: 'I^A', tip: 'Alen IA' },
                    { label: 'Iᴮ', cmd: 'I^B', tip: 'Alen IB' },
                    { label: 'Iᴼ', cmd: 'I^O', tip: 'Alen IO' },
                    { label: 'f = % (Hoán vị)', cmd: 'f = #?\\%', tip: 'Tần số hoán vị' },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => insertCmd(btn.cmd, e)}
                      className="px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-white border border-teal-200 hover:bg-teal-50 hover:border-teal-400 text-teal-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                      title={btn.tip}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {/* NỘI DUNG BÀN PHÍM TAB 7: MẪU TỰ LUẬN NHƯ TRÊN GIẤY */}
              {keypadTab === 'templates' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  {[
                    {
                      title: '1. Giải PT Lượng giác [hoặc]',
                      desc: 'Khung 2 họ nghiệm kèm điều kiện k nguyên',
                      cmd: '\\iff \\left[\\begin{array}{l} x = #? + k2\\pi \\\\ x = #? + k2\\pi \\end{array}\\right. (k \\in \\mathbb{Z})'
                    },
                    {
                      title: '2. Giải Hệ Phương trình {và}',
                      desc: 'Khung ngoặc nhọn hệ 2 phương trình',
                      cmd: '\\iff \\begin{cases} #? \\\\ #? \\end{cases} \\iff \\begin{cases} x = #? \\\\ y = #? \\end{cases}'
                    },
                    {
                      title: '3. Điều kiện xác định',
                      desc: 'Khung ghi điều kiện phương trình',
                      cmd: '\\text{ĐK: } #? \\ge 0 \\implies x \\in [#?; +\\infty)'
                    },
                    {
                      title: '4. Kết luận tập nghiệm',
                      desc: 'Vậy phương trình có tập nghiệm S = {...}',
                      cmd: '\\text{Vậy tập nghiệm của PT là: } S = \\left\\{ #? \\right\\}'
                    },
                  ].map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => insertCmd(tpl.cmd, e)}
                      className="p-3 rounded-xl bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-50/50 text-left cursor-pointer transition-all shadow-2xs group"
                    >
                      <div className="font-bold text-xs text-rose-950 group-hover:text-rose-700">{tpl.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. FOOTER: Nút gửi kết quả to ở dưới */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-500 font-medium truncate hidden sm:block">
                ✨ Bấm "Gửi Kết Quả" để điền công thức vào bài thi và đóng bàn phím
              </div>

              <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer text-center"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndSubmit}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Gửi Kết Quả Vào Bài</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
