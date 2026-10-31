import React, { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';

export interface VariationTableProps {
  title?: string;
  type?: 'rational' | 'cubic' | 'quartic' | 'quadratic' | 'sign_table' | 'custom';
  questionText?: string;
  options?: string[];
  customData?: {
    xValues?: string[];
    yPrimeSigns?: string[];
    yValues?: string[];
  };
}

/**
 * Component vẽ đoạn mũi tên có đầu tam giác đặc (arrowhead) sắc nét theo chuẩn SGK GDPT 2018 (Ảnh 2).
 * Tự động tính toán toạ độ mũi tên và vẽ trực tiếp bằng SVG polygon để đảm bảo:
 * - 100% hiển thị rõ ràng, không bị che bởi viền/nền trắng của số
 * - Không phụ thuộc vào marker ID tránh xung đột DOM
 */
interface ArrowSegmentProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth?: number;
  color?: string;
  headSize?: number;
}

const ArrowSegment: React.FC<ArrowSegmentProps> = ({
  x1,
  y1,
  x2,
  y2,
  strokeWidth = 1.8,
  color = '#0f172a',
  headSize = 9,
}) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 6) return null;

  const ux = dx / len;
  const uy = dy / len;
  const vx = -uy;
  const vy = ux;

  const headLen = headSize;
  const headHalfWidth = headSize * 0.42;

  // Điểm đáy của đầu mũi tên
  const bx = x2 - headLen * ux;
  const by = y2 - headLen * uy;

  // Hai cánh của đầu mũi tên
  const w1x = bx + headHalfWidth * vx;
  const w1y = by + headHalfWidth * vy;
  const w2x = bx - headHalfWidth * vx;
  const w2y = by - headHalfWidth * vy;

  return (
    <g>
      {/* Thân mũi tên */}
      <line
        x1={x1}
        y1={y1}
        x2={bx}
        y2={by}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Đầu mũi tên tam giác đặc sắc nét */}
      <polygon
        points={`${x2.toFixed(1)},${y2.toFixed(1)} ${w1x.toFixed(1)},${w1y.toFixed(1)} ${w2x.toFixed(1)},${w2y.toFixed(1)}`}
        fill={color}
      />
    </g>
  );
};

/**
 * Trích xuất các khoảng nghiệm dạng (a; b) từ văn bản
 */
