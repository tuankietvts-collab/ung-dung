import React, { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';

export interface VariationTableProps {
  title?: string;
  type?: 'rational' | 'cubic' | 'quartic' | 'quadratic' | 'sign_table' | 'custom';
  questionText?: string;
  // Optional custom data
  customData?: {
    xValues?: string[];
    yPrimeSigns?: string[];
    yValues?: string[];
  };
}

/**
 * Phân tích hàm bậc 3 từ câu hỏi: y = ax^3 + bx^2 + cx + d
 */
function parseCubicFromText(text?: string): { a: number; b: number; c: number; d: number; x1: number; x2: number; y1: number; y2: number } {
  const defaultVals = { a: 1, b: -3, c: 0, d: 2, x1: 0, x2: 2, y1: 2, y2: -2 };
  if (!text) return defaultVals;

  // Ví dụ: y = x^3 - 3x^2 + 2, y = -x^3 + 3x, y = 2x^3 - 6x + 1
  const match = text.match(/y\s*=\s*([+-]?\d*)x\^3\s*([+-]\s*\d*)x\^2(?:\s*([+-]\s*\d*)x)?(?:\s*([+-]\s*\d+))?/i);
  if (match) {
    let a = match[1] === '' || match[1] === '+' ? 1 : match[1] === '-' ? -1 : parseFloat(match[1]) || 1;
    let b = match[2] ? parseFloat(match[2].replace(/\s+/g, '')) || 0 : 0;
    let c = match[3] ? parseFloat(match[3].replace(/\s+/g, '')) || 0 : 0;
    let d = match[4] ? parseFloat(match[4].replace(/\s+/g, '')) || 0 : 0;

    // y' = 3ax^2 + 2bx + c = 0
    const A = 3 * a;
    const B = 2 * b;
    const C = c;
    const delta = B * B - 4 * A * C;
    if (delta > 0) {
      let r1 = (-B - Math.sqrt(delta)) / (2 * A);
      let r2 = (-B + Math.sqrt(delta)) / (2 * A);
      if (r1 > r2) { const t = r1; r1 = r2; r2 = t; }
      r1 = Math.round(r1 * 10) / 10;
      r2 = Math.round(r2 * 10) / 10;
      const f = (x: number) => a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
      return { a, b, c, d, x1: r1, x2: r2, y1: Math.round(f(r1) * 10) / 10, y2: Math.round(f(r2) * 10) / 10 };
    }
  }
  return defaultVals;
}

/**
 * Phân tích hàm phân thức bậc 1 / bậc 1: y = (ax + b) / (cx + d)
 */
function parseRationalFromText(text?: string): { a: number; b: number; c: number; d: number; isIncreasing: boolean } {
  const defaultVals = { a: 2, b: 1, c: 1, d: -1, isIncreasing: false };
  if (!text) return defaultVals;

  const fracRegex = /y\s*=\s*(?:\\d?frac\s*\{([^}]+)\}\s*\{([^}]+)\}|\(?([^\/\)]+)\)?\s*\/\s*\(?([^\/\)]+)\)?)/i;
  const match = text.match(fracRegex);

  if (match) {
    const numStr = match[1] || match[3] || '';
    const denStr = match[2] || match[4] || '';

    const parseLinear = (str: string) => {
      const s = str.replace(/[{}\s]/g, '');
      const xMatch = s.match(/([+-]?\d*)x/);
      let coeff = 1;
      if (xMatch) {
        if (xMatch[1] === '' || xMatch[1] === '+') coeff = 1;
        else if (xMatch[1] === '-') coeff = -1;
        else coeff = parseFloat(xMatch[1]) || 1;
      }
      const constMatch = s.replace(/([+-]?\d*)x/, '').match(/[+-]?\d+/);
      const constant = constMatch ? parseFloat(constMatch[0]) : 0;
      return { coeff, constant };
    };

    const num = parseLinear(numStr);
    const den = parseLinear(denStr);

    if (den.coeff !== 0) {
      const a = num.coeff;
      const b = num.constant;
      const c = den.coeff;
      const d = den.constant;
      // y' = (ad - bc) / (cx + d)^2
      const det = a * d - b * c;
      return { a, b, c, d, isIncreasing: det > 0 };
    }
  }
  return defaultVals;
}

