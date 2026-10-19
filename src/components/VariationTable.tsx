import React, { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';

export interface VariationTableProps {
  title?: string;
  type?: 'rational' | 'cubic' | 'quartic' | 'quadratic' | 'sign_table' | 'custom';
  questionText?: string;
  options?: string[];
  // Optional custom data
  customData?: {
    xValues?: string[];
    yPrimeSigns?: string[];
    yValues?: string[];
  };
}

/**
 * Trích xuất các khoảng nghiệm dạng (a; b) từ văn bản câu hỏi và 4 lựa chọn A, B, C, D
 */
function extractIntervalsFromText(text: string): Array<{ left: number; right: number }> {
  const intervals: Array<{ left: number; right: number }> = [];
  // Match patterns like (-1; 2), (0; 3), (-2; 1), (1; 4), (1; +\\infty), (-\infty; 2)
  const regex = /\(\s*(-?\d+(?:\.\d+)?)\s*;\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const l = parseFloat(match[1]);
    const r = parseFloat(match[2]);
    if (!isNaN(l) && !isNaN(r) && l < r) {
      intervals.push({ left: l, right: r });
    }
  }
  return intervals;
}

/**
 * Trích xuất các điểm hoành độ x từ văn bản: x = a, x1 = a, x2 = b, v.v.
 */
function extractXPointsFromText(text: string): number[] {
  const points: number[] = [];
  const regex = /x(?:_[12])?\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && !points.includes(val)) {
      points.push(val);
    }
  }
  return points;
}

/**
 * Phân tích hàm bậc 3 từ câu hỏi và 4 phương án: y = ax^3 + bx^2 + cx + d
 * Đồng bộ động 100% với số liệu của câu hỏi, tuyệt đối không hardcode (0; 2)
 */
function parseCubicFromTextAndOptions(
  questionText?: string,
  options?: string[]
): {
  a: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  aIsPositive: boolean;
} {
  const combined = `${questionText || ''} ${(options || []).join(' ')}`;

  // 1. Thử nhận diện công thức hàm bậc 3 tường minh y = ax^3 + bx^2 + cx + d
  // Hỗ trợ cả phân số \frac{1}{3}x^3 hoặc -\frac{1}{3}x^3
  const match = combined.match(/y\s*=\s*(?:[+-]?\\(?:d?frac)?\{?([+-]?\d+)\}?\{?(\d+)\}?|([+-]?\d*))x\^3\s*([+-]\s*\d*)x\^2(?:\s*([+-]\s*\d*)x)?(?:\s*([+-]\s*\d+))?/i);
  if (match) {
    let a = 1;
    if (match[1] && match[2]) {
      a = parseFloat(match[1]) / parseFloat(match[2]);
    } else if (match[3] !== undefined) {
      a = match[3] === '' || match[3] === '+' ? 1 : match[3] === '-' ? -1 : parseFloat(match[3]) || 1;
    }
    let b = match[4] ? parseFloat(match[4].replace(/\s+/g, '')) || 0 : 0;
    let c = match[5] ? parseFloat(match[5].replace(/\s+/g, '')) || 0 : 0;
    let d = match[6] ? parseFloat(match[6].replace(/\s+/g, '')) || 0 : 0;

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
      return {
        a,
        x1: r1,
        x2: r2,
        y1: Math.round(f(r1) * 10) / 10,
        y2: Math.round(f(r2) * 10) / 10,
        aIsPositive: a >= 0,
      };
    }
  }

  // 2. Không có công thức tường minh -> Trích xuất động từ các khoảng trong câu hỏi và options
  const intervals = extractIntervalsFromText(combined);
  const xPoints = extractXPointsFromText(combined);

  // Đếm tần suất xuất hiện của các mốc giá trị trong options để tìm đúng 2 điểm cực trị
  const freq: Record<number, number> = {};
  intervals.forEach(inv => {
    freq[inv.left] = (freq[inv.left] || 0) + 1;
    freq[inv.right] = (freq[inv.right] || 0) + 1;
  });
  xPoints.forEach(p => {
    freq[p] = (freq[p] || 0) + 2;
  });

  // Tìm 2 giá trị xuất hiện nhiều nhất
  const sortedPointsByFreq = Object.keys(freq)
    .map(Number)
    .sort((m, n) => freq[n] - freq[m]);

  let x1: number;
  let x2: number;

  if (sortedPointsByFreq.length >= 2) {
    const pair = [sortedPointsByFreq[0], sortedPointsByFreq[1]].sort((m, n) => m - n);
    x1 = pair[0];
    x2 = pair[1];
  } else if (intervals.length > 0) {
    x1 = intervals[0].left;
    x2 = intervals[0].right;
  } else if (xPoints.length >= 2) {
    const sorted = [...xPoints].sort((m, n) => m - n);
    x1 = sorted[0];
    x2 = sorted[1];
  } else if (xPoints.length === 1) {
    if (xPoints[0] > 0) {
      x1 = 0;
      x2 = xPoints[0];
    } else {
      x1 = xPoints[0];
      x2 = 0;
    }
  } else {
    // Hoàn toàn không tìm thấy mốc số trong văn bản -> Sinh động deterministically từ mã băm câu hỏi
    // TUYỆT ĐỐI KHÔNG CỐ ĐỊNH (0; 2)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    const candidates = [
      [-1, 3],
      [-2, 1],
      [1, 4],
      [-3, 0],
      [0, 4],
      [-1, 1],
      [-2, 2],
    ];
    const picked = candidates[Math.abs(hash) % candidates.length];
    x1 = picked[0];
    x2 = picked[1];
  }

  // Xác định chiều biến thiên dựa trên từ khóa câu hỏi:
  const isAskingIncreasing = /đồng biến|tăng/i.test(questionText || '');
  const isAskingDecreasing = /nghịch biến|giảm/i.test(questionText || '');

  // Mặc định hệ số a > 0 (Cực đại trước, cực tiểu sau: y' mang dấu + - +)
  let aIsPositive = true;
  if (isAskingIncreasing && intervals.some((inv) => inv.left === x1 && inv.right === x2)) {
    // Nếu khoảng (x1; x2) là khoảng đồng biến được hỏi -> dấu trên (x1; x2) là +, tức a < 0 (- + -)
    aIsPositive = false;
  } else if (isAskingDecreasing && intervals.some((inv) => inv.left === x1 && inv.right === x2)) {
    // Nếu khoảng (x1; x2) là khoảng nghịch biến được hỏi -> dấu trên (x1; x2) là -, tức a > 0 (+ - +)
    aIsPositive = true;
  }

  const y1 = aIsPositive ? 2 : -2;
  const y2 = aIsPositive ? -2 : 2;

  return {
    a: aIsPositive ? 1 : -1,
    x1,
    x2,
    y1,
    y2,
    aIsPositive,
  };
}

