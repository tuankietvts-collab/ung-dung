import React, { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';

interface FunctionPlotProps {
  type?: 'rational' | 'cubic' | 'oxyz' | 'pyramid';
  title?: string;
  questionText?: string;
  // Explicit parameters if provided
  a?: number;
  b?: number;
  c?: number;
  d?: number;
}

/**
 * Parses coefficients a, b, c, d for rational function y = (ax + b) / (cx + d)
 * from LaTeX or standard text format:
 * Examples:
 *  - y = \frac{2x - 1}{x + 1} => a=2, b=-1, c=1, d=1
 *  - y = \dfrac{2x + 1}{x - 1} => a=2, b=1, c=1, d=-1
 *  - y = \frac{x - 2}{x + 1} => a=1, b=-2, c=1, d=1
 *  - y = (2x+3)/(x-2) => a=2, b=3, c=1, d=-2
 */
function parseRationalCoefficients(text?: string): { a: number; b: number; c: number; d: number } {
  const defaultVals = { a: 2, b: 1, c: 1, d: -1 };
  if (!text) return defaultVals;

  // Regex for fractions like \frac{...}{...} or \dfrac{...}{...}
  const fracRegex = /y\s*=\s*(?:\\d?frac\s*\{([^}]+)\}\s*\{([^}]+)\}|\(?([^\/\)]+)\)?\s*\/\s*\(?([^\/\)]+)\)?)/i;
  const match = text.match(fracRegex);

  if (match) {
    const numStr = match[1] || match[3] || '';
    const denStr = match[2] || match[4] || '';

    const parseLinear = (str: string): { coeff: number; constant: number } => {
      // Clean up whitespace and brackets
      const s = str.replace(/[{}\s]/g, '');
      // Match coeff * x
      const xMatch = s.match(/([+-]?\d*)x/);
      let coeff = 1;
      if (xMatch) {
        if (xMatch[1] === '' || xMatch[1] === '+') coeff = 1;
        else if (xMatch[1] === '-') coeff = -1;
        else coeff = parseFloat(xMatch[1]) || 1;
      }

      // Match constant term
      const constMatch = s.replace(/([+-]?\d*)x/, '').match(/[+-]?\d+/);
      const constant = constMatch ? parseFloat(constMatch[0]) : 0;

      return { coeff, constant };
    };

    const num = parseLinear(numStr);
    const den = parseLinear(denStr);

    if (den.coeff !== 0) {
      return {
        a: num.coeff,
        b: num.constant,
        c: den.coeff,
        d: den.constant,
      };
    }
  }

  return defaultVals;
}