function extractIntervalsFromText(text: string): Array<{ left: number; right: number }> {
  const intervals: Array<{ left: number; right: number }> = [];
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
 * Trích xuất các điểm hoành độ x từ văn bản: x = a, v.v.
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
 * Kiểu dữ liệu bảng biến thiên được trích xuất trực tiếp từ mã nguồn câu hỏi
 */
interface ParsedVariationData {
  xLabel: string;
  yPrimeLabel: string;
  yLabel?: string;
  xValues: string[];
  yPrimeTokens: string[];
  yPoints: Array<{
    value: string;
    level: 'top' | 'bottom' | 'mid';
    xPercent: number;
  }>;
  arrows: Array<{
    startIndex: number;
    endIndex: number;
  }>;
  hasDoubleBar?: boolean;
  doubleBarIndex?: number;
}

/**
 * Trích xuất bảng biến thiên từ \begin{array} hoặc bảng markdown trong questionText.
 * Đảm bảo dữ liệu bảng phía dưới hoàn toàn trùng khớp với đề bài gốc (ví dụ Câu 5: [-2; 3], -1, 5, 2).
 */
function parseVariationTableFromQuestion(text?: string): ParsedVariationData | null {
  if (!text) return null;

  try {
    const match = text.match(/\\*begin\{(?:array|matrix|tabular)\}([\s\S]*?)\\*end\{(?:array|matrix|tabular)\}/i);
    if (!match) return null;

    let content = match[1];
    content = content
      .replace(/\\cr\b/gi, '\\\\')
      .replace(/\\newline\b/gi, '\\\\')
      .replace(/\\hline/gi, '')
      .replace(/\\cline\{[^}]*\}/gi, '')
      .replace(/\\\\\[[^\]]*\]/gi, '\\\\');

    const rawRows = content
      .split(/\\\\/)
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (rawRows.length < 2) return null;

    const rows: string[][] = [];
    for (const rawRow of rawRows) {
      const cells = rawRow.split('&').map(c => c.trim().replace(/\$/g, ''));
      rows.push(cells);
    }

    // 1. Dòng x
    const xRow = rows[0];
    const xLabel = xRow[0] || 'x';
    const xValues: string[] = [];
    for (let i = 1; i < xRow.length; i++) {
      const val = xRow[i].trim();
      if (val) xValues.push(val);
    }
    if (xValues.length < 2) return null;

    // 2. Dòng y' hoặc f'(x)
    const yPrimeRow = rows[1];
    const yPrimeLabel = yPrimeRow[0] || "f'(x)";
    const yPrimeTokens: string[] = [];
    for (let i = 1; i < yPrimeRow.length; i++) {
      const val = yPrimeRow[i].trim();
      if (val) yPrimeTokens.push(val);
    }

    // 3. Dòng y hoặc f(x)
    const yLabel = rows[2] ? rows[2][0] || 'f(x)' : 'y';

    // Gom toàn bộ ô từ row 2 trở đi để phân tích giá trị y và hướng mũi tên
    const yCells: string[] = [];
    for (let r = 2; r < rows.length; r++) {
      const cells = rows[r];
      const startIdx = r === 2 ? 1 : 0;
      for (let c = startIdx; c < cells.length; c++) {
        const val = cells[c].trim();
        if (val) yCells.push(val);
      }
    }

    // Lọc các giá trị số và vô cùng
    const numericTokens: string[] = [];
    for (const cell of yCells) {
      if (
        !/searrow|nearrow|downarrow|uparrow/i.test(cell) &&
        cell !== '+' &&
        cell !== '-' &&
        cell !== '||' &&
        cell !== '|'
      ) {
        numericTokens.push(cell);
      }
    }

    // Nếu tìm thấy đúng số lượng điểm ứng với xValues
    const yPoints: ParsedVariationData['yPoints'] = [];
    const arrows: ParsedVariationData['arrows'] = [];

    if (numericTokens.length === xValues.length) {
      // Phân bổ toạ độ % theo số lượng mốc x
      for (let i = 0; i < numericTokens.length; i++) {
        const val = numericTokens[i];
        const pct = Math.round(((i + 0.5) / numericTokens.length) * 100);
        // Xác định level (top/bottom/mid)
        let level: 'top' | 'bottom' | 'mid' = 'mid';
        const num = parseFloat(val);
        if (val.includes('+\\infty') || val.includes('+infty')) {
          level = 'top';
        } else if (val.includes('-\\infty') || val.includes('-infty')) {
          level = 'bottom';
        } else if (!isNaN(num)) {
          // So sánh tương đối với các giá trị khác
          const nums = numericTokens.map(t => parseFloat(t)).filter(n => !isNaN(n));
          const max = Math.max(...nums);
          const min = Math.min(...nums);
          if (num === max && max !== min) level = 'top';
          else if (num === min && max !== min) level = 'bottom';
          else level = 'mid';
        }

        yPoints.push({
          value: val,
          level,
          xPercent: pct,
        });

        if (i > 0) {
          arrows.push({
            startIndex: i - 1,
            endIndex: i,
          });
        }
      }

      return {
        xLabel,
        yPrimeLabel,
        yLabel,
        xValues,
        yPrimeTokens,
        yPoints,
        arrows,
      };
    }

    return null;
  } catch (e) {
    console.warn('Could not parse variation table from question:', e);
    return null;
  }
}

