import React, { useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  Code2,
  BookOpen,
  HelpCircle,
  Check,
  Hash,
  ChevronDown,
  Layers,
  FileText
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { MathLiveField } from './MathLiveField';

export interface MathFormulaEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mode?: 'compact' | 'full'; // 'compact' for short answer, 'full' for essay
  label?: string;
  className?: string;
  minHeight?: string;
}

// Quick math symbol palettes
interface MathBtn {
  label: string;
  latex: string;
  tooltip: string;
  cursorOffset?: number; // Cursor position relative to end of inserted string
}

export const MathFormulaEditor: React.FC<MathFormulaEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nhập câu trả lời...',
  disabled = false,
  mode = 'compact',
  label,
  className = '',
  minHeight = '140px',
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'analysis' | 'geometry' | 'logic' | 'templates'>('basic');
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [showHelper, setShowHelper] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [scratchpadFormula, setScratchpadFormula] = useState<string>('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Compact quick symbols (used for Part III short answers)
  const compactPalette: MathBtn[] = useMemo(() => [
    { label: 'π', latex: '\\pi ', tooltip: 'Số Pi', cursorOffset: 0 },
    { label: 'e', latex: 'e', tooltip: 'Số e', cursorOffset: 0 },
    { label: '⇒', latex: '\\implies ', tooltip: 'Suy ra', cursorOffset: 0 },
    { label: '⇔', latex: '\\iff ', tooltip: 'Tương đương', cursorOffset: 0 },
    { label: '[ Hoặc', latex: '\\left[\\begin{array}{l} a \\\\ b \\end{array}\\right.', tooltip: 'Dấu ngoặc vuông 2 nghiệm', cursorOffset: -12 },
    { label: '{ Hệ PT', latex: '\\begin{cases} a \\\\ b \\end{cases}', tooltip: 'Dấu ngoặc nhọn hệ phương trình', cursorOffset: -12 },
    { label: 'a/b', latex: '\\frac{a}{b}', tooltip: 'Phân số', cursorOffset: -4 },
    { label: '√x', latex: '\\sqrt{x}', tooltip: 'Căn bậc hai', cursorOffset: -2 },
    { label: 'x²', latex: '^2', tooltip: 'Mũ 2', cursorOffset: 0 },
    { label: 'xⁿ', latex: '^{n}', tooltip: 'Mũ n', cursorOffset: -2 },
    { label: '±', latex: '\\pm ', tooltip: 'Cộng trừ', cursorOffset: 0 },
    { label: '∞', latex: '+\\infty', tooltip: 'Dương vô cùng', cursorOffset: 0 },
    { label: '(a;b)', latex: '(a; b)', tooltip: 'Khoảng mở', cursorOffset: -3 },
    { label: '[a;b]', latex: '[a; b]', tooltip: 'Đoạn đóng', cursorOffset: -3 },
    { label: '∪', latex: '\\cup ', tooltip: 'Hợp tập nghiệm', cursorOffset: 0 },
    { label: '≤', latex: '\\le ', tooltip: 'Nhỏ hơn hoặc bằng', cursorOffset: 0 },
    { label: '≥', latex: '\\ge ', tooltip: 'Lớn hơn hoặc bằng', cursorOffset: 0 },
  ], []);

  // Full palettes for Part III Essay
  const basicPalette: MathBtn[] = useMemo(() => [
    { label: 'π', latex: '$\\pi$', tooltip: 'Số Pi', cursorOffset: -1 },
    { label: 'e', latex: '$e$', tooltip: 'Số e', cursorOffset: -1 },
    { label: '⇒', latex: '$\\implies$', tooltip: 'Suy ra', cursorOffset: -1 },
    { label: '⇔', latex: '$\\iff$', tooltip: 'Tương đương', cursorOffset: -1 },
    { label: '[ Hoặc', latex: '$\\left[\\begin{array}{l} a \\\\ b \\end{array}\\right.$', tooltip: 'Ngoặc vuông 2 họ nghiệm', cursorOffset: -13 },
    { label: '{ Hệ PT', latex: '$\\begin{cases} a \\\\ b \\end{cases}$', tooltip: 'Hệ 2 phương trình', cursorOffset: -13 },
    { label: 'a/b', latex: '$\\frac{a}{b}$', tooltip: 'Phân số', cursorOffset: -2 },
    { label: '√x', latex: '$\\sqrt{x}$', tooltip: 'Căn bậc 2', cursorOffset: -2 },
    { label: 'x²', latex: '$x^2$', tooltip: 'Bình phương', cursorOffset: -1 },
    { label: 'xⁿ', latex: '$x^{n}$', tooltip: 'Lũy thừa', cursorOffset: -2 },
    { label: 'x₁', latex: '$x_{1}$', tooltip: 'Chỉ số', cursorOffset: -2 },
    { label: '|x|', latex: '$|x|$', tooltip: 'Giá trị tuyệt đối', cursorOffset: -2 },
    { label: '±', latex: '$\\pm$', tooltip: 'Cộng trừ', cursorOffset: -1 },
    { label: '≈', latex: '$\\approx$', tooltip: 'Xấp xỉ', cursorOffset: -1 },
    { label: '≠', latex: '$\\ne$', tooltip: 'Khác', cursorOffset: -1 },
    { label: '≤', latex: '$\\le$', tooltip: 'Nhỏ hơn hoặc bằng', cursorOffset: -1 },
    { label: '≥', latex: '$\\ge$', tooltip: 'Lớn hơn hoặc bằng', cursorOffset: -1 },
  ], []);

  const analysisPalette: MathBtn[] = useMemo(() => [
    { label: 'lim', latex: '$\\lim_{x \\to x_0} f(x)$', tooltip: 'Giới hạn', cursorOffset: -6 },
    { label: 'lim ∞', latex: '$\\lim_{x \\to +\\infty} f(x)$', tooltip: 'Giới hạn vô cực', cursorOffset: -6 },
    { label: '∫dx', latex: '$\\int f(x)\\,dx$', tooltip: 'Nguyên hàm', cursorOffset: -6 },
    { label: '∫[a,b]', latex: '$\\int_{a}^{b} f(x)\\,dx$', tooltip: 'Tích phân xác định', cursorOffset: -6 },
    { label: "y'", latex: "$y'$", tooltip: 'Đạo hàm bậc nhất', cursorOffset: -1 },
    { label: "y''", latex: "$y''$", tooltip: 'Đạo hàm bậc hai', cursorOffset: -1 },
    { label: 'ln(x)', latex: '$\\ln(x)$', tooltip: 'Logarit tự nhiên', cursorOffset: -2 },
    { label: 'log_a', latex: '$\\log_{a}(x)$', tooltip: 'Logarit cơ số a', cursorOffset: -2 },
    { label: 'eˣ', latex: '$e^{x}$', tooltip: 'Số e mũ x', cursorOffset: -2 },
    { label: 'sin', latex: '$\\sin(x)$', tooltip: 'Sin', cursorOffset: -2 },
    { label: 'cos', latex: '$\\cos(x)$', tooltip: 'Cos', cursorOffset: -2 },
    { label: 'tan', latex: '$\\tan(x)$', tooltip: 'Tan', cursorOffset: -2 },
  ], []);

  const geometryPalette: MathBtn[] = useMemo(() => [
    { label: 'u⃗', latex: '$\\vec{u}$', tooltip: 'Vectơ u', cursorOffset: -2 },
    { label: 'AB⃗', latex: '$\\vec{AB}$', tooltip: 'Vectơ AB', cursorOffset: -2 },
    { label: '|u⃗|', latex: '$|\\vec{u}|$', tooltip: 'Độ dài vectơ', cursorOffset: -2 },
    { label: '∠A', latex: '$\\widehat{BAC}$', tooltip: 'Góc BAC', cursorOffset: -2 },
    { label: '⊥', latex: '$\\perp$', tooltip: 'Vuông góc', cursorOffset: -1 },
    { label: '∥', latex: '$\\parallel$', tooltip: 'Song song', cursorOffset: -1 },
    { label: 'ΔABC', latex: '$\\Delta ABC$', tooltip: 'Tam giác ABC', cursorOffset: -1 },
    { label: '∈', latex: '$\\in$', tooltip: 'Thuộc', cursorOffset: -1 },
    { label: '∉', latex: '$\\notin$', tooltip: 'Không thuộc', cursorOffset: -1 },
    { label: '⊂', latex: '$\\subset$', tooltip: 'Tập con', cursorOffset: -1 },
    { label: 'α', latex: '$\\alpha$', tooltip: 'Alpha', cursorOffset: -1 },
    { label: 'β', latex: '$\\beta$', tooltip: 'Beta', cursorOffset: -1 },
  ], []);

  const logicPalette: MathBtn[] = useMemo(() => [
    { label: '⇒', latex: '$\\Rightarrow$', tooltip: 'Suy ra', cursorOffset: -1 },
    { label: '⇔', latex: '$\\Leftrightarrow$', tooltip: 'Tương đương', cursorOffset: -1 },
    {
      label: '{ Hệ PT',
      latex: '$\\begin{cases} x + y = 2 \\\\ 2x - y = 1 \\end{cases}$',
      tooltip: 'Hệ 2 phương trình',
      cursorOffset: -13
    },
    {
      label: '[ Hệ Hoặc',
      latex: '$\\left[\\begin{matrix} x = 1 \\\\ x = 2 \\end{matrix}\\right.$',
      tooltip: 'Hoặc x = 1 hoặc x = 2',
      cursorOffset: -19
    },
    { label: '∪', latex: '$\\cup$', tooltip: 'Hợp', cursorOffset: -1 },
    { label: '∩', latex: '$\\cap$', tooltip: 'Giao', cursorOffset: -1 },
    { label: '∅', latex: '$\\emptyset$', tooltip: 'Tập rỗng', cursorOffset: -1 },
    { label: 'ℝ', latex: '$\\mathbb{R}$', tooltip: 'Tập số thực', cursorOffset: -1 },
    { label: 'ℤ', latex: '$\\mathbb{Z}$', tooltip: 'Tập số nguyên', cursorOffset: -1 },
    { label: 'ℕ', latex: '$\\mathbb{N}$', tooltip: 'Tập số tự nhiên', cursorOffset: -1 },
    { label: '+∞', latex: '$+\\infty$', tooltip: 'Dương vô cực', cursorOffset: -1 },
    { label: '-∞', latex: '$-\\infty$', tooltip: 'Âm vô cực', cursorOffset: -1 },
  ], []);

  const stepTemplates = useMemo(() => [
    {
      title: 'Bước 1: Điều kiện xác định',
      snippet: '\n- Điều kiện xác định (ĐKXĐ): $x \\ge 0$\n',
    },
    {
      title: 'Bước 2: Tập xác định & Đạo hàm',
      snippet: '\n- Tập xác định: $D = \\mathbb{R}$\n- Ta có đạo hàm: $y\' = 3x^2 - 6x$\n- Cho $y\' = 0 \\Leftrightarrow \\left[\\begin{matrix} x = 0 \\\\ x = 2 \\end{matrix}\\right.$\n',
    },
    {
      title: 'Bước 3: Lập bảng biến thiên / Xét dấu',
      snippet: '\n- Xét dấu đạo hàm: $y\' > 0$ khi $x \\in (-\\infty; 0) \\cup (2; +\\infty)$, $y\' < 0$ khi $x \\in (0; 2)$\n- Hàm số đồng biến trên $(-\\infty; 0)$ và $(2; +\\infty)$\n- Hàm số nghịch biến trên $(0; 2)$\n',
    },
    {
      title: 'Bước 4: Kết luận nghiệm / Giá trị',
      snippet: '\n- Kết luận: Vậy phương trình có tập nghiệm là $S = \\{1; 2\\}$\n',
    },
    {
      title: 'Khung bài giải hoàn chỉnh',
      snippet: `Lời giải chi tiết:
1) Điều kiện xác định: $x > 0$
2) Biến đổi phương trình:
   $\\Leftrightarrow \\log_2(x) = 3$
   $\\Leftrightarrow x = 2^3 = 8$ (Thỏa mãn ĐKXĐ)
3) Kết luận: Vậy phương trình có nghiệm duy nhất $x = 8$.`,
    },
  ], []);

  // Insert formula string into input or textarea at current cursor position
  const handleInsert = (latexText: string, cursorOffset = 0) => {
    if (disabled) return;

    if (mode === 'compact') {
      const el = inputRef.current;
      if (!el) {
        onChange((value || '') + latexText);
        return;
      }

      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const current = el.value || '';
      const updated = current.slice(0, start) + latexText + current.slice(end);

      onChange(updated);

      setTimeout(() => {
        el.focus();
        const newPos = start + latexText.length + cursorOffset;
        el.setSelectionRange(newPos, newPos);
      }, 10);
    } else {
      const el = textareaRef.current;
      if (!el) {
        onChange((value || '') + (value ? '\n' : '') + latexText);
        return;
      }

      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const current = el.value || '';
      const updated = current.slice(0, start) + latexText + current.slice(end);

      onChange(updated);

      setTimeout(() => {
        el.focus();
        const newPos = start + latexText.length + cursorOffset;
        el.setSelectionRange(newPos, newPos);
      }, 10);
    }
  };

  // Convert raw user short answer input to rendered math format
  const formatShortAnswerPreview = (text: string) => {
    if (!text || !text.trim()) return '';

    let trimmed = text.trim();

    // If already has dollar signs or math tags, render directly
    if (trimmed.includes('$')) return trimmed;

    // Smart conversions for natural high school typing:
    // 1. `1/2` -> `\frac{1}{2}`
    if (/^-?\d+\/\d+$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return `$\\frac{${parts[0]}}{${parts[1]}}$`;
    }

    // 2. `sqrt(x)` -> `\sqrt{x}`
    if (/sqrt\((.*?)\)/i.test(trimmed)) {
      trimmed = trimmed.replace(/sqrt\((.*?)\)/gi, '\\sqrt{$1}');
    }

    // 3. `inf` -> `\infty`
    trimmed = trimmed.replace(/\+?inf\b/gi, '+\\infty').replace(/-inf\b/gi, '-\\infty');

    // 4. `pi` -> `\pi`
    trimmed = trimmed.replace(/\bpi\b/gi, '\\pi');

    // Wrap in inline math
    return `$${trimmed}$`;
  };

  // =========================================================================
  // RENDER COMPACT MODE (Dành cho Phần III: Trả lời ngắn với MathLive)
  // =========================================================================
  if (mode === 'compact') {
    return (
      <MathLiveField
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        label={label}
        className={className}
        mode="short_answer"
      />
    );
  }

  // =========================================================================
  // RENDER FULL MODE (Dành cho Phần III: Trình bày bài giải Tự luận)
  // =========================================================================
  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>{label}</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHelper(!showHelper)}
              className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showHelper ? 'Đóng hướng dẫn' : 'Cách gõ công thức'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MathLive Visual Formula Scratchpad (Soạn công thức trực quan rồi chèn vào bài giải) */}
      {!disabled && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Soạn công thức Toán học MathLive (Hiển thị trực quan WYSIWYG):</span>
            </span>
            <span className="text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 font-semibold">
              Bàn phím ảo tự động
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1">
              <MathLiveField
                value={scratchpadFormula}
                onChange={setScratchpadFormula}
                placeholder="Gõ hoặc chạm để soạn công thức Toán (phân số, căn, tích phân...)..."
                disabled={disabled}
              />
            </div>
            {scratchpadFormula.trim() && (
              <button
                type="button"
                onClick={() => {
                  handleInsert(`$${scratchpadFormula.trim()}$`);
                  setScratchpadFormula('');
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>+ Chèn vào bài giải</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Guide Banner */}
      {showHelper && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-1.5 animate-fadeIn">
          <div className="font-bold flex items-center gap-1.5 text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Hướng dẫn soạn thảo Toán học chuẩn SGK & MathType:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
            <li>
              <b>Văn bản tiếng Việt:</b> Gõ bình thường từng bước lập luận (ví dụ: <i>Điều kiện xác định, Ta có đạo hàm,...</i>).
            </li>
            <li>
              <b>Công thức toán học:</b> Bấm các nút ký hiệu bên dưới hoặc kẹp trong dấu <code>$...$</code> (ví dụ: <code>$x^2 - 4x + 3 = 0$</code> hoặc <code>$\\frac{1}{2}$</code>).
            </li>
            <li>
              <b>Hệ phương trình:</b> Bấm nút <b>{"{ Hệ PT"}</b> ở tab <i>Hệ PT & Logic</i> để chèn khung hệ phương trình chuẩn.
            </li>
          </ul>
        </div>
      )}

      {/* MathType Toolbar */}
      {!disabled && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xs overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 border-b border-slate-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'basic'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              1. Đại số & Phân số
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'analysis'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              2. Giải tích & Hàm số
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('geometry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'geometry'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              3. Hình học & Vectơ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'logic'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              4. Hệ PT & Suy luận
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              5. Mẫu bước giải SGK ✨
            </button>
          </div>

          {/* Symbol Buttons Container */}
          <div className="p-2.5">
            {activeTab === 'basic' && (
              <div className="flex flex-wrap gap-1.5">
                {basicPalette.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsert(item.latex, item.cursorOffset)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-2xs active:scale-95 cursor-pointer font-serif"
                    title={item.tooltip}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="flex flex-wrap gap-1.5">
                {analysisPalette.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsert(item.latex, item.cursorOffset)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-2xs active:scale-95 cursor-pointer font-serif"
                    title={item.tooltip}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'geometry' && (
              <div className="flex flex-wrap gap-1.5">
                {geometryPalette.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsert(item.latex, item.cursorOffset)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-2xs active:scale-95 cursor-pointer font-serif"
                    title={item.tooltip}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'logic' && (
              <div className="flex flex-wrap gap-1.5">
                {logicPalette.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsert(item.latex, item.cursorOffset)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-2xs active:scale-95 cursor-pointer font-serif"
                    title={item.tooltip}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stepTemplates.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsert(item.snippet, 0)}
                    className="text-left px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-900 transition-all shadow-2xs flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded font-mono shrink-0">
                      + Chèn
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor & Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Input Textarea */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="font-bold uppercase tracking-wider text-slate-600">
              Khu vực nhập bài làm:
            </span>
            <div className="flex items-center gap-3">
              <span>{value.length} ký tự</span>
              <span>•</span>
              <span>{value.split(/\n+/).filter(Boolean).length} dòng</span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full p-4 text-sm sm:text-base font-normal leading-relaxed bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400 font-mono shadow-2xs transition-all disabled:bg-slate-100 disabled:text-slate-500 resize-y"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Tự động lưu bài làm thời gian thực</span>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer lg:hidden"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? 'Ẩn xem trước' : 'Bật xem trước bài giải'}</span>
            </button>
          </div>
        </div>

        {/* Right: Live Preview */}
        {showPreview && (
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span className="font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem trước bài giải chuẩn SGK GDPT 2018:</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                Live Math Rendering
              </span>
            </div>

            <div
              style={{ minHeight }}
              className="w-full p-4 rounded-xl border-2 border-indigo-100 bg-white/95 overflow-y-auto shadow-2xs space-y-2"
            >
              {value.trim() ? (
                <div className="prose prose-sm max-w-none text-slate-900 leading-relaxed font-sans">
                  {value.split('\n').map((line, lIdx) => (
                    <div key={lIdx} className="min-h-[1.5rem] py-0.5">
                      {line.trim() ? (
                        <MathRenderer content={line} className="text-sm sm:text-base text-slate-900 font-medium" />
                      ) : (
                        <div className="h-2" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10 space-y-2">
                  <FileText className="w-8 h-8 text-slate-300" />
                  <p className="text-xs">
                    Bài giải sẽ được hiển thị và định dạng công thức toán học chuẩn xác tại đây theo thời gian thực.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
