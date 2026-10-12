import React, { useState } from 'react';
import {
  Shuffle,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { Exam, StudentRosterItem } from '../types/exam';
import { AnswerMatrixRow, Generated45Package, generate45ExamVariants, VariantGenerationConfig } from '../services/examPermuter';
import * as XLSX from 'xlsx-js-style';

interface ExamVariantsViewProps {
  currentExam: Exam | null;
  savedExams: Exam[];
  roster: StudentRosterItem[];
  variants: Exam[];
  answerMatrix: AnswerMatrixRow[];
  onSelectVariant: (variant: Exam) => void;
  onGenerateVariants: (config?: VariantGenerationConfig) => void;
  onNavigate: (tab: any) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExamVariantsView: React.FC<ExamVariantsViewProps> = ({
  currentExam,
  savedExams,
  roster,
  variants,
  answerMatrix,
  onSelectVariant,
  onGenerateVariants,
  onNavigate,
  showToast,
}) => {
  const [numVariants, setNumVariants] = useState<number>(24);
  const [mode, setMode] = useState<'shuffle_only' | 'numeric_variation'>('shuffle_only');

  const handleExportAnswerMatrix = () => {
    if (answerMatrix.length === 0) {
      if (showToast) showToast('Chưa có mã đề nào được tạo.', 'info');
      return;
    }

    try {
      const rows = answerMatrix.map((row, idx) => {
        const item: Record<string, any> = {
          'STT': idx + 1,
          'Mã Đề': row.examCode,
          'Học Sinh Phân Bổ': row.studentName || 'Chưa gán',
        };
        Object.entries(row.mcAnswers).forEach(([q, ans]) => {
          item[q] = ans;
        });
        Object.entries(row.tfAnswers).forEach(([q, pattern]) => {
          item[q] = pattern;
        });
        return item;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ma_Tran_Dap_An');
      XLSX.writeFile(wb, `Ma_Tran_Dap_An_${currentExam?.examCode || 'TOAN'}.xlsx`);
      if (showToast) showToast('Đã xuất ma trận đáp án Excel thành công!');
    } catch (e: any) {
      console.error('Export error:', e);
      if (showToast) showToast('Lỗi xuất Excel: ' + e.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Shuffle className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Trộn Đề Thi Chống Gian Lận (24 - 45 Mã Đề)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hoán vị thứ tự câu hỏi và phương án A, B, C, D chuẩn khảo thí Bộ GD&ĐT, tự động lập bảng ma trận đáp án soi chiếu.
          </p>
        </div>

        {answerMatrix.length > 0 && (
          <button
            type="button"
            onClick={handleExportAnswerMatrix}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Ma Trận Đáp Án (.xlsx)</span>
          </button>
        )}
      </div>

      {/* Generator Configuration Panel */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Cấu hình trộn mã đề từ đề gốc: <b className="text-indigo-700">{currentExam?.title || 'Chưa chọn đề'}</b></span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Số lượng mã đề cần tạo:</label>
            <select
              value={numVariants}
              onChange={(e) => setNumVariants(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value={4}>4 Mã đề</option>
              <option value={8}>8 Mã đề</option>
              <option value={12}>12 Mã đề</option>
              <option value={24}>24 Mã đề (Chuẩn phòng thi THPT)</option>
              <option value={45}>45 Mã đề (Mỗi học sinh 1 đề riêng)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Phương thức xáo trộn:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="shuffle_only">Trộn chuẩn BGD (Hoán vị câu & đáp án A-B-C-D)</option>
              <option value="numeric_variation">Trộn kèm biến đổi số liệu an toàn</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => onGenerateVariants({ mode, numVariants })}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Shuffle className="w-4 h-4" />
              <span>Tiến Hành Trộn {numVariants} Mã Đề</span>
            </button>
          </div>
        </div>
      </div>

      {/* Answer Key Matrix Table & Variants List */}
      {variants.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Bảng Ma Trận Đáp Án Soi Chiếu ({variants.length} Mã Đề)</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold">Tự động hoán vị theo seed ngẫu nhiên</span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center">STT</th>
                    <th className="p-3">Mã Đề</th>
                    {Array.from({ length: Math.min(12, currentExam?.multipleChoice.length || 10) }).map((_, i) => (
                      <th key={i} className="p-2 text-center font-mono">C{i + 1}</th>
                    ))}
                    {Array.from({ length: Math.min(4, currentExam?.trueFalseQuestions.length || 2) }).map((_, i) => (
                      <th key={i} className="p-2 text-center font-mono">Đ/S {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {answerMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{row.examCode}</td>
                      {Object.entries(row.mcAnswers).slice(0, 12).map(([_, ans], i) => (
                        <td key={i} className="p-2 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                          {ans}
                        </td>
                      ))}
                      {Object.entries(row.tfAnswers).slice(0, 4).map(([_, pattern], i) => (
                        <td key={i} className="p-2 text-center font-mono text-[11px] font-bold text-indigo-900">
                          {pattern}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* List of derivative variants */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Danh Sách Các Mã Đề Phái Sinh ({variants.length})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-slate-50 transition-all flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono font-black text-xs">
                      {variant.examCode}
                    </span>
                    <div className="text-xs font-bold text-slate-900 truncate mt-1">
                      {variant.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVariant(variant);
                      onNavigate('student_room');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Làm thử</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <Shuffle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Chưa có gói mã đề nào được tạo</p>
          <p className="text-xs text-slate-400 mt-1">
            Hãy bấm vào nút "Tiến Hành Trộn Mã Đề" ở trên để tạo 24 hoặc 45 mã đề xáo trộn hoàn chỉnh.
          </p>
        </div>
      )}
    </div>
  );
};
