import React from 'react';
import { MathRenderer } from './MathRenderer';

export const StatisticsTable: React.FC = () => {
  return (
    <div className="my-4 p-4 bg-white rounded-xl border border-slate-300 shadow-xs max-w-xl mx-auto font-sans text-xs">
      <div className="text-center font-bold text-slate-800 mb-2">
        Bảng tần số ghép nhóm điểm kiểm tra môn Toán (Chuẩn SGK Toán THPT GDPT 2018)
      </div>

      <div className="overflow-x-auto border border-slate-300 rounded-lg">
        <table className="w-full text-center border-collapse text-xs">
          <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-300">
            <tr>
              <th className="py-2.5 px-3 border-r border-slate-300">Nhóm điểm số</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Giá trị đại diện <MathRenderer content="$c_i$" /></th>
              <th className="py-2.5 px-3 border-r border-slate-300">Tần số <MathRenderer content="$n_i$" /></th>
              <th className="py-2.5 px-3">Tần số tích lũy <MathRenderer content="$cf_i$" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-2 px-3 border-r border-slate-200 font-medium"><MathRenderer content="$[4; 5.5)$" /></td>
              <td className="py-2 px-3 border-r border-slate-200"><MathRenderer content="$4.75$" /></td>
              <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-800">4</td>
              <td className="py-2 px-3 text-slate-600">4</td>
            </tr>
            <tr className="bg-slate-50/50">
              <td className="py-2 px-3 border-r border-slate-200 font-medium"><MathRenderer content="$[5.5; 7.0)$" /></td>
              <td className="py-2 px-3 border-r border-slate-200"><MathRenderer content="$6.25$" /></td>
              <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-800">12</td>
              <td className="py-2 px-3 text-slate-600">16</td>
            </tr>
            <tr className="bg-blue-50/40">
              <td className="py-2 px-3 border-r border-slate-200 font-bold text-blue-900"><MathRenderer content="$[7.0; 8.5)$" /></td>
              <td className="py-2 px-3 border-r border-slate-200 font-semibold"><MathRenderer content="$7.75$" /></td>
              <td className="py-2 px-3 border-r border-slate-200 font-black text-blue-700">18 (Nhóm Mốt)</td>
              <td className="py-2 px-3 text-slate-600">34</td>
            </tr>
            <tr>
              <td className="py-2 px-3 border-r border-slate-200 font-medium"><MathRenderer content="$[8.5; 10.0]$" /></td>
              <td className="py-2 px-3 border-r border-slate-200"><MathRenderer content="$9.25$" /></td>
              <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-800">6</td>
              <td className="py-2 px-3 text-slate-600">40</td>
            </tr>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
              <td colSpan={2} className="py-2 px-3 border-r border-slate-300 text-left pl-4">Tổng số học sinh (<MathRenderer content="$N$" />)</td>
              <td className="py-2 px-3 border-r border-slate-300 text-emerald-700 font-black">40</td>
              <td className="py-2 px-3 text-slate-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
        <div>• Số trung bình: <MathRenderer content="$\bar{x} \approx 7.23$" /></div>
        <div>• Trung vị: <MathRenderer content="$M_e = 7.33$" /></div>
        <div>• Mốt của mẫu số liệu: <MathRenderer content="$M_o \approx 7.62$" /></div>
        <div>• Độ lệch chuẩn: <MathRenderer content="$s \approx 1.25$" /></div>
      </div>
    </div>
  );
};
