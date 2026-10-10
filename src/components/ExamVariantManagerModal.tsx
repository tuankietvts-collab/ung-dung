import React, { useState } from 'react';
import {
  X,
  Layers,
  FileSpreadsheet,
  Printer,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Search,
  BookOpen,
  Shuffle,
  Eye,
  Download,
  Award,
  Send,
  Building,
  Check,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { Exam, ClassGroup } from '../types/exam';
import { AnswerMatrixRow, VariantGenerationConfig } from '../services/examPermuter';
import { MathRenderer } from './MathRenderer';

interface ExamVariantManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterExam: Exam;
  variants: Exam[];
  answerMatrix: AnswerMatrixRow[];
  onSelectVariantForExamRoom: (variant: Exam) => void;
  onTriggerAIVariation?: () => void;
  isGeneratingAI?: boolean;
  onRecreateVariants?: (config: VariantGenerationConfig) => void;
  classes?: ClassGroup[];
  onAssignToClass?: (className: string) => void;
}

export const ExamVariantManagerModal: React.FC<ExamVariantManagerModalProps> = ({
  isOpen,
  onClose,
  masterExam,
  variants,
  answerMatrix,
  onSelectVariantForExamRoom,
  onTriggerAIVariation,
  isGeneratingAI = false,
  onRecreateVariants,
  classes = [],
  onAssignToClass,
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'matrix' | 'ai_variants'>('roster');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [previewVariant, setPreviewVariant] = useState<Exam | null>(null);

  // Cấu hình trộn đề & sinh n mã đề
  const [shuffleMode, setShuffleMode] = useState<'shuffle_only' | 'numeric_variation'>('shuffle_only');
  const [numVariants, setNumVariants] = useState<number>(() => variants.length > 0 ? variants.length : 4);
  const [selectedClassToAssign, setSelectedClassToAssign] = useState<string>(() => classes.length > 0 ? classes[0].name : '');
  const [isAssignedToast, setIsAssignedToast] = useState<boolean>(false);

  if (!isOpen) return null;

  // Handle re-generating n variants with chosen mode
  const handleRegenerate = () => {
    if (onRecreateVariants) {
      onRecreateVariants({
        mode: shuffleMode,
        numVariants: Math.max(1, Math.min(50, numVariants)),
      });
    }
  };

  const handleAssignToClassClick = () => {
    if (onAssignToClass && selectedClassToAssign) {
      onAssignToClass(selectedClassToAssign);
      setIsAssignedToast(true);
      setTimeout(() => setIsAssignedToast(false), 3000);
    }
  };

  // Filtered variants
  const filteredRows = answerMatrix.filter(
    (row) =>
      row.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.examCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Export Matrix to Excel
  const handleExportAnswerMatrix = () => {
    const headerRow = ['STT', 'SỐ BÁO DANH', 'HỌ VÀ TÊN', 'MÃ ĐỀ'];
    const mcKeys = Object.keys(answerMatrix[0]?.mcAnswers || {});
    const tfKeys = Object.keys(answerMatrix[0]?.tfAnswers || {});
    headerRow.push(...mcKeys, ...tfKeys);

    const dataRows = answerMatrix.map((row, idx) => {
      const rowData = [
        idx + 1,
        row.studentId,
        row.studentName,
        row.examCode,
      ];
      mcKeys.forEach((k) => rowData.push(row.mcAnswers[k] || ''));
      tfKeys.forEach((k) => rowData.push(row.tfAnswers[k] || ''));
      return rowData;
    });

    const ws = XLSX.utils.aoa_to_sheet([
      ['BẢNG ĐÁP ÁN TỔNG HỢP 45 MÃ ĐỀ THI TOÁN - KHẢO THÍ SỐ'],
      [`Đề thi gốc: ${masterExam.title} (${masterExam.examCode})`],
      ['Cơ chế: Trộn đề và đảo 4 phương án A, B, C, D chuẩn khảo thí Quốc gia'],
      [],
      headerRow,
      ...dataRows,
    ]);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 24 },
      { wch: 12 },
      ...mcKeys.map(() => ({ wch: 10 })),
      ...tfKeys.map(() => ({ wch: 14 })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bang_Dap_An_45_Ma_De');
    XLSX.writeFile(wb, `Bang_Dap_An_45_Ma_De_${masterExam.examCode}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <Shuffle className="w-3 h-3" /> Chuẩn Khảo Thí Bộ GD&ĐT
              </span>
              <span className="text-xs text-sky-200 font-mono font-bold">
                {variants.length} Mã Đề / 45 Học Sinh
              </span>
            </div>
            <h3 className="text-xl font-black text-white mt-1">
              Quản Lý 45 Mã Đề Thi & Bảng Đáp Án Ma Trận
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Đề thi gốc: <span className="font-semibold text-white">{masterExam.title}</span> ({masterExam.examCode}).
              Các mã đề được xáo trộn câu hỏi, hoán vị 4 phương án $A, B, C, D$ và sửa số liệu chống gian lận.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BẢNG ĐIỀU KHIỂN: TÙY CHỌN CHỈ TRỘN ĐỀ, TẠO n MÃ ĐỀ & GIAO THEO ĐƠN VỊ LỚP */}
        <div className="p-4 bg-gradient-to-r from-indigo-50 via-sky-50 to-indigo-50 border-b border-indigo-100 shrink-0 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Tùy chọn 1: Chế độ trộn đề */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                1. Chế Độ Trộn Đề:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShuffleMode('shuffle_only')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    shuffleMode === 'shuffle_only'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Chỉ hoán vị thứ tự câu hỏi và 4 phương án A, B, C, D; giữ nguyên 100% số liệu gốc của đề"
                >
                  <span className={`w-2 h-2 rounded-full ${shuffleMode === 'shuffle_only' ? 'bg-white' : 'bg-slate-400'}`} />
                  <span>Chỉ Trộn Đề (Giữ nguyên số liệu gốc)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShuffleMode('numeric_variation')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    shuffleMode === 'numeric_variation'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Xáo trộn câu hỏi, hoán vị phương án và biến đổi số liệu tương đương chống nhìn bài"
                >
                  <span className={`w-2 h-2 rounded-full ${shuffleMode === 'numeric_variation' ? 'bg-white' : 'bg-slate-400'}`} />
                  <span>Trộn & Đổi Số Liệu Tương Đương</span>
                </button>
              </div>
            </div>

            {/* Tùy chọn 2: Số lượng n mã đề */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                2. Tùy Chọn Số Lượng (n Mã Đề):
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[2, 4, 8, 24, 45].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumVariants(n)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      numVariants === n
                        ? 'bg-indigo-700 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {n} mã
                  </button>
                ))}
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-0.5">
                  <span className="text-[11px] text-slate-500 font-bold">Tùy chọn:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numVariants}
                    onChange={(e) => setNumVariants(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                    className="w-12 text-xs font-black text-indigo-700 text-center focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 font-bold">mã</span>
                </div>

                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Sinh ngay n mã đề mới với cấu hình đã chọn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tạo {numVariants} Mã Đề Ngay</span>
                </button>
              </div>
            </div>
          </div>

          {/* Giao đề theo đơn vị lớp */}
          {classes && classes.length > 0 && onAssignToClass && (
            <div className="pt-2 border-t border-indigo-200/70 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-indigo-600" /> Giao {variants.length} mã đề cho đơn vị lớp:
                </span>
                <select
                  value={selectedClassToAssign}
                  onChange={(e) => setSelectedClassToAssign(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-indigo-800 focus:outline-none"
                >
                  {classes.map((cls) => (
                    <option key={cls.id || cls.name} value={cls.name}>
                      Lớp {cls.name} ({cls.grade ? `Khối ${cls.grade}` : 'Toán'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAssignToClassClick}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Send className="w-3 h-3" />
                  <span>Giao Cho Lớp {selectedClassToAssign}</span>
                </button>
              </div>

              {isAssignedToast && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Đã giao {variants.length} mã đề cho lớp {selectedClassToAssign}!
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('roster');
                setPreviewVariant(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Danh Sách 45 Mã Đề & Gán Học Sinh
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('matrix');
                setPreviewVariant(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Bảng Đáp Án Ma Trận ({variants.length} Mã)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportAnswerMatrix}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel Đáp Án
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> In Biểu Mẫu
            </button>
          </div>
        </div>

        {/* Tab 1: Roster and Variant list */}
        {activeTab === 'roster' && !previewVariant && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo tên học sinh, SBD hoặc mã đề..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Hiển thị <span className="font-bold text-slate-800">{filteredRows.length}</span> / 45 học sinh
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center w-12 border-r border-slate-800">STT</th>
                    <th className="py-3 px-3 text-center w-24 border-r border-slate-800">SBD</th>
                    <th className="py-3 px-4 border-r border-slate-800">Họ và Tên Thí Sinh</th>
                    <th className="py-3 px-3 text-center border-r border-slate-800">Mã Đề Thi</th>
                    <th className="py-3 px-3 text-center border-r border-slate-800">Đáp Án Trắc Nghiệm</th>
                    <th className="py-3 px-3 text-center border-r border-slate-800">Đáp Án Đúng/Sai</th>
                    <th className="py-3 px-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row, idx) => {
                    const matchedVariant = variants.find((v) => v.examCode === row.examCode);
                    const mcKeys = Object.keys(row.mcAnswers);
                    const tfKeys = Object.keys(row.tfAnswers);

                    return (
                      <tr key={row.examCode} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.studentId}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-200">
                          {row.studentName}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200">
                          <span className="inline-block px-2.5 py-1 rounded-md font-mono font-black text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {row.examCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200">
                          <div className="flex items-center justify-center gap-1">
                            {mcKeys.map((k) => (
                              <span
                                key={k}
                                className="w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {row.mcAnswers[k]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200">
                          <span className="font-mono text-[11px] font-semibold text-slate-600">
                            {tfKeys.map((k) => row.tfAnswers[k]).join(', ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {matchedVariant && (
                              <button
                                type="button"
                                onClick={() => setPreviewVariant(matchedVariant)}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-slate-500" /> Xem đề
                              </button>
                            )}
                            {matchedVariant && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectVariantForExamRoom(matchedVariant);
                                  onClose();
                                }}
                                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                Vào thi <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Preview a single variant in modal */}
        {previewVariant && (
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                  Đang xem chi tiết đề thi mã
                </span>
                <h4 className="text-base font-black text-slate-900 mt-0.5">
                  {previewVariant.title} - Phân bổ cho: {previewVariant.assignedStudentName} ({previewVariant.assignedStudentId})
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewVariant(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  ← Quay lại danh sách 45 mã
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectVariantForExamRoom(previewVariant);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  Chọn đề này làm bài <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Questions of previewVariant */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Phần I: Trắc nghiệm ({previewVariant.multipleChoice.length} câu)
              </div>
              {previewVariant.multipleChoice.map((q, idx) => (
                <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="font-semibold text-slate-900 flex justify-between">
                    <div>
                      <span className="font-bold text-indigo-600 mr-1.5">Câu {idx + 1}:</span>
                      <MathRenderer content={q.question} />
                    </div>
                    <span className="text-indigo-600 font-bold ml-2">({q.points}đ)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const letter = opt.substring(0, 1);
                      const isCorrect = letter === q.correctAnswer;
                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-lg border font-medium flex items-center justify-between ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <MathRenderer content={opt} />
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Đáp án đúng
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Full 45-code Answer Key Matrix */}
        {activeTab === 'matrix' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Bảng Đáp Án Tổng Hợp Cho Cả 45 Mã Đề
                </h4>
                <p className="text-xs text-slate-500">
                  Giáo viên dùng bảng này để đối chiếu khi chấm bài hoặc in thành bảng đáp án niêm yết.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs max-h-[60vh]">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-center border-r border-slate-800">STT</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-800">MÃ ĐỀ</th>
                    <th className="py-2.5 px-4 border-r border-slate-800">HỌC SINH</th>
                    {Object.keys(answerMatrix[0]?.mcAnswers || {}).map((k) => (
                      <th key={k} className="py-2.5 px-3 text-center border-r border-slate-800">
                        {k}
                      </th>
                    ))}
                    {Object.keys(answerMatrix[0]?.tfAnswers || {}).map((k) => (
                      <th key={k} className="py-2.5 px-3 text-center border-r border-slate-800">
                        {k} (Đ/S)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {answerMatrix.map((row, idx) => {
                    const mcKeys = Object.keys(row.mcAnswers);
                    const tfKeys = Object.keys(row.tfAnswers);
                    return (
                      <tr key={row.examCode} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-indigo-700 bg-indigo-50/50 border-r border-slate-200">
                          {row.examCode}
                        </td>
                        <td className="py-2 px-4 font-semibold text-slate-900 border-r border-slate-200">
                          {row.studentName} ({row.studentId})
                        </td>
                        {mcKeys.map((k) => (
                          <td key={k} className="py-2 px-3 text-center font-mono font-black border-r border-slate-200">
                            <span
                              className={`inline-block w-6 py-0.5 rounded text-center ${
                                row.mcAnswers[k] === 'A'
                                  ? 'bg-blue-100 text-blue-800'
                                  : row.mcAnswers[k] === 'B'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : row.mcAnswers[k] === 'C'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {row.mcAnswers[k]}
                            </span>
                          </td>
                        ))}
                        {tfKeys.map((k) => (
                          <td key={k} className="py-2 px-3 text-center font-mono font-semibold text-slate-700 border-r border-slate-200">
                            {row.tfAnswers[k]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
