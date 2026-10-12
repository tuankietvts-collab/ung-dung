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
  Space
} from 'lucide-react';

// Import mathlive to register <math-field> and window.mathVirtualKeyboard
import 'mathlive';

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
  placeholder = 'Chạm vào để soạn thảo công thức hoặc bài làm...',
  disabled = false,
  label,
  className = '',
  mode = 'short_answer',
  minHeight = '56px',
}) => {
  const mfRef = useRef<any>(null);
  const [showKeypad, setShowKeypad] = useState(true);
  const [keypadTab, setKeypadTab] = useState<
    'basic_math' | 'equations' | 'trig_calc' | 'physics' | 'chemistry' | 'biology' | 'templates'
  >('basic_math');
  const [isFastTextMode, setIsFastTextMode] = useState(false);
  const [isVirtualKeyboardActive, setIsVirtualKeyboardActive] = useState(false);

  // Configure MathLive global virtual keyboard policies and layout
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).mathVirtualKeyboard) {
      try {
        const mvk = (window as any).mathVirtualKeyboard;
        mvk.policy = 'auto';
        if (mvk.container === undefined && document.body) {
          mvk.container = document.body;
        }

        // Custom High School Layout for MathLive OS virtual keyboard
        mvk.layouts = [
          {
            id: 'toan-thpt',
            label: 'Toán THPT',
            tooltip: 'Bàn phím Toán SGK GDPT (Lượng giác, Nghiệm, Phân số, Hệ PT)',
            rows: [
              [
                { latex: '\\pi', tooltip: 'Số Pi' },
                { latex: 'e', tooltip: 'Số e' },
                { latex: '\\implies', tooltip: 'Suy ra' },
                { latex: '\\iff', tooltip: 'Tương đương' },
                {
                  label: '[Hoặc 2 nghiệm',
                  insert: '\\left[\\begin{array}{l} #? \\\\ #? \\end{array}\\right.',
                  tooltip: 'Ngoặc vuông 2 nghiệm lượng giác'
                },
                {
                  label: '{Hệ 2 PT',
                  insert: '\\begin{cases} #? \\\\ #? \\end{cases}',
                  tooltip: 'Hệ 2 phương trình'
                },
                { latex: '\\frac{#@}{#?}', tooltip: 'Phân số' },
                { latex: '\\sqrt{#?}', tooltip: 'Căn bậc 2' },
                { latex: '^{#?}', tooltip: 'Số mũ' },
                { latex: '_{#?}', tooltip: 'Chỉ số dưới' }
              ],
              [
                { latex: '7' },
                { latex: '8' },
                { latex: '9' },
                { latex: '+' },
                { latex: '-' },
                { latex: 'x' },
                { latex: 'y' },
                { latex: 'z' },
                { latex: 't' },
                { latex: 'm' }
              ],
              [
                { latex: '4' },
                { latex: '5' },
                { latex: '6' },
                { latex: '\\times' },
                { latex: '\\div' },
                { latex: '(' },
                { latex: ')' },
                { latex: '[' },
                { latex: ']' },
                { latex: '=' }
              ],
              [
                { latex: '1' },
                { latex: '2' },
                { latex: '3' },
                { latex: '0' },
                { latex: ',' },
                { latex: ';' },
                { command: 'moveToPreviousChar', label: '←', tooltip: 'Sang trái' },
                { command: 'moveToNextChar', label: '→', tooltip: 'Sang phải' },
                { command: 'moveUp', label: '↑', tooltip: 'Lên trên' },
                { command: 'moveDown', label: '↓', tooltip: 'Xuống dưới' }
              ]
            ]
          },
          'numeric',
          'symbols',
          'alphabetic',
          'greek'
        ];
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Sync value and attach events to <math-field>
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;

    mf.mathVirtualKeyboardPolicy = 'auto';
    mf.setAttribute('math-virtual-keyboard-policy', 'auto');
    mf.smartFence = true;
    mf.smartSuperscript = true;
    mf.readOnly = disabled;

    if (mf.value !== (value || '')) {
      mf.value = value || '';
    }

    const handleInput = () => {
      const latex = mf.value || '';
      onChange(latex);
    };

    const handleFocus = () => {
      if (typeof window !== 'undefined' && (window as any).mathVirtualKeyboard) {
        try {
          (window as any).mathVirtualKeyboard.show();
          setIsVirtualKeyboardActive(true);
        } catch {
          // ignore
        }
      }
    };

    mf.addEventListener('input', handleInput);
    mf.addEventListener('focus', handleFocus);

    return () => {
      mf.removeEventListener('input', handleInput);
      mf.removeEventListener('focus', handleFocus);
    };
  }, [disabled, onChange]);

  // Sync external value changes into mf.value
  useEffect(() => {
    const mf = mfRef.current;
    if (mf && mf.value !== (value || '')) {
      mf.value = value || '';
    }
  }, [value]);

  // Insert command into Mathfield (Preserving focus)
  const insertCmd = useCallback((latex: string, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;

    try {
      mf.focus();
      if (typeof mf.insert === 'function') {
        mf.insert(latex, { focus: true, selectionMode: 'placeholder' });
      } else {
        mf.executeCommand(['insert', latex]);
      }
      const updated = mf.value || '';
      onChange(updated);
    } catch {
      const nextVal = (value || '') + latex;
      if (mf) mf.value = nextVal;
      onChange(nextVal);
    }
  }, [disabled, onChange, value]);

  // Backspace - Delete backward character or token
  const handleBackspace = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;

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
      if (!res || currentVal === (value || '')) {
        const trimmed = (value || '').replace(/(\\[a-zA-Z]+|\{[^}]*\}|.)\s*$/, '');
        mf.value = trimmed;
        onChange(trimmed);
      } else {
        onChange(currentVal);
      }
    } catch {
      const current = value || '';
      const trimmed = current.replace(/(\\[a-zA-Z]+|\{[^}]*\}|.)\s*$/, '');
      if (mf) mf.value = trimmed;
      onChange(trimmed);
    }
  }, [disabled, onChange, value]);

  // Move cursor Left
  const handleMoveLeft = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      mf.executeCommand('moveToPreviousChar');
    } catch {
      // ignore
    }
  }, [disabled]);

  // Move cursor Right
  const handleMoveRight = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      mf.executeCommand('moveToNextChar');
    } catch {
      // ignore
    }
  }, [disabled]);

  // Move cursor UP (Lên)
  const handleMoveUp = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      const moved = mf.executeCommand('moveUp');
      if (!moved) {
        mf.executeCommand('moveToPreviousPlaceholder');
      }
    } catch {
      // ignore
    }
  }, [disabled]);

  // Move cursor DOWN (Xuống)
  const handleMoveDown = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      const moved = mf.executeCommand('moveDown');
      if (!moved) {
        mf.executeCommand('moveToNextPlaceholder');
      }
    } catch {
      // ignore
    }
  }, [disabled]);

  // Jump to Next Placeholder
  const handleNextPlaceholder = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      mf.executeCommand('moveToNextPlaceholder');
    } catch {
      // ignore
    }
  }, [disabled]);

  // Insert New Line / Multiline Row (Xuống dòng tự luận)
  const handleInsertNewline = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
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
      onChange(mf.value || '');
    } catch {
      const next = (value || '') + ' \\\\ ';
      if (mf) mf.value = next;
      onChange(next);
    }
  }, [disabled, onChange, value]);

  // Undo
  const handleUndo = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      mf.executeCommand('undo');
      onChange(mf.value || '');
    } catch {
      // ignore
    }
  }, [disabled, onChange]);

  // Redo
  const handleRedo = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (!mf || disabled) return;
    try {
      mf.focus();
      mf.executeCommand('redo');
      onChange(mf.value || '');
    } catch {
      // ignore
    }
  }, [disabled, onChange]);

  // Clear entire field
  const clearField = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const mf = mfRef.current;
    if (mf) {
      mf.value = '';
      mf.focus();
    }
    onChange('');
  }, [onChange]);

  // Toggle MathLive native floating virtual keyboard
  const toggleNativeKeyboard = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (typeof window !== 'undefined' && (window as any).mathVirtualKeyboard) {
      const mvk = (window as any).mathVirtualKeyboard;
      try {
        if (mvk.visible) {
          mvk.hide();
          setIsVirtualKeyboardActive(false);
        } else {
          const mf = mfRef.current;
          if (mf) mf.focus();
          mvk.show();
          setIsVirtualKeyboardActive(true);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header controls: Label + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label ? (
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
          </label>
        ) : <div />}

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Nút bật/tắt Bàn phím ảo trực quan gắn liền */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowKeypad(!showKeypad)}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              showKeypad
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
            title="Bật/Tắt bàn phím toán học trực tiếp trên màn hình"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showKeypad ? 'Đóng bàn phím' : 'Mở bàn phím Khoa Học'}</span>
            {showKeypad ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Nút bật bàn phím nổi hệ thống MathLive OS Virtual Keyboard */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleNativeKeyboard}
            disabled={disabled}
            className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
              isVirtualKeyboardActive
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200'
            }`}
            title="Bật/Tắt bàn phím toán học ảo MathLive của hệ thống"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Phím ảo MathLive</span>
          </button>

          {/* Chuyển đổi chế độ gõ văn bản thông thường */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsFastTextMode(!isFastTextMode)}
            disabled={disabled}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
              isFastTextMode
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Chuyển chế độ gõ ký tự trực tiếp từ bàn phím thiết bị"
          >
            <Type className="w-3.5 h-3.5" />
            <span>{isFastTextMode ? 'Gõ trực quan' : 'Gõ phím thường'}</span>
          </button>

          {value && !disabled && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearField}
              className="px-2 py-1 text-rose-600 hover:text-rose-700 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Xóa toàn bộ nội dung"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa hết</span>
            </button>
          )}
        </div>
      </div>

      {/* INPUT CONTAINER (MathLive WYSIWYG OR Fast Text Input) */}
      <div className="relative group">
        {!isFastTextMode ? (
          React.createElement('math-field', {
            ref: mfRef,
            style: { minHeight },
            placeholder,
            'math-virtual-keyboard-policy': 'auto',
            inputmode: 'none',
            onPointerDown: () => {
              if (typeof window !== 'undefined' && (window as any).mathVirtualKeyboard) {
                try {
                  (window as any).mathVirtualKeyboard.show();
                  setIsVirtualKeyboardActive(true);
                } catch {
                  // ignore
                }
              }
            },
            class:
              'w-full px-4 py-3 bg-white border-2 border-indigo-300 rounded-xl focus-within:border-indigo-600 focus-within:outline-none focus-within:ring-4 focus-within:ring-indigo-100 text-slate-900 text-lg sm:text-xl font-bold transition-all shadow-xs block cursor-text select-text leading-relaxed',
          })
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={mode === 'essay' ? 5 : 2}
            placeholder="Gõ trực tiếp đáp số hoặc lời giải... (Ví dụ: x = pi/12 + k*pi hoặc [ x = 1, x = 2 ]...)"
            className="w-full px-4 py-3 bg-white border-2 border-amber-300 rounded-xl focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 text-slate-900 text-base sm:text-lg font-bold transition-all shadow-xs"
          />
        )}

        {/* Small badge when filled */}
        {value?.trim() && (
          <div className="absolute right-3 top-3 pointer-events-none flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
            <Check className="w-3.5 h-3.5" />
            <span>Đã nhập ({value.length} ký tự)</span>
          </div>
        )}
      </div>

      {/* BÀN PHÍM KHOA HỌC TRỰC QUAN GẮN LIỀN (TOÁN - LÝ - HÓA - SINH & TỰ LUẬN) */}
      {!disabled && showKeypad && (
        <div className="p-2.5 sm:p-3.5 rounded-2xl bg-slate-100/95 border-2 border-indigo-200 shadow-md space-y-2.5 select-none">
          {/* HÀNG ĐIỀU HƯỚNG TỔNG HỢP: ĐIỀU KHIỂN CON TRỎ 4 HƯỚNG (↑, ↓, ←, →), XUỐNG DÒNG, TAB, XÓA, HOÀN TÁC */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200">
            {/* CỤM NÚT ĐIỀU HƯỚNG CON TRỎ 4 CHIỀU CỰC KỲ TIỆN LỢI */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs flex-wrap">
              <span className="text-[10px] font-black uppercase text-slate-500 px-1 hidden sm:inline">Di chuyển:</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleMoveUp}
                className="px-2 py-1 bg-slate-50 hover:bg-indigo-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                title="Di chuyển con trỏ LÊN TRÊN (Tử số, dòng trên, ngoặc vuông trên)"
              >
                <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-black" />
                <span className="text-[11px] font-black">Lên</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleMoveDown}
                className="px-2 py-1 bg-slate-50 hover:bg-indigo-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                title="Di chuyển con trỏ XUỐNG DƯỚI (Mẫu số, dòng dưới, ngoặc vuông dưới)"
              >
                <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-black" />
                <span className="text-[11px] font-black">Xuống</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleMoveLeft}
                className="px-2 py-1 bg-slate-50 hover:bg-indigo-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                title="Di chuyển con trỏ SANG TRÁI"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-indigo-600 font-black" />
                <span className="text-[11px] font-black">Trái</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleMoveRight}
                className="px-2 py-1 bg-slate-50 hover:bg-indigo-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                title="Di chuyển con trỏ SANG PHẢI"
              >
                <ArrowRight className="w-3.5 h-3.5 text-indigo-600 font-black" />
                <span className="text-[11px] font-black">Phải</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleNextPlaceholder}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-lg border border-indigo-200 flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
                title="Chuyển nhanh sang ô trống / tham số tiếp theo (Tab)"
              >
                <span className="text-[11px] font-black">⇥ Ô kế</span>
              </button>

              {/* Nút Xuống dòng (Enter) để làm bài tự luận nhiều dòng */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleInsertNewline}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Xuống dòng mới để viết tiếp bài tự luận (Enter)"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black">Xuống dòng</span>
              </button>
            </div>

            {/* CỤM NÚT SỬA LỖI: HOÀN TÁC, LÀM LẠI, DẤU CÁCH, XÓA LÙI */}
            <div className="flex items-center gap-1 ml-auto flex-wrap">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => insertCmd('\\enspace ', e)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                title="Chèn dấu cách (Space)"
              >
                <Space className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Dấu cách</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUndo}
                className="p-1.5 bg-white hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-2xs cursor-pointer active:scale-95"
                title="Hoàn tác (Undo)"
              >
                <Undo2 className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleRedo}
                className="p-1.5 bg-white hover:bg-indigo-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-2xs cursor-pointer active:scale-95"
                title="Làm lại (Redo)"
              >
                <Redo2 className="w-3.5 h-3.5 text-slate-600" />
              </button>
              {/* NÚT XÓA LÙI (BACKSPACE) NỔI BẬT DỄ DÀNG XÓA KHI NHẬP SAI */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleBackspace}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Xóa ký tự hoặc công thức vừa nhập sai (Backspace)"
              >
                <Delete className="w-4 h-4" />
                <span>Xóa (⌫)</span>
              </button>
            </div>
          </div>

          {/* THANH TAB PHÂN LOẠI CÁC BỘ KÝ HIỆU KHOA HỌC: TOÁN, LƯỢNG GIÁC, VẬT LÝ, HÓA HỌC, SINH HỌC, MẪU TỰ LUẬN */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('basic_math')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'basic_math'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Số & Cơ bản (π, e)</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('equations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'equations'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>[Ngoặc Vuông] & Hệ PT (⇒, ⇔)</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('trig_calc')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'trig_calc'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Lượng Giác & Giải Tích</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('physics')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'physics'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Atom className="w-3.5 h-3.5" />
              <span>Vật Lý (Vector, Ω, λ)</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('chemistry')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'chemistry'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Hóa Học (Phản ứng, Ion)</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('biology')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'biology'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Dna className="w-3.5 h-3.5" />
              <span>Sinh Học (Lai tạo, Kiểu gen)</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeypadTab('templates')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                keypadTab === 'templates'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Mẫu Tự Luận Như Giấy Thi</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* NỘI DUNG TỪNG TAB BÀN PHÍM                                               */}
          {/* ========================================================================= */}

          {/* TAB 1: SỐ, BIẾN, PHÂN SỐ, CĂN, SỐ PI, SỐ e */}
          {keypadTab === 'basic_math' && (
            <div className="space-y-1.5 pt-0.5">
              {/* Hàng phím đặc biệt ưu tiên số pi, số e, phân số, căn */}
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
                    className="py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer font-serif"
                    title={item.tip}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Bàn phím số & biến */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5">
                {['7', '8', '9', '+', '-', 'x', 'y', 'z', 't', 'm'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd(key, e)}
                    className="py-2 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 text-slate-900 font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer font-mono"
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
                      className="py-2 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 text-slate-900 font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer font-mono"
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
                      className="py-2 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 text-slate-900 font-mono font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      {display}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DẤU NGOẶC VUÔNG (HOẶC 2-3 NGHIỆM PT LƯỢNG GIÁC), HỆ PT, DẤU SUY RA, TƯƠNG ĐƯƠNG */}
          {keypadTab === 'equations' && (
            <div className="space-y-2 pt-0.5">
              <div className="text-[11px] font-bold text-purple-900 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                ✨ Công cụ viết nghiệm phương trình lượng giác, hệ phương trình và mệnh đề logic chuẩn SGK
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: '⇒ (Suy ra)',
                    cmd: '\\implies ',
                    tip: 'Dấu suy ra trong lập luận biến đổi'
                  },
                  {
                    label: '⇔ (Tương đương)',
                    cmd: '\\iff ',
                    tip: 'Dấu tương đương giữa các bước phương trình'
                  },
                  {
                    label: '→ (Mũi tên)',
                    cmd: '\\to ',
                    tip: 'Mũi tên biến thiên hoặc xu hướng'
                  },
                  {
                    label: '[ 2 nghiệm (Hoặc)',
                    cmd: '\\left[\\begin{array}{l} #? \\\\ #? \\end{array}\\right.',
                    tip: 'Dấu ngoặc vuông mở 2 nhánh nghiệm phương trình lượng giác (x = a hoặc x = b)'
                  },
                  {
                    label: '[ 3 nghiệm (Hoặc)',
                    cmd: '\\left[\\begin{array}{l} #? \\\\ #? \\\\ #? \\end{array}\\right.',
                    tip: 'Dấu ngoặc vuông mở 3 nhánh nghiệm'
                  },
                  {
                    label: '{ Hệ 2 PT (Và)',
                    cmd: '\\begin{cases} #? \\\\ #? \\end{cases}',
                    tip: 'Dấu ngoặc nhọn hệ 2 phương trình'
                  },
                  {
                    label: '{ Hệ 3 PT (Và)',
                    cmd: '\\begin{cases} #? \\\\ #? \\\\ #? \\end{cases}',
                    tip: 'Dấu ngoặc nhọn hệ 3 phương trình'
                  },
                  {
                    label: '(a; b)',
                    cmd: '(#?; #?)',
                    tip: 'Khoảng nghiệm hoặc tọa độ'
                  },
                  {
                    label: '[a; b]',
                    cmd: '[#?; #?]',
                    tip: 'Đoạn nghiệm'
                  },
                  {
                    label: '∪',
                    cmd: '\\cup ',
                    tip: 'Hợp các tập nghiệm'
                  },
                  {
                    label: '∩',
                    cmd: '\\cap ',
                    tip: 'Giao các tập nghiệm'
                  },
                  {
                    label: 'k ∈ ℤ',
                    cmd: 'k \\in \\mathbb{Z}',
                    tip: 'Điều kiện k nguyên trong phương trình lượng giác'
                  },
                  {
                    label: '∈',
                    cmd: '\\in ',
                    tip: 'Thuộc'
                  },
                  {
                    label: '∉',
                    cmd: '\\notin ',
                    tip: 'Không thuộc'
                  },
                  {
                    label: 'ℝ',
                    cmd: '\\mathbb{R}',
                    tip: 'Tập số thực'
                  },
                  {
                    label: '∅',
                    cmd: '\\varnothing',
                    tip: 'Tập rỗng (Vô nghiệm)'
                  },
                  {
                    label: '≠',
                    cmd: '\\ne ',
                    tip: 'Khác'
                  },
                  {
                    label: '≤',
                    cmd: '\\le ',
                    tip: 'Nhỏ hơn hoặc bằng'
                  },
                  {
                    label: '≥',
                    cmd: '\\ge ',
                    tip: 'Lớn hơn hoặc bằng'
                  },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd(btn.cmd, e)}
                    className="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-white border border-purple-300 hover:bg-purple-50 hover:border-purple-500 text-purple-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                    title={btn.tip}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: LƯỢNG GIÁC, ĐẠO HÀM, TÍCH PHÂN, GIỚI HẠN */}
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
                { label: 'C_n^k', cmd: 'C_{#?}^{#?}', tip: 'Tổ hợp chập k của n' },
                { label: 'A_n^k', cmd: 'A_{#?}^{#?}', tip: 'Chỉnh hợp' },
              ].map((btn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => insertCmd(btn.cmd, e)}
                  className="px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-400 text-blue-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                  title={btn.tip}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {/* TAB 4: MÔN VẬT LÝ (VECTOR, GIA TỐC, LỰC, ĐƠN VỊ, TẦN SỐ GÓC, BƯỚC SÓNG) */}
          {keypadTab === 'physics' && (
            <div className="space-y-2 pt-0.5">
              <div className="text-[11px] font-bold text-emerald-900 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                ⚡ Ký hiệu Vật lý: Vector đại lượng, pha dao động, sóng ánh sáng, điện từ học chuẩn SGK THPT
              </div>
              <div className="flex flex-wrap gap-1.5">
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
                  { label: 'λ', cmd: '\\lambda', tip: 'Bước sóng (m hoặc nm)' },
                  { label: 'T', cmd: 'T', tip: 'Chu kỳ dao động (s)' },
                  { label: 'f', cmd: 'f', tip: 'Tần số (Hz)' },
                  { label: 'φ', cmd: '\\varphi', tip: 'Pha ban đầu' },
                  { label: 'Ω', cmd: '\\Omega', tip: 'Đơn vị điện trở Ôm' },
                  { label: 'μF', cmd: '\\mu\\text{F}', tip: 'Đơn vị điện dung Micro Fara' },
                  { label: 'μ', cmd: '\\mu', tip: 'Hệ số ma sát' },
                  { label: 'ρ', cmd: '\\rho', tip: 'Khối lượng riêng' },
                  { label: 'm/s', cmd: '\\text{m/s}', tip: 'Đơn vị vận tốc m/s' },
                  { label: 'm/s²', cmd: '\\text{m/s}^2', tip: 'Đơn vị gia tốc m/s²' },
                  { label: '°C', cmd: '^\\circ\\text{C}', tip: 'Độ C (Nhiệt độ)' },
                  { label: 'rad', cmd: '\\text{rad}', tip: 'Đơn vị radian' },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd(btn.cmd, e)}
                    className="px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                    title={btn.tip}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MÔN HÓA HỌC (PHẢN ỨNG, KẾT TỦA, BAY HƠI, ION, CÂN BẰNG) */}
          {keypadTab === 'chemistry' && (
            <div className="space-y-2 pt-0.5">
              <div className="text-[11px] font-bold text-amber-900 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                🧪 Ký hiệu Hóa học: Mũi tên phản ứng nhiệt độ, kết tủa, thoát khí, liên kết và công thức ion
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '→ (Tạo thành)', cmd: '\\to ', tip: 'Mũi tên phản ứng 1 chiều' },
                  { label: '⇌ (Thuận nghịch)', cmd: '\\rightleftharpoons ', tip: 'Phản ứng cân bằng thuận nghịch' },
                  { label: '→(t°)', cmd: '\\xrightarrow{t^\\circ} ', tip: 'Phản ứng có xúc tác nhiệt độ t°' },
                  { label: '→(xt, t°)', cmd: '\\xrightarrow{\\text{xt, } t^\\circ} ', tip: 'Phản ứng có xúc tác và nhiệt độ' },
                  { label: '↓ (Kết tủa)', cmd: '\\downarrow ', tip: 'Chất kết tủa lắng xuống' },
                  { label: '↑ (Thoát khí)', cmd: '\\uparrow ', tip: 'Khí bay lên' },
                  { label: 'H₂O', cmd: '\\text{H}_2\\text{O}', tip: 'Nước' },
                  { label: 'CO₂', cmd: '\\text{CO}_2', tip: 'Khí Carbonic' },
                  { label: 'H⁺', cmd: '\\text{H}^+', tip: 'Cation Hydro' },
                  { label: 'OH⁻', cmd: '\\text{OH}^-', tip: 'Anion Hydroxit' },
                  { label: 'SO₄²⁻', cmd: '\\text{SO}_4^{2-}', tip: 'Anion Sunfat' },
                  { label: 'Fe³⁺', cmd: '\\text{Fe}^{3+}', tip: 'Ion Sắt III' },
                  { label: 'Cu²⁺', cmd: '\\text{Cu}^{2+}', tip: 'Ion Đồng II' },
                  { label: '— (Liên kết đơn)', cmd: '-', tip: 'Liên kết cộng hóa trị đơn' },
                  { label: '= (Liên kết đôi)', cmd: '=', tip: 'Liên kết đôi' },
                  { label: '≡ (Liên kết ba)', cmd: '\\equiv ', tip: 'Liên kết ba axetilen' },
                  { label: 'n = m/M', cmd: 'n = \\frac{m}{M}', tip: 'Số mol chất' },
                  { label: 'C_M = n/V', cmd: 'C_M = \\frac{n}{V}', tip: 'Nồng độ mol' },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd(btn.cmd, e)}
                    className="px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-400 text-amber-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                    title={btn.tip}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: MÔN SINH HỌC (LAI TẠO, KIỂU GEN, PHÉP LAI, NST) */}
          {keypadTab === 'biology' && (
            <div className="space-y-2 pt-0.5">
              <div className="text-[11px] font-bold text-teal-900 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
                🧬 Ký hiệu Di truyền & Sinh học: Phép lai, kiểu gen, tần số hoán vị, alen và bộ NST
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '× (Phép lai)', cmd: '\\times ', tip: 'Dấu phép lai giữa bố và mẹ' },
                  { label: 'P (Thế hệ P)', cmd: 'P: ', tip: 'Thế hệ xuất phát P' },
                  { label: 'F₁', cmd: 'F_1', tip: 'Thế hệ con lai F1' },
                  { label: 'F₂', cmd: 'F_2', tip: 'Thế hệ F2' },
                  { label: 'G_P', cmd: 'G_P: ', tip: 'Giao tử thế hệ P' },
                  { label: '♀ (Mẹ)', cmd: '\\female ', tip: 'Giới tính cái' },
                  { label: '♂ (Bố)', cmd: '\\male ', tip: 'Giới tính đực' },
                  { label: 'AaBb', cmd: 'AaBb', tip: 'Kiểu gen dị hợp 2 cặp' },
                  { label: 'AB/ab', cmd: '\\frac{AB}{ab}', tip: 'Kiểu gen liên kết gen hoàn toàn' },
                  { label: 'Ab/aB', cmd: '\\frac{Ab}{aB}', tip: 'Kiểu gen dị hợp tử chéo' },
                  { label: '2n', cmd: '2n', tip: 'Bộ nhiễm sắc thể lưỡng bội' },
                  { label: 'n', cmd: 'n', tip: 'Bộ nhiễm sắc thể đơn bội' },
                  { label: '2n + 1', cmd: '2n + 1', tip: 'Thể ba' },
                  { label: '2n - 1', cmd: '2n - 1', tip: 'Thể một' },
                  { label: 'Iᴬ', cmd: 'I^A', tip: 'Alen nhóm máu A' },
                  { label: 'Iᴮ', cmd: 'I^B', tip: 'Alen nhóm máu B' },
                  { label: 'Iᴼ', cmd: 'I^O', tip: 'Alen nhóm máu O' },
                  { label: 'f = % (Hoán vị)', cmd: 'f = #?\\%', tip: 'Tần số hoán vị gen' },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd(btn.cmd, e)}
                    className="px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-white border border-teal-200 hover:bg-teal-50 hover:border-teal-400 text-teal-950 transition-all font-serif cursor-pointer shadow-2xs active:scale-95"
                    title={btn.tip}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: MẪU TỰ LUẬN TRÌNH BÀY ĐA DÒNG NHƯ TRÊN GIẤY THI */}
          {keypadTab === 'templates' && (
            <div className="space-y-2 pt-0.5">
              <div className="text-[11px] font-bold text-rose-900 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                📝 Khung mẫu trình bày bài tự luận chuẩn SGK: Điền sẵn cấu trúc để học sinh lập luận bước giải như trên giấy
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    title: '1. Giải PT Lượng giác [hoặc]',
                    desc: 'Cấu trúc giải nghiệm ra 2 họ nghiệm kèm điều kiện k nguyên',
                    cmd: '\\iff \\left[\\begin{array}{l} x = #? + k2\\pi \\\\ x = #? + k2\\pi \\end{array}\\right. (k \\in \\mathbb{Z})'
                  },
                  {
                    title: '2. Giải Hệ Phương trình {và}',
                    desc: 'Cấu trúc ngoặc nhọn hệ 2 phương trình',
                    cmd: '\\iff \\begin{cases} #? \\\\ #? \\end{cases} \\iff \\begin{cases} x = #? \\\\ y = #? \\end{cases}'
                  },
                  {
                    title: '3. Điều kiện xác định',
                    desc: 'Khung ghi điều kiện phương trình / căn / mẫu số',
                    cmd: '\\text{ĐK: } #? \\ge 0 \\implies x \\in [#?; +\\infty)'
                  },
                  {
                    title: '4. Kết luận tập nghiệm',
                    desc: 'Vậy phương trình có tập nghiệm S = {...}',
                    cmd: '\\text{Vậy tập nghiệm của PT là: } S = \\left\\{ #? \\right\\}'
                  },
                  {
                    title: '5. Phương trình hóa học kèm đk',
                    desc: 'Phương trình phản ứng xúc tác nhiệt độ',
                    cmd: '#? + #? \\xrightarrow{t^\\circ} #? \\downarrow + #? \\uparrow'
                  },
                  {
                    title: '6. Tóm tắt & Áp dụng công thức Lý',
                    desc: 'Khung định luật Newton / Bảo toàn cơ năng',
                    cmd: '\\text{Áp dụng: } W = W_t + W_d = mgh + \\frac{1}{2}mv^2'
                  },
                ].map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => insertCmd(tpl.cmd, e)}
                    className="p-2.5 rounded-xl bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-50/50 text-left cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="font-bold text-xs text-rose-950 group-hover:text-rose-700">{tpl.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer status: WYSIWYG note + LaTeX Preview */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 flex-wrap gap-1">
        <span>✨ Công thức toán hiển thị trực quan (WYSIWYG) chuẩn Sách Giáo Khoa GDPT 2018</span>
        {value && (
          <span className="font-mono text-slate-400 truncate max-w-[280px]" title={value}>
            Mã lưu: {value}
          </span>
        )}
      </div>
    </div>
  );
};
