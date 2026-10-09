import React, { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';

export interface FunctionPlotProps {
  type?: 'rational' | 'cubic' | 'quadratic' | 'quartic' | 'oxyz' | 'pyramid' | 'custom';
  title?: string;
  questionText?: string;
  a?: number;
  b?: number;
  c?: number;
  d?: number;
}

/**
 * Phân tích các hệ số hàm số từ chuỗi đề bài hoặc tiêu đề
 */
function parseFunctionCoefficients(text?: string): {
  fnType: 'rational' | 'cubic' | 'quadratic' | 'quartic';
  a: number;
  b: number;
  c: number;
  d: number;
  formulaStr: string;
} {
  const defaultCubic = { fnType: 'cubic' as const, a: 1, b: 0, c: -3, d: 1, formulaStr: 'y = x^3 - 3x + 1' };
  if (!text) return defaultCubic;

  // 1. Kiểm tra hàm phân thức: y = (ax + b) / (cx + d)
  const fracRegex = /y\s*=\s*(?:\\d?frac\s*\{([^}]+)\}\s*\{([^}]+)\}|\(?([^\/\)]+)\)?\s*\/\s*\(?([^\/\)]+)\)?)/i;
  const fracMatch = text.match(fracRegex);
  if (fracMatch) {
    const numStr = fracMatch[1] || fracMatch[3] || '';
    const denStr = fracMatch[2] || fracMatch[4] || '';

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
      return {
        fnType: 'rational',
        a: num.coeff,
        b: num.constant,
        c: den.coeff,
        d: den.constant,
        formulaStr: `y = \\frac{${numStr.trim()}}{${denStr.trim()}}`,
      };
    }
  }

  // 2. Kiểm tra hàm trùng phương: y = ax^4 + bx^2 + c
  const quarticRegex = /y\s*=\s*([+-]?\d*)x\^4\s*([+-]\s*\d*)x\^2(?:\s*([+-]\s*\d+))?/i;
  const quarticMatch = text.match(quarticRegex);
  if (quarticMatch) {
    const a = quarticMatch[1] === '' || quarticMatch[1] === '+' ? 1 : quarticMatch[1] === '-' ? -1 : parseFloat(quarticMatch[1]) || 1;
    const b = quarticMatch[2] ? parseFloat(quarticMatch[2].replace(/\s+/g, '')) || 0 : -2;
    const c = quarticMatch[3] ? parseFloat(quarticMatch[3].replace(/\s+/g, '')) || 0 : 0;
    return { fnType: 'quartic', a, b, c, d: 0, formulaStr: `y = ${a !== 1 ? a : ''}x^4 ${b >= 0 ? '+' : ''}${b}x^2 ${c !== 0 ? (c > 0 ? '+' + c : c) : ''}` };
  }

  // 3. Kiểm tra hàm bậc ba: y = ax^3 + bx^2 + cx + d
  const cubicRegex = /y\s*=\s*([+-]?\d*)x\^3(?:\s*([+-]\s*\d*)x\^2)?(?:\s*([+-]\s*\d*)x)?(?:\s*([+-]\s*\d+))?/i;
  const cubicMatch = text.match(cubicRegex);
  if (cubicMatch) {
    const a = cubicMatch[1] === '' || cubicMatch[1] === '+' ? 1 : cubicMatch[1] === '-' ? -1 : parseFloat(cubicMatch[1]) || 1;
    const b = cubicMatch[2] ? parseFloat(cubicMatch[2].replace(/\s+/g, '')) || 0 : 0;
    const c = cubicMatch[3] ? parseFloat(cubicMatch[3].replace(/\s+/g, '')) || 0 : -3;
    const d = cubicMatch[4] ? parseFloat(cubicMatch[4].replace(/\s+/g, '')) || 0 : 1;
    return { fnType: 'cubic', a, b, c, d, formulaStr: `y = ${a === -1 ? '-' : a !== 1 ? a : ''}x^3 ${b !== 0 ? (b > 0 ? '+' + b : b) + 'x^2 ' : ''}${c !== 0 ? (c > 0 ? '+' + c : c) + 'x ' : ''}${d !== 0 ? (d > 0 ? '+' + d : d) : ''}` };
  }

  // 4. Kiểm tra hàm bậc hai (Parabol): y = ax^2 + bx + c
  const quadRegex = /y\s*=\s*([+-]?\d*)x\^2(?:\s*([+-]\s*\d*)x)?(?:\s*([+-]\s*\d+))?/i;
  const quadMatch = text.match(quadRegex);
  if (quadMatch) {
    const a = quadMatch[1] === '' || quadMatch[1] === '+' ? 1 : quadMatch[1] === '-' ? -1 : parseFloat(quadMatch[1]) || 1;
    const b = quadMatch[2] ? parseFloat(quadMatch[2].replace(/\s+/g, '')) || 0 : -2;
    const c = quadMatch[3] ? parseFloat(quadMatch[3].replace(/\s+/g, '')) || 0 : -1;
    return { fnType: 'quadratic', a, b, c, d: 0, formulaStr: `y = ${a !== 1 ? a : ''}x^2 ${b !== 0 ? (b > 0 ? '+' + b : b) + 'x ' : ''}${c !== 0 ? (c > 0 ? '+' + c : c) : ''}` };
  }

  return defaultCubic;
}

