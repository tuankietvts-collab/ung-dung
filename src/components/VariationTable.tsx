import React from 'react';
import { MathRenderer } from './MathRenderer';

export interface VariationTableProps {
  title?: string;
  type?: 'rational' | 'cubic' | 'custom';
}

export const VariationTable: React.FC<VariationTableProps> = ({
  title = 'Bảng biến thiên chuẩn SGK Toán GDPT 2018',
  type = 'rational',
}) => {
  if (type === 'cubic') {
    // =========================================================================
    // HÀM BẬC 3: y = x^3 - 3x^2 + 2
    // TXĐ: D = R. y' = 3x^2 - 6x = 0 <=> x = 0 (CĐ: y = 2) hoặc x = 2 (CT: y = -2)
    // Khoảng: (-inf, 0): +, (0, 2): -, (2, +inf): +
    // =========================================================================
    return (
      <div className="my-5 p-4 sm:p-5 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
        {title && (
          <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
            <span>{title}</span>
            <span className="text-indigo-800 font-bold">
              (<MathRenderer content="$y = x^3 - 3x^2 + 2$" />)
            </span>
          </div>
        )}

        <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <tbody>
              {/* DÒNG 1: x - Kẻ bảng viền mỏng rõ nét, căn giữa các mốc nghiệm */}
              <tr className="border-b border-slate-800">
                <td className="w-16 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50">
                  <MathRenderer content="$x$" />
                </td>
                <td className="w-[20%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$-\infty$" />
                </td>
                <td className="w-[10%] py-2 text-slate-950 font-bold">
                  <MathRenderer content="$0$" />
                </td>
                <td className="w-[30%] py-2"></td>
                <td className="w-[10%] py-2 text-slate-950 font-bold">
                  <MathRenderer content="$2$" />
                </td>
                <td className="w-[20%] py-2 text-slate-800 font-medium">
                  <MathRenderer content="$+\infty$" />
                </td>
              </tr>

              {/* DÒNG 2: f'(x) / y' - Căn giữa số 0 và dấu (+, -) */}
              <tr className="border-b border-slate-800 bg-white">
                <td className="w-16 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50">
                  <MathRenderer content="$y'$" />
                </td>
                <td className="py-2 text-slate-900 font-bold text-base">
                  <MathRenderer content="$+$" />
                </td>
                <td className="py-2 text-slate-800 font-bold text-sm">
                  <MathRenderer content="$0$" />
                </td>
                <td className="py-2 text-slate-900 font-bold text-base">
                  <MathRenderer content="$-$" />
                </td>
                <td className="py-2 text-slate-800 font-bold text-sm">
                  <MathRenderer content="$0$" />
                </td>
                <td className="py-2 text-slate-900 font-bold text-base">
                  <MathRenderer content="$+$" />
                </td>
              </tr>

              {/* DÒNG 3: f(x) / y - Các mũi tên biến thiên liền mạch, thể hiện rõ độ cao */}
              <tr className="bg-white">
                <td className="w-16 py-6 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle">
                  <MathRenderer content="$y$" />
                </td>
                <td colSpan={5} className="p-0 align-middle">
                  {/* Container SVG trực quan độ cao mép trên / mép dưới */}
                  <div className="relative h-28 w-full">
                    {/* SVG Mũi Tên Liền Mạch Vector Chuẩn SGK */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 500 110"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <marker
                          id="arrowhead-cubic"
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                        </marker>
                      </defs>

                      {/* Mũi tên 1: Đi từ -inf (mép dưới, x~35, y~90) lên CĐ = 2 (mép trên, x~145, y~22) */}
                      <line
                        x1="38"
                        y1="90"
                        x2="142"
                        y2="24"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        markerEnd="url(#arrowhead-cubic)"
                      />

                      {/* Mũi tên 2: Đi từ CĐ = 2 (mép trên, x~160, y~24) xuống CT = -2 (mép dưới, x~340, y~90) */}
                      <line
                        x1="162"
                        y1="24"
                        x2="338"
                        y2="90"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        markerEnd="url(#arrowhead-cubic)"
                      />

                      {/* Mũi tên 3: Đi từ CT = -2 (mép dưới, x~360, y~90) lên +inf (mép trên, x~470, y~22) */}
                      <line
                        x1="360"
                        y1="90"
                        x2="465"
                        y2="24"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        markerEnd="url(#arrowhead-cubic)"
                      />
                    </svg>

                    {/* Các nhãn giá trị được căn chỉnh chính xác theo trục ngang và độ cao */}
                    {/* 1. Mép dưới: -vô cùng tại x=-inf */}
                    <div className="absolute left-[3%] bottom-2">
                      <span className="font-bold text-slate-800 text-sm">
                        <MathRenderer content="$-\infty$" />
                      </span>
                    </div>

                    {/* 2. Mép trên: Cực đại = 2 tại x=0 */}
                    <div className="absolute left-[29%] top-2 -translate-x-1/2">
                      <span className="font-black text-slate-950 text-base bg-white px-1.5 py-0.5 rounded shadow-2xs">
                        <MathRenderer content="$2$" />
                      </span>
                    </div>

                    {/* 3. Mép dưới: Cực tiểu = -2 tại x=2 */}
                    <div className="absolute left-[70%] bottom-2 -translate-x-1/2">
                      <span className="font-black text-slate-950 text-base bg-white px-1.5 py-0.5 rounded shadow-2xs">
                        <MathRenderer content="$-2$" />
                      </span>
                    </div>

                    {/* 4. Mép trên: +vô cùng tại x=+inf */}
                    <div className="absolute right-[3%] top-2">
                      <span className="font-bold text-slate-800 text-sm">
                        <MathRenderer content="$+\infty$" />
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-center text-xs text-slate-600 italic">
          <MathRenderer content="Hàm số đạt cực đại tại $x = 0$ ($y_{CĐ} = 2$) và đạt cực tiểu tại $x = 2$ ($y_{CT} = -2$)." />
        </div>
      </div>
    );
  }

  // =========================================================================
  // HÀM PHÂN THỨC HỮU TỈ: y = (2x + 1) / (x - 1)
  // TXĐ: D = R \ {1}. y' = -3 / (x - 1)^2 < 0 với mọi x != 1
  // Tiệm cận đứng x = 1, Tiệm cận ngang y = 2
  // Nhánh trái: Đi từ y = 2 (mép trên) xuống -inf (mép dưới)
  // Nhánh phải: Đi từ +inf (mép trên) xuống y = 2 (mép dưới)
  // =========================================================================
  return (
    <div className="my-5 p-4 sm:p-5 bg-white rounded-2xl border border-slate-300 shadow-sm max-w-2xl mx-auto font-sans select-none">
      {title && (
        <div className="text-center font-bold text-slate-900 mb-3 text-xs sm:text-sm flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
          <span>{title}</span>
          <span className="text-indigo-800 font-bold">
            (<MathRenderer content="$y = \frac{2x + 1}{x - 1}$" />)
          </span>
        </div>
      )}

      <div className="border border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
        <table className="w-full text-center border-collapse text-sm">
          <tbody>
            {/* DÒNG 1: x - Điểm gián đoạn x = 1 */}
            <tr className="border-b border-slate-800">
              <td className="w-16 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50">
                <MathRenderer content="$x$" />
              </td>
              <td className="w-[42%] py-2 text-slate-800 font-medium">
                <MathRenderer content="$-\infty$" />
              </td>
              <td className="w-12 py-2 text-slate-950 font-bold">
                <MathRenderer content="$1$" />
              </td>
              <td className="w-[42%] py-2 text-slate-800 font-medium">
                <MathRenderer content="$+\infty$" />
              </td>
            </tr>

            {/* DÒNG 2: y' - Dấu âm và vạch đôi || */}
            <tr className="border-b border-slate-800 bg-white">
              <td className="w-16 py-2 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50">
                <MathRenderer content="$y'$" />
              </td>
              <td className="py-2 text-slate-900 font-bold text-base">
                <MathRenderer content="$-$" />
              </td>
              {/* Vạch kẻ đôi không xác định rõ nét chuẩn SGK */}
              <td className="py-0 px-0 w-12 align-middle">
                <div className="flex items-center justify-center gap-1.5 h-8">
                  <span className="w-[1.5px] h-full bg-slate-800 inline-block" />
                  <span className="w-[1.5px] h-full bg-slate-800 inline-block" />
                </div>
              </td>
              <td className="py-2 text-slate-900 font-bold text-base">
                <MathRenderer content="$-$" />
              </td>
            </tr>

            {/* DÒNG 3: y - Chiều biến thiên với độ cao chuẩn: +inf / 2 ở mép trên, -inf ở mép dưới */}
            <tr className="bg-white">
              <td className="w-16 py-6 px-2 font-serif italic font-bold border-r border-slate-800 text-slate-950 bg-slate-50 align-middle">
                <MathRenderer content="$y$" />
              </td>

              {/* Nhánh trái (-inf; 1): Giảm từ y=2 (mép trên) xuống -inf (mép dưới) */}
              <td className="p-0 align-middle">
                <div className="relative h-28 w-full">
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 200 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="arrowhead-rat-left"
                        markerWidth="6"
                        markerHeight="6"
                        refX="5"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                      </marker>
                    </defs>
                    {/* Đường mũi tên xiên xuống liền mạch */}
                    <line
                      x1="28"
                      y1="25"
                      x2="175"
                      y2="82"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      markerEnd="url(#arrowhead-rat-left)"
                    />
                  </svg>
                  {/* Mép trên: Tiệm cận ngang y = 2 */}
                  <div className="absolute left-3 top-2">
                    <span className="font-black text-slate-950 text-base bg-white px-1">
                      <MathRenderer content="$2$" />
                    </span>
                  </div>
                  {/* Mép dưới: -vô cùng */}
                  <div className="absolute right-3 bottom-2">
                    <span className="font-bold text-slate-800 text-sm bg-white px-1">
                      <MathRenderer content="$-\infty$" />
                    </span>
                  </div>
                </div>
              </td>

              {/* Vạch kẻ đôi xuyên suốt cả hàng y */}
              <td className="w-12 p-0 align-middle">
                <div className="flex items-center justify-center gap-1.5 h-28">
                  <span className="w-[1.5px] h-full bg-slate-800 inline-block" />
                  <span className="w-[1.5px] h-full bg-slate-800 inline-block" />
                </div>
              </td>

              {/* Nhánh phải (1; +inf): Giảm từ +inf (mép trên) xuống y=2 (mép dưới) */}
              <td className="p-0 align-middle">
                <div className="relative h-28 w-full">
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 200 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="arrowhead-rat-right"
                        markerWidth="6"
                        markerHeight="6"
                        refX="5"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
                      </marker>
                    </defs>
                    {/* Đường mũi tên xiên xuống liền mạch */}
                    <line
                      x1="28"
                      y1="25"
                      x2="175"
                      y2="82"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      markerEnd="url(#arrowhead-rat-right)"
                    />
                  </svg>
                  {/* Mép trên: +vô cùng */}
                  <div className="absolute left-3 top-2">
                    <span className="font-bold text-slate-800 text-sm bg-white px-1">
                      <MathRenderer content="$+\infty$" />
                    </span>
                  </div>
                  {/* Mép dưới: Tiệm cận ngang y = 2 */}
                  <div className="absolute right-3 bottom-2">
                    <span className="font-black text-slate-950 text-base bg-white px-1">
                      <MathRenderer content="$2$" />
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-center text-xs text-slate-600 italic">
        <MathRenderer content="Hàm số nghịch biến trên từng khoảng xác định $(-\\infty; 1)$ và $(1; +\\infty)$." />
      </div>
    </div>
  );
};