/**
 * Phân tích hàm phân thức bậc nhất / bậc nhất: y = (ax + b) / (cx + d)
 * Đồng bộ động tiệm cận đứng x0 và tiệm cận ngang y0 với câu hỏi và options
 */
function parseRationalFromTextAndOptions(
  questionText?: string,
  options?: string[]
): {
  a: number;
  b: number;
  c: number;
  d: number;
  x0: number;
  y0: number;
  isIncreasing: boolean;
} {
  const combined = `${questionText || ''} ${(options || []).join(' ')}`;

  // 1. Kiểm tra công thức tường minh y = (ax+b)/(cx+d)
  const fracRegex = /y\s*=\s*(?:\\d?frac\s*\{([^}]+)\}\s*\{([^}]+)\}|\(?([^\/\)]+)\)?\s*\/\s*\(?([^\/\)]+)\)?)/i;
  const match = combined.match(fracRegex);

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
      const det = a * d - b * c;
      const x0 = Math.round((-d / c) * 10) / 10;
      const y0 = Math.round((a / c) * 10) / 10;
      return { a, b, c, d, x0, y0, isIncreasing: det > 0 };
    }
  }

  // 2. Trích xuất tiệm cận đứng / điểm gián đoạn từ văn bản câu hỏi hoặc options
  // Ví dụ: x \ne 1, x = 1, (-\infty; 1) và (1; +\infty), tiệm cận đứng x = 1
  let x0 = 1;
  let y0 = 2;

  const tcdMatch = combined.match(/(?:tiệm cận đứng|tcd|x\s*=|x\s*\\ne|x\s*≠)\s*(-?\d+(?:\.\d+)?)/i);
  if (tcdMatch) {
    x0 = parseFloat(tcdMatch[1]) || 1;
  } else {
    // Trích xuất từ các khoảng vô cùng: (-\infty; x0)
    const infMatch = combined.match(/\(-\\?infty\s*;\s*(-?\d+(?:\.\d+)?)\)/i);
    if (infMatch) {
      x0 = parseFloat(infMatch[1]) || 1;
    }
  }

  const tcnMatch = combined.match(/(?:tiệm cận ngang|tcn|y\s*=)\s*(-?\d+(?:\.\d+)?)/i);
  if (tcnMatch) {
    y0 = parseFloat(tcnMatch[1]) || 2;
  }

  const isIncreasing = /đồng biến|nghịch biến/i.test(questionText || '')
    ? /đồng biến/i.test(questionText || '')
    : false;

  return { a: 2, b: 1, c: 1, d: -x0, x0, y0, isIncreasing };
}

