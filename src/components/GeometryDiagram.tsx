import React from 'react';
import { MathRenderer } from './MathRenderer';

export const GeometryDiagram: React.FC = () => {
  return (
    <div className="my-4 p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-sm mx-auto font-sans text-xs">
      <div className="text-center font-bold text-slate-800 mb-2">
        Hình vẽ: Hình chóp <MathRenderer content="$S.ABCD$" /> có đáy hình vuông, <MathRenderer content="$SA \perp (ABCD)$" />
      </div>

      <div className="flex justify-center bg-slate-50 p-2 rounded-lg border border-slate-200">
        <svg width="260" height="220" viewBox="0 0 260 220" className="overflow-visible">
          {/* Points:
              S: (70, 25)
              A: (70, 160) - SA perpendicular to base
              B: (25, 200) - Front left
              C: (195, 200) - Front right
              D: (220, 160) - Back right
          */}

          {/* Hidden lines (Dashed) */}
          {/* AD */}
          <line x1="70" y1="160" x2="220" y2="160" stroke="#475569" strokeWidth="1.5" strokeDasharray="4,3" />
          {/* AB */}
          <line x1="70" y1="160" x2="25" y2="200" stroke="#475569" strokeWidth="1.5" strokeDasharray="4,3" />
          {/* SA (altitude) */}
          <line x1="70" y1="25" x2="70" y2="160" stroke="#2563eb" strokeWidth="2" strokeDasharray="4,3" />
          {/* AC (base diagonal) */}
          <line x1="70" y1="160" x2="195" y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

          {/* Visible edges (Solid) */}
          {/* BC */}
          <line x1="25" y1="200" x2="195" y2="200" stroke="#1e293b" strokeWidth="1.75" />
          {/* CD */}
          <line x1="195" y1="200" x2="220" y2="160" stroke="#1e293b" strokeWidth="1.75" />
          {/* SB */}
          <line x1="70" y1="25" x2="25" y2="200" stroke="#1e293b" strokeWidth="1.75" />
          {/* SC */}
          <line x1="70" y1="25" x2="195" y2="200" stroke="#1e293b" strokeWidth="1.75" />
          {/* SD */}
          <line x1="70" y1="25" x2="220" y2="160" stroke="#1e293b" strokeWidth="1.75" />

          {/* Right angle marker at A for SA perpendicular to AD and AB */}
          <path d="M 70,145 L 85,145 L 85,160" fill="none" stroke="#2563eb" strokeWidth="1" />
          <path d="M 70,145 L 60,154 L 60,169" fill="none" stroke="#2563eb" strokeWidth="1" />

          {/* Vertex labels */}
          <text x="65" y="18" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#1e293b">S</text>
          <text x="52" y="165" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#2563eb">A</text>
          <text x="10" y="210" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#1e293b">B</text>
          <text x="202" y="212" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#1e293b">C</text>
          <text x="226" y="165" fontSize="13" fontStyle="italic" fontWeight="bold" fill="#1e293b">D</text>
        </svg>
      </div>

      <div className="mt-2 text-center text-[11px] text-slate-500 italic">
        Quy ước SGK: Nét liền thể hiện cạnh nhìn thấy, nét đứt thể hiện cạnh bị che khuất.
      </div>
    </div>
  );
};