export const VariationTable: React.FC<VariationTableProps> = ({
  title,
  type = 'cubic',
  questionText,
  customData,
}) => {
  // =========================================================================
  // 1. BẢNG XÉT DẤU CHUẨN SÁCH GIÁO KHOA TOÁN GDPT 2018 (Sign Table)
  // Chỉ gồm 2 dòng: dòng x và dòng dấu của f'(x) hoặc f(x)
  // =========================================================================
  if (type === 'sign_table') {
    return (
      <div className="my-4 p-4 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
        <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span>{title || 'Bảng xét dấu chuẩn SGK GDPT 2018'}</span>
        </div>

        <div className="border border-slate-800 rounded bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-20 py-2.5 px-3 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[18%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$-\infty$" />
                </td>
                <td className="w-[14%] py-2 text-slate-950 font-bold">
                  <MathRenderer content="$-1$" />
                </td>
                <td className="w-[18%] py-2"></td>
                <td className="w-[14%] py-2 text-slate-950 font-bold">
                  <MathRenderer content="$2$" />
                </td>
                <td className="w-[18%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$+\infty$" />
                </td>
              </tr>

              {/* DÒNG 2: f'(x) / f(x) */}
              <tr className="bg-white">
                <td className="w-20 py-2.5 px-3 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$f'(x)$" />
                </td>
                <td className="py-2.5 text-slate-900 font-black text-lg">
                  <MathRenderer content="$+$" />
                </td>
                <td className="py-2.5 text-slate-900 font-bold text-base">
                  <MathRenderer content="$0$" />
                </td>
                <td className="py-2.5 text-slate-900 font-black text-lg">
                  <MathRenderer content="$-$" />
                </td>
                <td className="py-2.5 text-slate-900 font-bold text-base">
                  <MathRenderer content="$0$" />
                </td>
                <td className="py-2.5 text-slate-900 font-black text-lg">
                  <MathRenderer content="$+$" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-center text-xs text-slate-600 italic">
          Bảng xét dấu: Thể hiện dấu của đạo hàm <MathRenderer content="$f'(x)$" /> trên các khoảng xác định.
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. HÀM PHÂN THỨC BẬC NHẤT / BẬC NHẤT: y = (ax + b) / (cx + d)
  // Có vạch đôi kẻ song song || xuyên suốt cả dòng y' và dòng y chuẩn SGK
  // =========================================================================
  if (type === 'rational') {
    const { a, b, c, d, isIncreasing } = parseRationalFromText(questionText || title);
    const x0 = c !== 0 ? Math.round((-d / c) * 10) / 10 : 1;
    const y0 = c !== 0 ? Math.round((a / c) * 10) / 10 : 2;

    return (
      <div className="my-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
        <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
          <span>{title || 'Bảng biến thiên hàm phân thức chuẩn SGK Toán GDPT 2018'}</span>
        </div>

        <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[42%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$-\infty$" />
                </td>
                {/* Cột điểm gián đoạn x = x0 */}
                <td className="w-12 py-2 text-slate-950 font-black text-sm">
                  <MathRenderer content={`$${x0}$`} />
                </td>
                <td className="w-[42%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$+\infty$" />
                </td>
              </tr>

              {/* DÒNG 2: y' */}
              <tr className="border-b border-slate-800 bg-white">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$y'$" />
                </td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content={isIncreasing ? '$+$' : '$-$'} />
                </td>
                {/* Vạch kẻ đôi song song || chuẩn SGK */}
                <td className="py-0 px-0 w-12 align-middle">
                  <div className="flex items-center justify-center gap-1.5 h-8">
                    <span className="w-[1.5px] h-full bg-slate-900 inline-block" />
                    <span className="w-[1.5px] h-full bg-slate-900 inline-block" />
                  </div>
                </td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content={isIncreasing ? '$+$' : '$-$'} />
                </td>
              </tr>

              {/* DÒNG 3: y */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                  <MathRenderer content="$y$" />
                </td>

                {/* Nhánh trái (-inf; x0) */}
                <td className="p-0 align-middle">
                  <div className="relative h-28 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 100" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-rat-l" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      {isIncreasing ? (
                        <line x1="25" y1="80" x2="175" y2="25" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-l)" />
                      ) : (
                        <line x1="25" y1="25" x2="175" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-l)" />
                      )}
                    </svg>

                    {/* Nhãn nhánh trái */}
                    {isIncreasing ? (
                      <>
                        <div className="absolute left-2.5 bottom-1.5">
                          <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$-\infty$" /></span>
                        </div>
                        <div className="absolute right-2.5 top-1.5">
                          <span className="font-black text-slate-950 text-sm bg-white/90 px-1 rounded"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="absolute left-2.5 top-1.5">
                          <span className="font-black text-slate-950 text-sm bg-white/90 px-1 rounded"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                        <div className="absolute right-2.5 bottom-1.5">
                          <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$-\infty$" /></span>
                        </div>
                      </>
                    )}
                  </div>
                </td>

                {/* Vạch kẻ đôi song song || xuyên suốt dòng y */}
                <td className="w-12 p-0 align-middle">
                  <div className="flex items-center justify-center gap-1.5 h-28">
                    <span className="w-[1.5px] h-full bg-slate-900 inline-block" />
                    <span className="w-[1.5px] h-full bg-slate-900 inline-block" />
                  </div>
                </td>

                {/* Nhánh phải (x0; +inf) */}
                <td className="p-0 align-middle">
                  <div className="relative h-28 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 100" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-rat-r" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      {isIncreasing ? (
                        <line x1="25" y1="80" x2="175" y2="25" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-r)" />
                      ) : (
                        <line x1="25" y1="25" x2="175" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-r)" />
                      )}
                    </svg>

                    {/* Nhãn nhánh phải */}
                    {isIncreasing ? (
                      <>
                        <div className="absolute left-2.5 bottom-1.5">
                          <span className="font-black text-slate-950 text-sm bg-white/90 px-1 rounded"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                        <div className="absolute right-2.5 top-1.5">
                          <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="absolute left-2.5 top-1.5">
                          <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span>
                        </div>
                        <div className="absolute right-2.5 bottom-1.5">
                          <span className="font-black text-slate-950 text-sm bg-white/90 px-1 rounded"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-center text-xs text-slate-600 italic">
          Hàm số có TCĐ <MathRenderer content={`$x = ${x0}$`} /> và TCN <MathRenderer content={`$y = ${y0}$`} />.
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. HÀM BẬC HAI (PARABOL): y = ax^2 + bx + c
  // =========================================================================
  if (type === 'quadratic') {
    return (
      <div className="my-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
        <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          <span>{title || 'Bảng biến thiên hàm số bậc hai (Parabol) chuẩn SGK'}</span>
        </div>

        <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[30%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$-\infty$" />
                </td>
                <td className="w-[30%] py-2 text-slate-950 font-bold">
                  <MathRenderer content="$1$" />
                </td>
                <td className="w-[30%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$+\infty$" />
                </td>
              </tr>

              {/* DÒNG 2: y' (hoặc dấu biến thiên) */}
              <tr className="border-b border-slate-800 bg-white">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$y'$" />
                </td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content="$-$" />
                </td>
                <td className="py-2 text-slate-900 font-bold text-base">
                  <MathRenderer content="$0$" />
                </td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content="$+$" />
                </td>
              </tr>

              {/* DÒNG 3: y */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                  <MathRenderer content="$y$" />
                </td>
                <td colSpan={3} className="p-0 align-middle">
                  <div className="relative h-28 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 100" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-quad" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      {/* Nhánh trái đi xuống đỉnh */}
                      <line x1="30" y1="25" x2="190" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quad)" />
                      {/* Nhánh phải đi lên từ đỉnh */}
                      <line x1="210" y1="80" x2="370" y2="25" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quad)" />
                    </svg>

                    <div className="absolute left-[5%] top-2">
                      <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span>
                    </div>
                    <div className="absolute left-1/2 bottom-1.5 -translate-x-1/2">
                      <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                        <MathRenderer content="$-3$" />
                      </span>
                    </div>
                    <div className="absolute right-[5%] top-2">
                      <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-center text-xs text-slate-600 italic">
          Đỉnh Parabol <MathRenderer content="$I(1; -3)$" /> là điểm cực tiểu của hàm số.
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. HÀM BẬC BỐN TRÙNG PHƯƠNG: y = ax^4 + bx^2 + c
  // =========================================================================
  if (type === 'quartic') {
    return (
      <div className="my-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
        <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block"></span>
          <span>{title || 'Bảng biến thiên hàm trùng phương chuẩn SGK GDPT 2018'}</span>
        </div>

        <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[14%] py-2 text-slate-800 font-medium"><MathRenderer content="$-\infty$" /></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold"><MathRenderer content="$-1$" /></td>
                <td className="w-[14%] py-2"></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold"><MathRenderer content="$0$" /></td>
                <td className="w-[14%] py-2"></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold"><MathRenderer content="$1$" /></td>
                <td className="w-[14%] py-2 text-slate-800 font-medium"><MathRenderer content="$+\infty$" /></td>
              </tr>

              {/* DÒNG 2: y' */}
              <tr className="border-b border-slate-800 bg-white">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$y'$" />
                </td>
                <td className="py-2 text-slate-900 font-black text-lg"><MathRenderer content="$-$" /></td>
                <td className="py-2 text-slate-900 font-bold"><MathRenderer content="$0$" /></td>
                <td className="py-2 text-slate-900 font-black text-lg"><MathRenderer content="$+$" /></td>
                <td className="py-2 text-slate-900 font-bold"><MathRenderer content="$0$" /></td>
                <td className="py-2 text-slate-900 font-black text-lg"><MathRenderer content="$-$" /></td>
                <td className="py-2 text-slate-900 font-bold"><MathRenderer content="$0$" /></td>
                <td className="py-2 text-slate-900 font-black text-lg"><MathRenderer content="$+$" /></td>
              </tr>

              {/* DÒNG 3: y (Dạng chữ W) */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                  <MathRenderer content="$y$" />
                </td>
                <td colSpan={7} className="p-0 align-middle">
                  <div className="relative h-28 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 100" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-quartic" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      {/* Nhánh 1: Từ +inf xuống CT=-2 tại x=-1 */}
                      <line x1="25" y1="20" x2="115" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                      {/* Nhánh 2: Từ CT=-2 lên CĐ=-1 tại x=0 */}
                      <line x1="125" y1="80" x2="245" y2="35" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                      {/* Nhánh 3: Từ CĐ=-1 xuống CT=-2 tại x=1 */}
                      <line x1="255" y1="35" x2="375" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                      {/* Nhánh 4: Từ CT=-2 lên +inf */}
                      <line x1="385" y1="80" x2="475" y2="20" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                    </svg>

                    <div className="absolute left-[3%] top-1.5"><span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span></div>
                    <div className="absolute left-[24%] bottom-1.5 -translate-x-1/2"><span className="font-black text-slate-950 text-sm bg-white px-1 rounded shadow-2xs"><MathRenderer content="$-2$" /></span></div>
                    <div className="absolute left-1/2 top-4 -translate-x-1/2"><span className="font-black text-slate-950 text-sm bg-white px-1 rounded shadow-2xs"><MathRenderer content="$-1$" /></span></div>
                    <div className="absolute left-[76%] bottom-1.5 -translate-x-1/2"><span className="font-black text-slate-950 text-sm bg-white px-1 rounded shadow-2xs"><MathRenderer content="$-2$" /></span></div>
                    <div className="absolute right-[3%] top-1.5"><span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-center text-xs text-slate-600 italic">
          Hàm số đạt cực đại tại <MathRenderer content="$x = 0$" /> và đạt 2 cực tiểu tại <MathRenderer content="$x = \pm 1$" />.
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. HÀM BẬC BA CHUẨN: y = ax^3 + bx^2 + cx + d
  // Tự động điều chỉnh theo a > 0 hay a < 0 và các nghiệm cực trị x1, x2
  // =========================================================================
  const cubic = parseCubicFromText(questionText || title);
  const aIsPositive = cubic.a >= 0;

  return (
    <div className="my-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
      <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
        <span>{title || 'Bảng biến thiên hàm số bậc ba chuẩn SGK Toán GDPT 2018'}</span>
      </div>

      <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
        <table className="w-full text-center border-collapse text-sm">
          <tbody>
            {/* DÒNG 1: x */}
            <tr className="border-b border-slate-800">
              <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                <MathRenderer content="$x$" />
              </td>
              <td className="w-[18%] py-2 text-slate-800 font-medium">
                <MathRenderer content="$-\infty$" />
              </td>
              <td className="w-[12%] py-2 text-slate-950 font-bold">
                <MathRenderer content={`$${cubic.x1}$`} />
              </td>
              <td className="w-[20%] py-2"></td>
              <td className="w-[12%] py-2 text-slate-950 font-bold">
                <MathRenderer content={`$${cubic.x2}$`} />
              </td>
              <td className="w-[18%] py-2 text-slate-800 font-medium">
                <MathRenderer content="$+\infty$" />
              </td>
            </tr>

            {/* DÒNG 2: y' */}
            <tr className="border-b border-slate-800 bg-white">
              <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                <MathRenderer content="$y'$" />
              </td>
              <td className="py-2 text-slate-900 font-black text-lg">
                <MathRenderer content={aIsPositive ? '$+$' : '$-$'} />
              </td>
              <td className="py-2 text-slate-900 font-bold text-base">
                <MathRenderer content="$0$" />
              </td>
              <td className="py-2 text-slate-900 font-black text-lg">
                <MathRenderer content={aIsPositive ? '$-$' : '$+$'} />
              </td>
              <td className="py-2 text-slate-900 font-bold text-base">
                <MathRenderer content="$0$" />
              </td>
              <td className="py-2 text-slate-900 font-black text-lg">
                <MathRenderer content={aIsPositive ? '$+$' : '$-$'} />
              </td>
            </tr>

            {/* DÒNG 3: y */}
            <tr className="bg-white">
              <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                <MathRenderer content="$y$" />
              </td>
              <td colSpan={5} className="p-0 align-middle">
                <div className="relative h-28 w-full">
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 500 110"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker id="arrow-cubic-std" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                      </marker>
                    </defs>

                    {aIsPositive ? (
                      <>
                        {/* Mũi tên 1: -inf lên CĐ */}
                        <line x1="38" y1="88" x2="145" y2="24" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 2: CĐ xuống CT */}
                        <line x1="165" y1="24" x2="335" y2="88" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 3: CT lên +inf */}
                        <line x1="355" y1="88" x2="465" y2="24" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                      </>
                    ) : (
                      <>
                        {/* Mũi tên 1: +inf xuống CT */}
                        <line x1="38" y1="24" x2="145" y2="88" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 2: CT lên CĐ */}
                        <line x1="165" y1="88" x2="335" y2="24" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 3: CĐ xuống -inf */}
                        <line x1="355" y1="24" x2="465" y2="88" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                      </>
                    )}
                  </svg>

                  {aIsPositive ? (
                    <>
                      {/* 1. Mép dưới -inf */}
                      <div className="absolute left-[3%] bottom-2">
                        <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$-\infty$" /></span>
                      </div>
                      {/* 2. Cực đại tại x1 */}
                      <div className="absolute left-[30%] top-2 -translate-x-1/2">
                        <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                          <MathRenderer content={`$${cubic.y1}$`} />
                        </span>
                      </div>
                      {/* 3. Cực tiểu tại x2 */}
                      <div className="absolute left-[70%] bottom-2 -translate-x-1/2">
                        <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                          <MathRenderer content={`$${cubic.y2}$`} />
                        </span>
                      </div>
                      {/* 4. Mép trên +inf */}
                      <div className="absolute right-[3%] top-2">
                        <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute left-[3%] top-2">
                        <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$+\infty$" /></span>
                      </div>
                      <div className="absolute left-[30%] bottom-2 -translate-x-1/2">
                        <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                          <MathRenderer content={`$${cubic.y1}$`} />
                        </span>
                      </div>
                      <div className="absolute left-[70%] top-2 -translate-x-1/2">
                        <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                          <MathRenderer content={`$${cubic.y2}$`} />
                        </span>
                      </div>
                      <div className="absolute right-[3%] bottom-2">
                        <span className="font-bold text-slate-800 text-sm bg-white/90 px-1 rounded"><MathRenderer content="$-\infty$" /></span>
                      </div>
                    </>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-center text-xs text-slate-600 italic">
        Hàm số đạt cực trị tại các điểm <MathRenderer content={`$x_1 = ${cubic.x1}$`} /> và <MathRenderer content={`$x_2 = ${cubic.x2}$`} />.
      </div>
    </div>
  );
};