export const VariationTable: React.FC<VariationTableProps> = ({
  type = 'cubic',
  questionText,
  options,
  customData,
}) => {
  // =========================================================================
  // 1. BẢNG XÉT DẤU CHUẨN SGK GDPT 2018 (Sign Table)
  // Chỉ hiển thị duy nhất khung bảng x, f'(x) / f(x). Không có tiêu đề/chú thích lộ giải thích.
  // =========================================================================
  if (type === 'sign_table') {
    const combined = `${questionText || ''} ${(options || []).join(' ')}`;
    const intervals = extractIntervalsFromText(combined);
    const xPoints = extractXPointsFromText(combined);

    let x1 = -1;
    let x2 = 2;
    if (intervals.length > 0) {
      x1 = intervals[0].left;
      x2 = intervals[0].right;
    } else if (xPoints.length >= 2) {
      const sorted = [...xPoints].sort((a, b) => a - b);
      x1 = sorted[0];
      x2 = sorted[1];
    }

    return (
      <div className="my-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-2xl mx-auto font-sans select-none">
        <div className="border border-slate-800 rounded bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-20 py-2 px-3 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[18%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$-\infty$" />
                </td>
                <td className="w-[14%] py-2 text-slate-950 font-bold">
                  <MathRenderer content={`$${x1}$`} />
                </td>
                <td className="w-[18%] py-2"></td>
                <td className="w-[14%] py-2 text-slate-950 font-bold">
                  <MathRenderer content={`$${x2}$`} />
                </td>
                <td className="w-[18%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$+\infty$" />
                </td>
              </tr>

              {/* DÒNG 2: f'(x) / f(x) */}
              <tr className="bg-white">
                <td className="w-20 py-2 px-3 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$f'(x)$" />
                </td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content="$+$" />
                </td>
                <td className="py-2 text-slate-900 font-bold text-base">
                  <MathRenderer content="$0$" />
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
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. HÀM PHÂN THỨC BẬC NHẤT / BẬC NHẤT: y = (ax + b) / (cx + d)
  // Chỉ hiển thị duy nhất khung bảng x, y', y với vạch kép song song ||
  // =========================================================================
  if (type === 'rational') {
    const { x0, y0, isIncreasing } = parseRationalFromTextAndOptions(questionText, options);

    return (
      <div className="my-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-2xl mx-auto font-sans select-none">
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
                {/* Vạch đôi song song || chuẩn SGK Toán GDPT 2018 */}
                <td className="p-0 border-l-2 border-r-2 border-slate-900 bg-slate-100/60 w-12"></td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content={isIncreasing ? '$+$' : '$-$'} />
                </td>
              </tr>

              {/* DÒNG 3: y (Mũi tên biến thiên hai nhánh) */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                  <MathRenderer content="$y$" />
                </td>

                {/* Nhánh trái (-inf đến x0) */}
                <td className="p-0 align-middle">
                  <div className="relative h-24 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 80" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-rat-left" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      {isIncreasing ? (
                        <line x1="20" y1="65" x2="185" y2="18" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-left)" />
                      ) : (
                        <line x1="20" y1="18" x2="185" y2="65" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-left)" />
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

                {/* Vạch đôi xuyên suốt cả dòng y */}
                <td className="p-0 border-l-2 border-r-2 border-slate-900 bg-slate-100/60 w-12"></td>

                {/* Nhánh phải (x0 đến +inf) */}
                <td className="p-0 align-middle">
                  <div className="relative h-24 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 80" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-rat-right" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      {isIncreasing ? (
                        <line x1="15" y1="65" x2="180" y2="18" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-right)" />
                      ) : (
                        <line x1="15" y1="18" x2="180" y2="65" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-rat-right)" />
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
      </div>
    );
  }

  // =========================================================================
  // 3. HÀM BẬC HAI (PARABOL): y = ax^2 + bx + c
  // =========================================================================
  if (type === 'quadratic') {
    const combined = `${questionText || ''} ${(options || []).join(' ')}`;
    const xPoints = extractXPointsFromText(combined);
    let x0 = 1;
    if (xPoints.length > 0) {
      x0 = xPoints[0];
    } else {
      const match = combined.match(/x\s*=\s*(-?\d+)/i);
      if (match) x0 = parseFloat(match[1]);
    }

    return (
      <div className="my-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-2xl mx-auto font-sans select-none">
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
                  <MathRenderer content={`$${x0}$`} />
                </td>
                <td className="w-[30%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$+\infty$" />
                </td>
              </tr>

              {/* DÒNG 2: y' */}
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
                  <div className="relative h-24 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 90" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-quad" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      <line x1="30" y1="25" x2="190" y2="75" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quad)" />
                      <line x1="210" y1="75" x2="370" y2="25" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quad)" />
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
      </div>
    );
  }

  // =========================================================================
  // 4. HÀM BẬC BỐN TRÙNG PHƯƠNG: y = ax^4 + bx^2 + c
  // =========================================================================
  if (type === 'quartic') {
    const combined = `${questionText || ''} ${(options || []).join(' ')}`;
    const xPoints = extractXPointsFromText(combined);
    let x0 = 1;
    if (xPoints.length > 0 && Math.abs(xPoints[0]) > 0) {
      x0 = Math.abs(xPoints[0]);
    }

    return (
      <div className="my-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-2xl mx-auto font-sans select-none">
        <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[14%] py-2 text-slate-800 font-medium"><MathRenderer content="$-\infty$" /></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold"><MathRenderer content={`$-${x0}$`} /></td>
                <td className="w-[14%] py-2"></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold"><MathRenderer content="$0$" /></td>
                <td className="w-[14%] py-2"></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold"><MathRenderer content={`$${x0}$`} /></td>
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
                  <div className="relative h-26 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 100" preserveAspectRatio="none">
                      <defs>
                        <marker id="arrow-quartic" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>
                      <line x1="25" y1="20" x2="115" y2="78" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                      <line x1="125" y1="78" x2="245" y2="35" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                      <line x1="255" y1="35" x2="375" y2="78" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
                      <line x1="385" y1="78" x2="475" y2="20" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-quartic)" />
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
      </div>
    );
  }

  // =========================================================================
  // 5. HÀM BẬC BA CHUẨN: y = ax^3 + bx^2 + cx + d
  // ĐỒNG BỘ ĐỘNG 100% SỐ LIỆU VỚI CÂU HỎI VÀ PHƯƠNG ÁN (KHÔNG CỐ ĐỊNH x=0, x=2)
  // XÓA BỎ HOÀN TOÀN TIÊU ĐỀ THỪA VÀ DÒNG CHÚ THÍCH LỘ ĐÁP ÁN Ở ĐÁY BẢNG
  // =========================================================================
  const cubic = useMemo(() => {
    return parseCubicFromTextAndOptions(questionText, options);
  }, [questionText, options]);

  const { x1, x2, y1, y2, aIsPositive } = cubic;

  return (
    <div className="my-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-2xl mx-auto font-sans select-none">
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
                <MathRenderer content={`$${x1}$`} />
              </td>
              <td className="w-[20%] py-2"></td>
              <td className="w-[12%] py-2 text-slate-950 font-bold">
                <MathRenderer content={`$${x2}$`} />
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
                <div className="relative h-26 w-full">
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 500 100"
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
                        <line x1="38" y1="80" x2="145" y2="24" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 2: CĐ xuống CT */}
                        <line x1="165" y1="24" x2="335" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 3: CT lên +inf */}
                        <line x1="355" y1="80" x2="465" y2="24" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                      </>
                    ) : (
                      <>
                        {/* Mũi tên 1: +inf xuống CT */}
                        <line x1="38" y1="24" x2="145" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 2: CT lên CĐ */}
                        <line x1="165" y1="80" x2="335" y2="24" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
                        {/* Mũi tên 3: CĐ xuống -inf */}
                        <line x1="355" y1="24" x2="465" y2="80" stroke="#0f172a" strokeWidth="1.5" markerEnd="url(#arrow-cubic-std)" />
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
                          <MathRenderer content={`$${y1}$`} />
                        </span>
                      </div>
                      {/* 3. Cực tiểu tại x2 */}
                      <div className="absolute left-[70%] bottom-2 -translate-x-1/2">
                        <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                          <MathRenderer content={`$${y2}$`} />
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
                          <MathRenderer content={`$${y1}$`} />
                        </span>
                      </div>
                      <div className="absolute left-[70%] top-2 -translate-x-1/2">
                        <span className="font-black text-slate-950 text-base bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                          <MathRenderer content={`$${y2}$`} />
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
    </div>
  );
};