export const FunctionPlot: React.FC<FunctionPlotProps> = ({
  type = 'cubic',
  title,
  questionText,
  a: propA,
  b: propB,
  c: propC,
  d: propD,
}) => {
  // =========================================================================
  // 1. Tọa độ không gian Oxyz
  // =========================================================================
  if (type === 'oxyz') {
    return (
      <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-md mx-auto font-sans text-xs">
        {title && (
          <div className="text-center font-bold text-slate-800 mb-2.5">
            <MathRenderer content={title} />
          </div>
        )}
        <div className="flex justify-center bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <svg width="320" height="260" viewBox="0 0 320 260" className="overflow-visible select-none">
            <defs>
              <pattern id="grid-oxyz-v2" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
              </pattern>
              <marker id="arrow-axis-v2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#1e293b" />
              </marker>
              <marker id="arrow-i-v2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#dc2626" />
              </marker>
              <marker id="arrow-j-v2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#16a34a" />
              </marker>
              <marker id="arrow-k-v2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
            </defs>
            <rect width="320" height="260" fill="url(#grid-oxyz-v2)" rx="10" />

            {/* Trục Oz */}
            <line x1="140" y1="160" x2="140" y2="25" stroke="#1e293b" strokeWidth="1.75" markerEnd="url(#arrow-axis-v2)" />
            <text x="148" y="24" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">z</text>

            {/* Trục Oy */}
            <line x1="140" y1="160" x2="295" y2="160" stroke="#1e293b" strokeWidth="1.75" markerEnd="url(#arrow-axis-v2)" />
            <text x="300" y="164" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">y</text>

            {/* Trục Ox */}
            <line x1="140" y1="160" x2="45" y2="245" stroke="#1e293b" strokeWidth="1.75" markerEnd="url(#arrow-axis-v2)" />
            <text x="32" y="250" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">x</text>

            {/* Trục âm nét đứt */}
            <line x1="140" y1="160" x2="140" y2="210" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="140" y1="160" x2="60" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="140" y1="160" x2="190" y2="115" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

            {/* Gốc O */}
            <text x="124" y="174" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">O</text>

            {/* Vector đơn vị */}
            <line x1="140" y1="160" x2="140" y2="105" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrow-k-v2)" />
            <text x="148" y="125" fontSize="11" fontStyle="italic" fontWeight="bold" fill="#2563eb">k⃗</text>

            <line x1="140" y1="160" x2="195" y2="160" stroke="#16a34a" strokeWidth="2.5" markerEnd="url(#arrow-j-v2)" />
            <text x="180" y="150" fontSize="11" fontStyle="italic" fontWeight="bold" fill="#16a34a">j⃗</text>

            <line x1="140" y1="160" x2="90" y2="205" stroke="#dc2626" strokeWidth="2.5" markerEnd="url(#arrow-i-v2)" />
            <text x="100" y="215" fontSize="11" fontStyle="italic" fontWeight="bold" fill="#dc2626">i⃗</text>

            {/* Điểm M(x0, y0, z0) */}
            <line x1="90" y1="205" x2="185" y2="205" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
            <line x1="235" y1="160" x2="185" y2="205" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
            <line x1="185" y1="205" x2="185" y2="90" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,3" />
            <line x1="140" y1="90" x2="185" y2="90" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

            <circle cx="185" cy="90" r="4" fill="#4f46e5" />
            <text x="195" y="92" fontSize="11" fontWeight="bold" fill="#312e81">M(x₀, y₀, z₀)</text>
          </svg>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500 italic">
          Hệ trục tọa độ Oxyz với các vector đơn vị chuẩn SGK GDPT 2018
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. Hình chóp không gian S.ABCD
  // =========================================================================
  if (type === 'pyramid') {
    return (
      <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-md mx-auto font-sans text-xs">
        {title && (
          <div className="text-center font-bold text-slate-800 mb-2.5">
            <MathRenderer content={title} />
          </div>
        )}
        <div className="flex justify-center bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <svg width="300" height="240" viewBox="0 0 300 240" className="overflow-visible select-none">
            {/* Đáy ABCD */}
            <line x1="60" y1="180" x2="130" y2="150" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="130" y1="150" x2="250" y2="150" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="60" y1="180" x2="180" y2="200" stroke="#1e293b" strokeWidth="1.75" />
            <line x1="180" y1="200" x2="250" y2="150" stroke="#1e293b" strokeWidth="1.75" />

            {/* Đỉnh S và các cạnh bên */}
            <line x1="150" y1="30" x2="130" y2="150" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="150" y1="30" x2="60" y2="180" stroke="#1e293b" strokeWidth="1.75" />
            <line x1="150" y1="30" x2="180" y2="200" stroke="#1e293b" strokeWidth="1.75" />
            <line x1="150" y1="30" x2="250" y2="150" stroke="#1e293b" strokeWidth="1.75" />

            {/* Tên các đỉnh */}
            <text x="146" y="22" fontSize="12" fontWeight="bold" fill="#0f172a">S</text>
            <text x="44" y="186" fontSize="12" fontWeight="bold" fill="#0f172a">A</text>
            <text x="180" y="218" fontSize="12" fontWeight="bold" fill="#0f172a">B</text>
            <text x="256" y="154" fontSize="12" fontWeight="bold" fill="#0f172a">C</text>
            <text x="122" y="145" fontSize="12" fontWeight="bold" fill="#0f172a">D</text>
          </svg>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500 italic">
          Khối chóp S.ABCD (nét liền nhìn thấy, nét đứt bị che)
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. VẼ ĐỒ THỊ HÀM SỐ (Bậc 3, Phân thức, Parabol, Trùng phương)
  // TÍNH TOÁN ĐIỂM TOÁN HỌC THẬT VÀ RENDER TRỤC Oxy CHUẨN SGK!
  // =========================================================================
  const width = 360;
  const height = 300;
  const ox = 180;
  const oy = 150;
  const scale = 28; // 28px tương ứng 1 đơn vị

  // Phân tích hàm số từ props hoặc nội dung câu hỏi
  const parsed = useMemo(() => {
    const res = parseFunctionCoefficients(questionText || title);
    if (propA !== undefined) res.a = propA;
    if (propB !== undefined) res.b = propB;
    if (propC !== undefined) res.c = propC;
    if (propD !== undefined) res.d = propD;
    return res;
  }, [questionText, title, propA, propB, propC, propD]);

  const effectiveType = type === 'rational' || type === 'cubic' || type === 'quadratic' || type === 'quartic'
    ? type
    : parsed.fnType;

  // =========================================================================
  // 3A. ĐỒ THỊ HÀM PHÂN THỨC: y = (ax + b) / (cx + d)
  // =========================================================================
  if (effectiveType === 'rational') {
    const a = parsed.a || 2;
    const b = parsed.b || 1;
    const c = parsed.c || 1;
    const d = parsed.d || -1;

    const tcdVal = c !== 0 ? Math.round((-d / c) * 10) / 10 : 1;
    const tcnVal = c !== 0 ? Math.round((a / c) * 10) / 10 : 2;

    const tcdPixelX = ox + tcdVal * scale;
    const tcnPixelY = oy - tcnVal * scale;

    // Nhánh trái x < tcdVal
    const leftPoints: string[] = [];
    for (let x = -6.5; x <= tcdVal - 0.12; x += 0.04) {
      const denom = c * x + d;
      if (Math.abs(denom) < 0.05) continue;
      const y = (a * x + b) / denom;
      const px = ox + x * scale;
      const py = oy - y * scale;
      if (px >= 10 && px <= width - 10 && py >= 10 && py <= height - 10) {
        leftPoints.push(`${leftPoints.length === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }

    // Nhánh phải x > tcdVal
    const rightPoints: string[] = [];
    for (let x = tcdVal + 0.12; x <= 6.5; x += 0.04) {
      const denom = c * x + d;
      if (Math.abs(denom) < 0.05) continue;
      const y = (a * x + b) / denom;
      const px = ox + x * scale;
      const py = oy - y * scale;
      if (px >= 10 && px <= width - 10 && py >= 10 && py <= height - 10) {
        rightPoints.push(`${rightPoints.length === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }

    return (
      <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-md mx-auto font-sans text-xs select-none">
        <div className="text-center font-bold text-slate-800 mb-2">
          {title || 'Đồ thị hàm phân thức chuẩn SGK Toán GDPT 2018'}
        </div>

        <div className="flex items-center justify-center gap-2 mb-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
            <MathRenderer content={`$y = \\dfrac{${a === 1 ? '' : a === -1 ? '-' : a}x ${b >= 0 ? '+' : ''}${b}}{${c === 1 ? '' : c === -1 ? '-' : c}x ${d >= 0 ? '+' : ''}${d}}$`} />
          </span>
          <span className="text-[11px] text-slate-600 font-medium">
            TCĐ: <b className="text-rose-600 font-mono">x = {tcdVal}</b>, TCN: <b className="text-rose-600 font-mono">y = {tcnVal}</b>
          </span>
        </div>

        <div className="flex justify-center bg-slate-50/90 p-2 rounded-xl border border-slate-200">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
            <defs>
              <pattern id="grid-plot-r" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#grid-plot-r)" rx="8" />

            {/* Trục Ox */}
            <line x1="15" y1={oy} x2={width - 15} y2={oy} stroke="#1e293b" strokeWidth="1.5" />
            <polygon points={`${width - 10},${oy} ${width - 20},${oy - 4} ${width - 20},${oy + 4}`} fill="#1e293b" />
            <text x={width - 14} y={oy - 8} fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">x</text>

            {/* Trục Oy */}
            <line x1={ox} y1={height - 15} x2={ox} y2="15" stroke="#1e293b" strokeWidth="1.5" />
            <polygon points={`${ox},10 ${ox - 4},20 ${ox + 4},20`} fill="#1e293b" />
            <text x={ox + 8} y="18" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">y</text>
            <text x={ox - 14} y={oy + 14} fontSize="11" fontStyle="italic" fontWeight="bold" fill="#0f172a">O</text>

            {/* Tiệm cận đứng: x = tcdVal */}
            <line x1={tcdPixelX} y1="15" x2={tcdPixelX} y2={height - 15} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5,4" />
            <text x={tcdPixelX + 4} y="26" fontSize="10" fontWeight="bold" fill="#dc2626">x = {tcdVal}</text>

            {/* Tiệm cận ngang: y = tcnVal */}
            <line x1="15" y1={tcnPixelY} x2={width - 15} y2={tcnPixelY} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5,4" />
            <text x={width - 55} y={tcnPixelY - 6} fontSize="10" fontWeight="bold" fill="#dc2626">y = {tcnVal}</text>

            {/* Nhánh trái */}
            {leftPoints.length > 0 && <path d={leftPoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />}
            {/* Nhánh phải */}
            {rightPoints.length > 0 && <path d={rightPoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />}

            {/* Tâm đối xứng I(tcdVal, tcnVal) */}
            <circle cx={tcdPixelX} cy={tcnPixelY} r="3.5" fill="#dc2626" />
            <text x={tcdPixelX - 12} y={tcnPixelY - 5} fontSize="10" fontStyle="italic" fontWeight="bold" fill="#dc2626">I</text>
          </svg>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500 italic">
          Đồ thị gồm 2 nhánh Hyperbol nhận giao điểm tiệm cận I({tcdVal}; {tcnVal}) làm tâm đối xứng.
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3B. ĐỒ THỊ HÀM BẬC HAI (PARABOL): y = ax^2 + bx + c
  // =========================================================================
  if (effectiveType === 'quadratic') {
    const a = parsed.a || 1;
    const b = parsed.b || -2;
    const c = parsed.c || -1;

    // Đỉnh Parabol I(-b/2a, -delta/4a)
    const vx = Math.round((-b / (2 * a)) * 10) / 10;
    const vy = Math.round((a * vx * vx + b * vx + c) * 10) / 10;

    const vPixelX = ox + vx * scale;
    const vPixelY = oy - vy * scale;

    const curvePoints: string[] = [];
    for (let x = -5; x <= 5; x += 0.05) {
      const y = a * x * x + b * x + c;
      const px = ox + x * scale;
      const py = oy - y * scale;
      if (px >= 10 && px <= width - 10 && py >= 10 && py <= height - 10) {
        curvePoints.push(`${curvePoints.length === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }

    return (
      <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-md mx-auto font-sans text-xs select-none">
        <div className="text-center font-bold text-slate-800 mb-2">
          {title || 'Đồ thị Parabol chuẩn SGK Toán GDPT 2018'}
        </div>

        <div className="flex items-center justify-center gap-2 mb-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
            <MathRenderer content={`$y = ${a !== 1 ? a : ''}x^2 ${b !== 0 ? (b > 0 ? '+' + b : b) + 'x ' : ''}${c !== 0 ? (c > 0 ? '+' + c : c) : ''}$`} />
          </span>
          <span className="text-[11px] text-slate-600 font-medium">
            Đỉnh: <b className="text-blue-700 font-mono">I({vx}; {vy})</b>
          </span>
        </div>

        <div className="flex justify-center bg-slate-50/90 p-2 rounded-xl border border-slate-200">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
            <defs>
              <pattern id="grid-plot-quad" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#grid-plot-quad)" rx="8" />

            {/* Trục Ox */}
            <line x1="15" y1={oy} x2={width - 15} y2={oy} stroke="#1e293b" strokeWidth="1.5" />
            <polygon points={`${width - 10},${oy} ${width - 20},${oy - 4} ${width - 20},${oy + 4}`} fill="#1e293b" />
            <text x={width - 14} y={oy - 8} fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">x</text>

            {/* Trục Oy */}
            <line x1={ox} y1={height - 15} x2={ox} y2="15" stroke="#1e293b" strokeWidth="1.5" />
            <polygon points={`${ox},10 ${ox - 4},20 ${ox + 4},20`} fill="#1e293b" />
            <text x={ox + 8} y="18" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">y</text>
            <text x={ox - 14} y={oy + 14} fontSize="11" fontStyle="italic" fontWeight="bold" fill="#0f172a">O</text>

            {/* Đường dóng đỉnh I */}
            <line x1={vPixelX} y1={oy} x2={vPixelX} y2={vPixelY} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
            <line x1={ox} y1={vPixelY} x2={vPixelX} y2={vPixelY} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />

            {/* Đồ thị Parabol */}
            {curvePoints.length > 0 && <path d={curvePoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />}

            {/* Đỉnh I */}
            <circle cx={vPixelX} cy={vPixelY} r="4" fill="#dc2626" />
            <text x={vPixelX + 6} y={vPixelY - 6} fontSize="11" fontStyle="italic" fontWeight="bold" fill="#dc2626">I({vx}; {vy})</text>
          </svg>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3C. ĐỒ THỊ HÀM BẬC BA CHUẨN: y = ax^3 + bx^2 + cx + d
  // =========================================================================
  const a = parsed.a || 1;
  const b = parsed.b || 0;
  const c = parsed.c || -3;
  const d = parsed.d || 1;

  // Tính cực trị y' = 3ax^2 + 2bx + c = 0
  const A = 3 * a;
  const B = 2 * b;
  const C = c;
  const delta = B * B - 4 * A * C;
  let extremumList: { x: number; y: number; px: number; py: number; label: string }[] = [];

  if (delta > 0) {
    let r1 = (-B - Math.sqrt(delta)) / (2 * A);
    let r2 = (-B + Math.sqrt(delta)) / (2 * A);
    if (r1 > r2) { const t = r1; r1 = r2; r2 = t; }
    r1 = Math.round(r1 * 10) / 10;
    r2 = Math.round(r2 * 10) / 10;
    const f = (x: number) => a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
    const y1 = Math.round(f(r1) * 10) / 10;
    const y2 = Math.round(f(r2) * 10) / 10;

    extremumList = [
      { x: r1, y: y1, px: ox + r1 * scale, py: oy - y1 * scale, label: a > 0 ? 'CĐ' : 'CT' },
      { x: r2, y: y2, px: ox + r2 * scale, py: oy - y2 * scale, label: a > 0 ? 'CT' : 'CĐ' },
    ];
  }

  // Điểm uốn U(-b/3a, f(-b/3a))
  const ux = Math.round((-b / (3 * a)) * 10) / 10;
  const uy = Math.round((a * Math.pow(ux, 3) + b * Math.pow(ux, 2) + c * ux + d) * 10) / 10;
  const uPixelX = ox + ux * scale;
  const uPixelY = oy - uy * scale;

  // Tính tọa độ đường cong
  const cubicPoints: string[] = [];
  for (let x = -5; x <= 5; x += 0.04) {
    const y = a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
    const px = ox + x * scale;
    const py = oy - y * scale;
    if (px >= 10 && px <= width - 10 && py >= 10 && py <= height - 10) {
      cubicPoints.push(`${cubicPoints.length === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  return (
    <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-md mx-auto font-sans text-xs select-none">
      <div className="text-center font-bold text-slate-800 mb-2">
        {title || 'Đồ thị hàm số bậc ba chuẩn SGK Toán GDPT 2018'}
      </div>

      <div className="flex items-center justify-center gap-2 mb-2 text-xs">
        <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
          <MathRenderer content={`$y = ${a === -1 ? '-' : a !== 1 ? a : ''}x^3 ${b !== 0 ? (b > 0 ? '+' + b : b) + 'x^2 ' : ''}${c !== 0 ? (c > 0 ? '+' + c : c) + 'x ' : ''}${d !== 0 ? (d > 0 ? '+' + d : d) : ''}$`} />
        </span>
        {extremumList.length > 0 && (
          <span className="text-[11px] text-slate-600 font-medium">
            Cực trị: <b className="text-rose-600 font-mono">({extremumList[0].x}; {extremumList[0].y})</b>, <b className="text-blue-600 font-mono">({extremumList[1].x}; {extremumList[1].y})</b>
          </span>
        )}
      </div>

      <div className="flex justify-center bg-slate-50/90 p-2 rounded-xl border border-slate-200">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
          <defs>
            <pattern id="grid-plot-cubic" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid-plot-cubic)" rx="8" />

          {/* Trục Ox */}
          <line x1="15" y1={oy} x2={width - 15} y2={oy} stroke="#1e293b" strokeWidth="1.5" />
          <polygon points={`${width - 10},${oy} ${width - 20},${oy - 4} ${width - 20},${oy + 4}`} fill="#1e293b" />
          <text x={width - 14} y={oy - 8} fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">x</text>

          {/* Trục Oy */}
          <line x1={ox} y1={height - 15} x2={ox} y2="15" stroke="#1e293b" strokeWidth="1.5" />
          <polygon points={`${ox},10 ${ox - 4},20 ${ox + 4},20`} fill="#1e293b" />
          <text x={ox + 8} y="18" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">y</text>
          <text x={ox - 14} y={oy + 14} fontSize="11" fontStyle="italic" fontWeight="bold" fill="#0f172a">O</text>

          {/* Đường dóng các điểm cực trị */}
          {extremumList.map((ext, idx) => (
            <g key={idx}>
              <line x1={ext.px} y1={oy} x2={ext.px} y2={ext.py} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
              <line x1={ox} y1={ext.py} x2={ext.px} y2={ext.py} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
              <circle cx={ext.px} cy={ext.py} r="4" fill={idx === 0 ? '#dc2626' : '#2563eb'} />
              <text x={ext.px + 4} y={ext.py - 6} fontSize="10" fontWeight="bold" fill={idx === 0 ? '#dc2626' : '#2563eb'}>
                ({ext.x}; {ext.y})
              </text>
            </g>
          ))}

          {/* Đường cong hàm bậc 3 */}
          {cubicPoints.length > 0 && <path d={cubicPoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />}

          {/* Điểm uốn U */}
          <circle cx={uPixelX} cy={uPixelY} r="3" fill="#64748b" />
          <text x={uPixelX - 10} y={uPixelY + 12} fontSize="9" fontStyle="italic" fill="#475569">U</text>
        </svg>
      </div>

      <div className="mt-2 text-center text-[11px] text-slate-500 italic">
        Hình vẽ: Đồ thị hàm số bậc ba với các điểm cực trị và điểm uốn chuẩn SGK GDPT 2018.
      </div>
    </div>
  );
};