/**
 * Phân tích hàm bậc 3 từ câu hỏi và 4 phương án
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

  const intervals = extractIntervalsFromText(combined);
  const xPoints = extractXPointsFromText(combined);

  const freq: Record<number, number> = {};
  intervals.forEach(inv => {
    freq[inv.left] = (freq[inv.left] || 0) + 1;
    freq[inv.right] = (freq[inv.right] || 0) + 1;
  });
  xPoints.forEach(p => {
    freq[p] = (freq[p] || 0) + 2;
  });

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

  const isAskingIncreasing = /đồng biến|tăng/i.test(questionText || '');
  const isAskingDecreasing = /nghịch biến|giảm/i.test(questionText || '');

  let aIsPositive = true;
  if (isAskingIncreasing && intervals.some((inv) => inv.left === x1 && inv.right === x2)) {
    aIsPositive = false;
  } else if (isAskingDecreasing && intervals.some((inv) => inv.left === x1 && inv.right === x2)) {
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

  let x0 = 1;
  let y0 = 2;

  const tcdMatch = combined.match(/(?:tiệm cận đứng|tcd|x\s*=|x\s*\\ne|x\s*≠)\s*(-?\d+(?:\.\d+)?)/i);
  if (tcdMatch) {
    x0 = parseFloat(tcdMatch[1]) || 1;
  } else {
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
}) => {
  // 0. Ưu tiên trích xuất chính xác bảng biến thiên từ văn bản câu hỏi nếu có
  const parsedData = useMemo(() => {
    return parseVariationTableFromQuestion(questionText);
  }, [questionText]);

  // =========================================================================
  // TRƯỜNG HỢP 1: BẢNG BIẾN THIÊN TRÍCH XUẤT CHÍNH XÁC TỪ ĐỀ BÀI (VD: CÂU 5)
  // Hiển thị đầy đủ mốc x ([-2, 1, 3]), dấu y' (+, 0, -) và mũi tên y (-1 -> 5 -> 2)
  // Có mũi tên tam giác đặc sắc nét chuẩn SGK GDPT 2018 (Ảnh 2)
  // =========================================================================
  if (parsedData) {
    const { xLabel, yPrimeLabel, yLabel, xValues, yPrimeTokens, yPoints, arrows } = parsedData;

    return (
      <div className="my-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-2xl mx-auto font-sans select-none">
        <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x */}
              <tr className="border-b border-slate-800">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content={`$${xLabel}$`} />
                </td>
                {xValues.map((xv, idx) => (
                  <td key={idx} className="py-2 text-slate-950 font-bold text-sm sm:text-base">
                    <MathRenderer content={`$${xv}$`} />
                  </td>
                ))}
              </tr>

              {/* DÒNG 2: y' hoặc f'(x) */}
              <tr className="border-b border-slate-800 bg-white">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
                  <MathRenderer content={`$${yPrimeLabel}$`} />
                </td>
                {yPrimeTokens.length > 0 ? (
                  yPrimeTokens.map((t, idx) => {
                    const isPlus = t === '+' || t === '$+$';
                    const isMinus = t === '-' || t === '$-$' || t === '−';
                    const isZero = t === '0' || t === '$0$';
                    const isDoubleBar = t === '||' || t === '|';

                    return (
                      <td
                        key={idx}
                        className={`py-2 ${
                          isDoubleBar
                            ? 'border-l-2 border-r-2 border-slate-900 bg-slate-100/60 w-8 p-0'
                            : 'text-slate-900 font-black text-base sm:text-lg'
                        }`}
                      >
                        {isPlus ? '+' : isMinus ? '−' : isZero ? '0' : isDoubleBar ? '' : t}
                      </td>
                    );
                  })
                ) : (
                  <td colSpan={xValues.length} className="py-2 text-slate-800 font-medium">
                    &nbsp;
                  </td>
                )}
              </tr>

              {/* DÒNG 3: y hoặc f(x) với mũi tên chuẩn SGK (Ảnh 2) */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                  <MathRenderer content={`$${yLabel || 'y'}$`} />
                </td>
                <td colSpan={Math.max(xValues.length, yPrimeTokens.length, 1)} className="p-0 align-middle">
                  <div className="relative h-28 sm:h-32 w-full">
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 500 100"
                      preserveAspectRatio="none"
                    >
                      {arrows.map((arr, idx) => {
                        const start = yPoints[arr.startIndex];
                        const end = yPoints[arr.endIndex];
                        if (!start || !end) return null;

                        const x1 = (start.xPercent / 100) * 500;
                        const x2 = (end.xPercent / 100) * 500;
                        const y1 = start.level === 'top' ? 24 : start.level === 'bottom' ? 76 : 50;
                        const y2 = end.level === 'top' ? 24 : end.level === 'bottom' ? 76 : 50;

                        // Chừa khoảng cách nhỏ cho nhãn số để mũi tên không đè chữ
                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const dist = Math.hypot(dx, dy);
                        const offsetStart = 20;
                        const offsetEnd = 20;
                        const sx = x1 + (dx / dist) * offsetStart;
                        const sy = y1 + (dy / dist) * offsetStart;
                        const ex = x2 - (dx / dist) * offsetEnd;
                        const ey = y2 - (dy / dist) * offsetEnd;

                        return (
                          <ArrowSegment
                            key={idx}
                            x1={sx}
                            y1={sy}
                            x2={ex}
                            y2={ey}
                            strokeWidth={1.8}
                            color="#0f172a"
                            headSize={9}
                          />
                        );
                      })}
                    </svg>

                    {/* Các nhãn giá trị y tại mốc toạ độ */}
                    {yPoints.map((pt, idx) => {
                      const isTop = pt.level === 'top';
                      const isBottom = pt.level === 'bottom';
                      return (
                        <div
                          key={idx}
                          className="absolute -translate-x-1/2"
                          style={{
                            left: `${pt.xPercent}%`,
                            top: isTop ? '8px' : !isBottom ? '36px' : undefined,
                            bottom: isBottom ? '8px' : undefined,
                          }}
                        >
                          <span className="font-bold text-slate-950 text-sm sm:text-base select-text">
                            <MathRenderer content={`$${pt.value}$`} />
                          </span>
                        </div>
                      );
                    })}
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
  // TRƯỜNG HỢP 2: BẢNG XÉT DẤU CHUẨN SGK GDPT 2018 (Sign Table)
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
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
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

              {/* DÒNG 2: f'(x) */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 text-base">
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
  // TRƯỜNG HỢP 3: HÀM PHÂN THỨC BẬC NHẤT / BẬC NHẤT VỚI TIỆM CẬN ĐỨNG || (Ảnh 2a & 2b)
  // Có vạch kép song song || và các mũi tên chỉ chiều biến thiên
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
                <td className="w-10 sm:w-12 py-2 text-slate-950 font-black text-base">
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
                {/* Vạch kép song song || xuyên suốt dòng y' */}
                <td className="p-0 border-l-2 border-r-2 border-slate-900 bg-slate-100/60 w-10 sm:w-12"></td>
                <td className="py-2 text-slate-900 font-black text-lg">
                  <MathRenderer content={isIncreasing ? '$+$' : '$-$'} />
                </td>
              </tr>

              {/* DÒNG 3: y (Hai nhánh biến thiên) */}
              <tr className="bg-white">
                <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                  <MathRenderer content="$y$" />
                </td>

                {/* Nhánh 1 (trái điểm gián đoạn) */}
                <td className="p-0 align-middle">
                  <div className="relative h-28 sm:h-32 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 80" preserveAspectRatio="none">
                      {isIncreasing ? (
                        <ArrowSegment x1={30} y1={65} x2={170} y2={18} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      ) : (
                        <ArrowSegment x1={30} y1={18} x2={170} y2={65} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      )}
                    </svg>

                    {isIncreasing ? (
                      <>
                        <div className="absolute left-3 bottom-2">
                          <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$-\infty$" /></span>
                        </div>
                        <div className="absolute right-3 top-2">
                          <span className="font-bold text-slate-950 text-base"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="absolute left-3 top-2">
                          <span className="font-bold text-slate-950 text-base"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                        <div className="absolute right-3 bottom-2">
                          <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$-\infty$" /></span>
                        </div>
                      </>
                    )}
                  </div>
                </td>

                {/* Vạch kép song song || xuyên suốt dòng y */}
                <td className="p-0 border-l-2 border-r-2 border-slate-900 bg-slate-100/60 w-10 sm:w-12"></td>

                {/* Nhánh 2 (phải điểm gián đoạn) */}
                <td className="p-0 align-middle">
                  <div className="relative h-28 sm:h-32 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 80" preserveAspectRatio="none">
                      {isIncreasing ? (
                        <ArrowSegment x1={30} y1={65} x2={170} y2={18} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      ) : (
                        <ArrowSegment x1={30} y1={18} x2={170} y2={65} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      )}
                    </svg>

                    {isIncreasing ? (
                      <>
                        <div className="absolute left-3 bottom-2">
                          <span className="font-bold text-slate-950 text-base"><MathRenderer content={`$${y0}$`} /></span>
                        </div>
                        <div className="absolute right-3 top-2">
                          <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="absolute left-3 top-2">
                          <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span>
                        </div>
                        <div className="absolute right-3 bottom-2">
                          <span className="font-bold text-slate-950 text-base"><MathRenderer content={`$${y0}$`} /></span>
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
  // TRƯỜNG HỢP 4: HÀM BẬC HAI (PARABOL): y = ax^2 + bx + c
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
                  <div className="relative h-28 sm:h-32 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 90" preserveAspectRatio="none">
                      <ArrowSegment x1={40} y1={25} x2={185} y2={74} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      <ArrowSegment x1={215} y1={74} x2={360} y2={25} strokeWidth={1.8} color="#0f172a" headSize={9} />
                    </svg>

                    <div className="absolute left-[6%] top-2">
                      <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span>
                    </div>
                    <div className="absolute left-1/2 bottom-2 -translate-x-1/2">
                      <span className="font-black text-slate-950 text-base">
                        <MathRenderer content="$-3$" />
                      </span>
                    </div>
                    <div className="absolute right-[6%] top-2">
                      <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span>
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
  // TRƯỜNG HỢP 5: HÀM BẬC BỐN TRÙNG PHƯƠNG: y = ax^4 + bx^2 + c
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
                  <div className="relative h-28 sm:h-32 w-full">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 100" preserveAspectRatio="none">
                      <ArrowSegment x1={30} y1={20} x2={110} y2={76} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      <ArrowSegment x1={130} y1={76} x2={240} y2={32} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      <ArrowSegment x1={260} y1={32} x2={370} y2={76} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      <ArrowSegment x1={390} y1={76} x2={470} y2={20} strokeWidth={1.8} color="#0f172a" headSize={9} />
                    </svg>

                    <div className="absolute left-[4%] top-2"><span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span></div>
                    <div className="absolute left-[24%] bottom-2 -translate-x-1/2"><span className="font-bold text-slate-950 text-base"><MathRenderer content="$-2$" /></span></div>
                    <div className="absolute left-1/2 top-4 -translate-x-1/2"><span className="font-bold text-slate-950 text-base"><MathRenderer content="$-1$" /></span></div>
                    <div className="absolute left-[76%] bottom-2 -translate-x-1/2"><span className="font-bold text-slate-950 text-base"><MathRenderer content="$-2$" /></span></div>
                    <div className="absolute right-[4%] top-2"><span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span></div>
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
  // TRƯỜNG HỢP 6: HÀM BẬC BA CHUẨN: y = ax^3 + bx^2 + cx + d
  // ĐỒNG BỘ ĐỘNG SỐ LIỆU VỚI CÂU HỎI VÀ PHƯƠNG ÁN (KHÔNG CỐ ĐỊNH x=0, x=2)
  // Mũi tên có đầu nhọn tam giác đặc sắc nét theo chuẩn SGK GDPT 2018 (Ảnh 2)
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

            {/* DÒNG 3: y (Mũi tên biến thiên chuẩn SGK - Ảnh 2) */}
            <tr className="bg-white">
              <td className="w-16 sm:w-20 py-4 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle text-base">
                <MathRenderer content="$y$" />
              </td>
              <td colSpan={5} className="p-0 align-middle">
                <div className="relative h-28 sm:h-32 w-full">
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 500 100"
                    preserveAspectRatio="none"
                  >
                    {aIsPositive ? (
                      <>
                        {/* Mũi tên 1: -inf lên CĐ */}
                        <ArrowSegment x1={45} y1={76} x2={140} y2={24} strokeWidth={1.8} color="#0f172a" headSize={9} />
                        {/* Mũi tên 2: CĐ xuống CT */}
                        <ArrowSegment x1={170} y1={24} x2={330} y2={76} strokeWidth={1.8} color="#0f172a" headSize={9} />
                        {/* Mũi tên 3: CT lên +inf */}
                        <ArrowSegment x1={360} y1={76} x2={455} y2={24} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      </>
                    ) : (
                      <>
                        {/* Mũi tên 1: +inf xuống CT */}
                        <ArrowSegment x1={45} y1={24} x2={140} y2={76} strokeWidth={1.8} color="#0f172a" headSize={9} />
                        {/* Mũi tên 2: CT lên CĐ */}
                        <ArrowSegment x1={170} y1={76} x2={330} y2={24} strokeWidth={1.8} color="#0f172a" headSize={9} />
                        {/* Mũi tên 3: CĐ xuống -inf */}
                        <ArrowSegment x1={360} y1={24} x2={455} y2={76} strokeWidth={1.8} color="#0f172a" headSize={9} />
                      </>
                    )}
                  </svg>

                  {aIsPositive ? (
                    <>
                      <div className="absolute left-[4%] bottom-2">
                        <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$-\infty$" /></span>
                      </div>
                      <div className="absolute left-[31%] top-2 -translate-x-1/2">
                        <span className="font-bold text-slate-950 text-base">
                          <MathRenderer content={`$${y1}$`} />
                        </span>
                      </div>
                      <div className="absolute left-[69%] bottom-2 -translate-x-1/2">
                        <span className="font-bold text-slate-950 text-base">
                          <MathRenderer content={`$${y2}$`} />
                        </span>
                      </div>
                      <div className="absolute right-[4%] top-2">
                        <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute left-[4%] top-2">
                        <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$+\infty$" /></span>
                      </div>
                      <div className="absolute left-[31%] bottom-2 -translate-x-1/2">
                        <span className="font-bold text-slate-950 text-base">
                          <MathRenderer content={`$${y1}$`} />
                        </span>
                      </div>
                      <div className="absolute left-[69%] top-2 -translate-x-1/2">
                        <span className="font-bold text-slate-950 text-base">
                          <MathRenderer content={`$${y2}$`} />
                        </span>
                      </div>
                      <div className="absolute right-[4%] bottom-2">
                        <span className="font-bold text-slate-900 text-sm"><MathRenderer content="$-\infty$" /></span>
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