export const FunctionPlot: React.FC<FunctionPlotProps> = ({
  type = 'rational',
  title,
  questionText,
  a: propA,
  b: propB,
  c: propC,
  d: propD,
}) => {
  // Dynamically extract coefficients from question text if not provided as props
  const parsed = useMemo(() => {
    if (propA !== undefined && propC !== undefined) {
      return { a: propA, b: propB ?? 0, c: propC, d: propD ?? 0 };
    }
    return parseRationalCoefficients(questionText || title);
  }, [questionText, title, propA, propB, propC, propD]);

  const { a, b, c, d } = parsed;

  // Tiệm cận đứng: x = -d / c
  // Tiệm cận ngang: y = a / c
  const tcdVal = c !== 0 ? -d / c : 1;
  const tcnVal = c !== 0 ? a / c : 2;

  // Viewbox Dimensions
  const width = 360;
  const height = 300;

  // Dynamic origin calculation to center asymptotes nicely
  // If tcdVal is around 1 and tcnVal around 2, we position O slightly shifted so the hyperbola is balanced
  const scale = 28; // 28px per unit
  const ox = Math.max(80, Math.min(280, width / 2 - (tcdVal * scale) / 2));
  const oy = Math.max(80, Math.min(220, height / 2 + (tcnVal * scale) / 2));

  const tcdPixelX = ox + tcdVal * scale;
  const tcnPixelY = oy - tcnVal * scale;

  // Generate mathematically exact hyperbola branches (left and right of x = -d/c)
  const { rationalLeftBranch, rationalRightBranch } = useMemo(() => {
    // Left branch: x < tcdVal
    const leftPoints: string[] = [];
    const minX = -7;
    const maxLeftX = tcdVal - 0.12;

    for (let x = minX; x <= maxLeftX; x += 0.05) {
      const denom = c * x + d;
      if (Math.abs(denom) < 0.05) continue;
      const y = (a * x + b) / denom;
      const px = ox + x * scale;
      const py = oy - y * scale;
      if (px >= 10 && px <= width - 10 && py >= 10 && py <= height - 10) {
        leftPoints.push(`${leftPoints.length === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }

    // Right branch: x > tcdVal
    const rightPoints: string[] = [];
    const minRightX = tcdVal + 0.12;
    const maxX = 7;

    for (let x = minRightX; x <= maxX; x += 0.05) {
      const denom = c * x + d;
      if (Math.abs(denom) < 0.05) continue;
      const y = (a * x + b) / denom;
      const px = ox + x * scale;
      const py = oy - y * scale;
      if (px >= 10 && px <= width - 10 && py >= 10 && py <= height - 10) {
        rightPoints.push(`${rightPoints.length === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }

    return {
      rationalLeftBranch: leftPoints.join(' '),
      rationalRightBranch: rightPoints.join(' '),
    };
  }, [a, b, c, d, tcdVal, ox, oy, scale]);

  // Points of intersection with axes
  // With Oy: x = 0 => y = b / d
  const hasOyIntercept = d !== 0;
  const yInterceptVal = hasOyIntercept ? b / d : null;
  const yInterceptPixelY = yInterceptVal !== null ? oy - yInterceptVal * scale : null;

  // With Ox: y = 0 => x = -b / a
  const hasOxIntercept = a !== 0;
  const xInterceptVal = hasOxIntercept ? -b / a : null;
  const xInterceptPixelX = xInterceptVal !== null ? ox + xInterceptVal * scale : null;

  // =========================================================================
  // 1. Spatial Geometry Oxyz Vector Coordinate System
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
            {/* Fine background grid */}
            <defs>
              <pattern id="grid-oxyz" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
              </pattern>
              {/* Arrow markers */}
              <marker id="arrow-axis" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#1e293b" />
              </marker>
              <marker id="arrow-i" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#dc2626" />
              </marker>
              <marker id="arrow-j" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#16a34a" />
              </marker>
              <marker id="arrow-k" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
            </defs>
            <rect width="320" height="260" fill="url(#grid-oxyz)" rx="10" />

            {/* Origin O(0,0,0) */}
            const originX = 140;
            const originY = 160;

            {/* Oz Axis (Upwards) */}
            <line x1="140" y1="160" x2="140" y2="25" stroke="#1e293b" strokeWidth="1.75" markerEnd="url(#arrow-axis)" />
            <text x="148" y="24" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">z</text>

            {/* Oy Axis (Horizontal to the right) */}
            <line x1="140" y1="160" x2="295" y2="160" stroke="#1e293b" strokeWidth="1.75" markerEnd="url(#arrow-axis)" />
            <text x="300" y="164" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">y</text>

            {/* Ox Axis (Slanted down-left at 135 degrees) */}
            <line x1="140" y1="160" x2="45" y2="245" stroke="#1e293b" strokeWidth="1.75" markerEnd="url(#arrow-axis)" />
            <text x="32" y="250" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#0f172a">x</text>

            {/* Negative axes (dashed) */}
            <line x1="140" y1="160" x2="140" y2="210" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="140" y1="160" x2="60" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="140" y1="160" x2="190" y2="115" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

            {/* Unit Vectors */}
            {/* k vector on Oz */}
            <line x1="140" y1="160" x2="140" y2="105" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrow-k)" />
            <text x="148" y="125" fontSize="11" fontStyle="italic" fontWeight="bold" fill="#2563eb">k⃗</text>

            {/* j vector on Oy */}
            <line x1="140" y1="160" x2="195" y2="160" stroke="#16a34a" strokeWidth="2.5" markerEnd="url(#arrow-j)" />
            <text x="180" y="150" fontSize="11" fontStyle="italic" fontWeight="bold" fill="#16a34a">j⃗</text>

            {/* i vector on Ox */}
            <line x1="140" y1="160" x2="90" y2="205" stroke="#dc2626" strokeWidth="2.5" markerEnd="url(#arrow-i)" />
            <text x="100" y="215" fontSize="11" fontStyle="italic" fontWeight="bold" fill="#dc2626">i⃗</text>

            {/* Sample Point M(x0, y0, z0) with 3D projection box */}
            {/* Projection in Oxy plane: M'(220, 205) */}
            <line x1="90" y1="205" x2="185" y2="205" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
            <line x1="235" y1="160" x2="185" y2="205" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
            <circle cx="185" cy="205" r="3" fill="#64748b" />
            <text x="190" y="218" fontSize="10" fill="#64748b">M'(x₀, y₀, 0)</text>

            {/* Elevation to M(x0, y0, z0) */}
            <line x1="185" y1="205" x2="185" y2="90" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,3" />
            <circle cx="185" cy="90" r="4" fill="#4f46e5" />
            <text x="195" y="92" fontSize="11" fontWeight="bold" fill="#312e81">M(x₀, y₀, z₀)</text>

            {/* Coordinate markers on axes */}
            <line x1="88" y1="203" x2="92" y2="207" stroke="#dc2626" strokeWidth="1.5" />
            <text x="75" y="200" fontSize="9" fontWeight="bold" fill="#dc2626">x₀</text>

            <line x1="235" y1="157" x2="235" y2="163" stroke="#16a34a" strokeWidth="1.5" />
            <text x="232" y="174" fontSize="9" fontWeight="bold" fill="#16a34a">y₀</text>

            <line x1="137" y1="90" x2="143" y2="90" stroke="#2563eb" strokeWidth="1.5" />
            <line x1="140" y1="90" x2="185" y2="90" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
            <text x="124" y="93" fontSize="9" fontWeight="bold" fill="#2563eb">z₀</text>

            {/* Origin Label O */}
            <circle cx="140" cy="160" r="3.5" fill="#0f172a" />
            <text x="126" y="173" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#0f172a">O</text>
          </svg>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500 italic">
          Hình vẽ: Hệ trục toạ độ Oxyz trong không gian theo chuẩn SGK GDPT 2018
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. Spatial Pyramid S.ABCD Geometry
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
            {/* Pyramid S.ABCD: S(150, 25), A(70, 150), B(120, 205), C(230, 195), D(180, 140) */}
            {/* Dashed lines (hidden base and edges) */}
            <line x1="70" y1="150" x2="180" y2="140" stroke="#475569" strokeWidth="1.3" strokeDasharray="4,4" />
            <line x1="180" y1="140" x2="230" y2="195" stroke="#475569" strokeWidth="1.3" strokeDasharray="4,4" />
            <line x1="150" y1="25" x2="180" y2="140" stroke="#475569" strokeWidth="1.3" strokeDasharray="4,4" />

            {/* Height SH dashed (H is center of ABCD) */}
            <line x1="150" y1="25" x2="150" y2="170" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,3" />
            <circle cx="150" cy="170" r="2.5" fill="#ef4444" />
            <text x="146" y="184" fontSize="10" fontWeight="bold" fill="#ef4444">H</text>

            {/* Visible lines (solid) */}
            <line x1="70" y1="150" x2="120" y2="205" stroke="#0f172a" strokeWidth="1.75" />
            <line x1="120" y1="205" x2="230" y2="195" stroke="#0f172a" strokeWidth="1.75" />
            <line x1="150" y1="25" x2="70" y2="150" stroke="#0f172a" strokeWidth="1.75" />
            <line x1="150" y1="25" x2="120" y2="205" stroke="#0f172a" strokeWidth="1.75" />
            <line x1="150" y1="25" x2="230" y2="195" stroke="#0f172a" strokeWidth="1.75" />

            {/* Labels */}
            <text x="146" y="18" fontSize="12" fontWeight="bold" fill="#0f172a">S</text>
            <text x="54" y="154" fontSize="11" fontWeight="bold" fill="#0f172a">A</text>
            <text x="114" y="222" fontSize="11" fontWeight="bold" fill="#0f172a">B</text>
            <text x="236" y="202" fontSize="11" fontWeight="bold" fill="#0f172a">C</text>
            <text x="184" y="136" fontSize="11" fontWeight="bold" fill="#0f172a">D</text>
          </svg>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500 italic">
          Hình vẽ: Khối chóp không gian S.ABCD (nét liền nhìn thấy, nét đứt bị che)
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. Cubic Function y = ax³ + bx² + cx + d
  // =========================================================================
  if (type === 'cubic') {
    return (
      <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-md mx-auto font-sans text-xs">
        {title && (
          <div className="text-center font-bold text-slate-800 mb-2.5">
            <MathRenderer content={title} />
          </div>
        )}
        <div className="flex justify-center bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <svg width="340" height="280" viewBox="0 0 340 280" className="overflow-visible select-none">
            <defs>
              <pattern id="plot-grid-c" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="340" height="280" fill="url(#plot-grid-c)" rx="10" />

            {/* Axes */}
            <line x1="15" y1="140" x2="325" y2="140" stroke="#334155" strokeWidth="1.5" />
            <polygon points="330,140 320,136 320,144" fill="#334155" />
            <text x="328" y="135" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#1e293b">x</text>

            <line x1="170" y1="265" x2="170" y2="15" stroke="#334155" strokeWidth="1.5" />
            <polygon points="170,10 166,20 174,20" fill="#334155" />
            <text x="178" y="18" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#1e293b">y</text>
            <text x="156" y="155" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#1e293b">O</text>

            {/* Ticks and values */}
            <line x1="205" y1="137" x2="205" y2="143" stroke="#334155" strokeWidth="1.5" />
            <text x="202" y="155" fontSize="10" fill="#475569">1</text>
            <line x1="240" y1="137" x2="240" y2="143" stroke="#334155" strokeWidth="1.5" />
            <text x="237" y="155" fontSize="10" fill="#475569">2</text>

            <line x1="167" y1="80" x2="173" y2="80" stroke="#334155" strokeWidth="1.5" />
            <text x="154" y="84" fontSize="10" fontWeight="bold" fill="#1e293b">2</text>
            <line x1="167" y1="200" x2="173" y2="200" stroke="#334155" strokeWidth="1.5" />
            <text x="150" y="204" fontSize="10" fontWeight="bold" fill="#1e293b">-2</text>

            {/* Projection to point (2, -2) */}
            <line x1="240" y1="140" x2="240" y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="170" y1="200" x2="240" y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

            {/* Smooth cubic curve */}
            <path
              d="M 130,265 C 150,150 160,80 170,80 C 185,80 220,200 240,200 C 255,200 270,100 290,15"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Extremum points */}
            <circle cx="170" cy="80" r="4" fill="#dc2626" />
            <circle cx="240" cy="200" r="4" fill="#2563eb" />
          </svg>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500 italic">
          Hình vẽ: Đồ thị hàm số bậc ba chuẩn SGK GDPT 2018
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. Exact Mathematical Rational Function y = (ax+b)/(cx+d)
  //    WITH EXACT ASYMPTOTES x = -d/c and y = a/c
  //    AND ABSOLUTELY NO UNWANTED TANGENT LINES
  // =========================================================================
  return (
    <div className="my-3.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-md mx-auto font-sans text-xs">
      {title && (
        <div className="text-center font-bold text-slate-800 mb-2">
          <MathRenderer content={title} />
        </div>
      )}

      {/* Dynamic formula badge */}
      <div className="flex items-center justify-center gap-2 mb-2 text-xs">
        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
          <MathRenderer content={`$y = \\dfrac{${a === 1 ? '' : a === -1 ? '-' : a}x ${b >= 0 ? '+' : ''}${b}}{${c === 1 ? '' : c === -1 ? '-' : c}x ${d >= 0 ? '+' : ''}${d}}$`} />
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          TCĐ: <b className="text-rose-600 font-mono">x = {tcdVal}</b>, TCN: <b className="text-rose-600 font-mono">y = {tcnVal}</b>
        </span>
      </div>

      <div className="flex justify-center bg-slate-50/80 p-2 rounded-xl border border-slate-100">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
          {/* Subtle grid pattern */}
          <defs>
            <pattern id="plot-grid-r" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#plot-grid-r)" rx="10" />

          {/* Ox Axis */}
          <line x1="15" y1={oy} x2={width - 15} y2={oy} stroke="#334155" strokeWidth="1.5" />
          <polygon points={`${width - 10},${oy} ${width - 20},${oy - 4} ${width - 20},${oy + 4}`} fill="#334155" />
          <text x={width - 14} y={oy - 8} fontSize="12" fontStyle="italic" fontWeight="bold" fill="#1e293b">x</text>

          {/* Oy Axis */}
          <line x1={ox} y1={height - 15} x2={ox} y2="15" stroke="#334155" strokeWidth="1.5" />
          <polygon points={`${ox},10 ${ox - 4},20 ${ox + 4},20`} fill="#334155" />
          <text x={ox + 8} y="18" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#1e293b">y</text>

          {/* Origin O */}
          <text x={ox - 14} y={oy + 14} fontSize="11" fontStyle="italic" fontWeight="bold" fill="#1e293b">O</text>

          {/* VERTICAL ASYMPTOTE (Tiệm cận đứng): x = -d/c */}
          <line
            x1={tcdPixelX}
            y1="15"
            x2={tcdPixelX}
            y2={height - 15}
            stroke="#ef4444"
            strokeWidth="1.75"
            strokeDasharray="5,4"
          />
          {/* Label on axis for vertical asymptote */}
          <line x1={tcdPixelX} y1={oy - 3} x2={tcdPixelX} y2={oy + 3} stroke="#dc2626" strokeWidth="2" />
          <text
            x={tcdPixelX + 4}
            y={oy + 14}
            fontSize="10"
            fontWeight="bold"
            fill="#dc2626"
            className="select-none"
          >
            {tcdVal}
          </text>
          <text
            x={tcdPixelX + 4}
            y="26"
            fontSize="10"
            fontWeight="bold"
            fill="#dc2626"
            className="select-none"
          >
            x = {tcdVal}
          </text>

          {/* HORIZONTAL ASYMPTOTE (Tiệm cận ngang): y = a/c */}
          <line
            x1="15"
            y1={tcnPixelY}
            x2={width - 15}
            y2={tcnPixelY}
            stroke="#ef4444"
            strokeWidth="1.75"
            strokeDasharray="5,4"
          />
          {/* Label on axis for horizontal asymptote */}
          <line x1={ox - 3} y1={tcnPixelY} x2={ox + 3} y2={tcnPixelY} stroke="#dc2626" strokeWidth="2" />
          <text
            x={ox - 18}
            y={tcnPixelY - 3}
            fontSize="10"
            fontWeight="bold"
            fill="#dc2626"
            className="select-none"
          >
            {tcnVal}
          </text>
          <text
            x={width - 45}
            y={tcnPixelY - 6}
            fontSize="10"
            fontWeight="bold"
            fill="#dc2626"
            className="select-none"
          >
            y = {tcnVal}
          </text>

          {/* Hyperbola Left Branch (x < -d/c) */}
          {rationalLeftBranch && (
            <path
              d={rationalLeftBranch}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Hyperbola Right Branch (x > -d/c) */}
          {rationalRightBranch && (
            <path
              d={rationalRightBranch}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Center of Symmetry I( -d/c, a/c ) */}
          <circle cx={tcdPixelX} cy={tcnPixelY} r="3.5" fill="#ef4444" />
          <text
            x={tcdPixelX - 12}
            y={tcnPixelY - 5}
            fontSize="10"
            fontStyle="italic"
            fontWeight="bold"
            fill="#ef4444"
          >
            I
          </text>

          {/* Point on Oy if visible */}
          {yInterceptPixelY !== null && yInterceptPixelY >= 20 && yInterceptPixelY <= height - 20 && (
            <>
              <circle cx={ox} cy={yInterceptPixelY} r="3" fill="#1e293b" />
              <text x={ox + 5} y={yInterceptPixelY + 3} fontSize="9" fill="#475569">
                {yInterceptVal}
              </text>
            </>
          )}

          {/* Point on Ox if visible */}
          {xInterceptPixelX !== null && xInterceptPixelX >= 20 && xInterceptPixelX <= width - 20 && (
            <>
              <circle cx={xInterceptPixelX} cy={oy} r="3" fill="#1e293b" />
              <text x={xInterceptPixelX - 4} y={oy - 5} fontSize="9" fill="#475569">
                {xInterceptVal}
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="mt-2 text-center text-[11px] text-slate-500 italic">
        Hình vẽ: Đồ thị hàm phân thức với hai đường tiệm cận đứng và tiệm cận ngang (đường nét đứt màu đỏ)
      </div>
    </div>
  );
};
