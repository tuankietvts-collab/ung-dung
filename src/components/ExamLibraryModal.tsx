import React, { useState } from 'react';
import {
  FolderOpen,
  X,
  Search,
  BookOpen,
  Calendar,
  Clock,
  Trash2,
  ExternalLink,
  Check,
  AlertTriangle,
  FileCheck,
  Cloud,
  Sigma,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { Exam } from '../types/exam';

interface ExamLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedExams: Exam[];
  currentExam: Exam | null;
  onSelectExam: (exam: Exam) => void;
  onDeleteExam: (examId: string) => Promise<void> | void;
}

export const ExamLibraryModal: React.FC<ExamLibraryModalProps> = ({
  isOpen,
  onClose,
  savedExams,
  currentExam,
  onSelectExam,
  onDeleteExam,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!isOpen) return null;

  const filteredExams = savedExams.filter((exam) => {
    if (exam.id.includes('-variant-') && exam.masterExamCode && exam.examCode !== exam.masterExamCode) {
      return false;
    }
    const matchesSearch =
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.examCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.topic && exam.topic.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGrade = selectedGrade === 'all' || exam.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteExam(examToDelete.id);
      setExamToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/30 to-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Kho Đề Thi Cloud Firebase
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {savedExams.length} đề thi
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Đồng bộ thời gian thực đa thiết bị trên nền tảng Cloud Firestore
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, mã đề, chuyên đề..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <span className="text-xs font-bold text-slate-500">Khối:</span>
            {['all', '10', '11', '12'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGrade(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  selectedGrade === g
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g === 'all' ? 'Tất cả' : `Lớp ${g}`}
              </button>
            ))}
          </div>
        </div>

        {/* Exams List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-50/50">
          {filteredExams.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-700">
                {savedExams.length === 0
                  ? 'Chưa có đề thi nào trong kho đám mây'
                  : 'Không tìm thấy đề thi phù hợp'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {savedExams.length === 0
                  ? 'Hãy soạn đề mới bằng AI Gemini bên ngoài và bấm "Lưu Lên Cloud Firebase" để lưu trữ an toàn.'
                  : 'Vui lòng thử tìm kiếm với từ khóa khác hoặc bỏ lọc khối lớp.'}
              </p>
            </div>
          ) : (
            filteredExams.map((exam) => {
              const isCurrent = currentExam?.id === exam.id;
              const mcCount = exam.multipleChoice?.length || 0;
              const tfCount = exam.trueFalseQuestions?.length || 0;
              const essayCount = exam.essays?.length || 0;

              return (
                <div
                  key={exam.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-200 shadow-sm'
                      : 'bg-white border-slate-200/90 hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                          {exam.examCode}
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          Toán {exam.grade || '12'}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang mở
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">
                          {exam.createdAt || 'Mới cập nhật'}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                        {exam.title}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {exam.durationMinutes} phút
                        </span>
                        <span>•</span>
                        <span>{exam.totalPoints || 10} điểm</span>
                        <span>•</span>
                        <span className="text-slate-700 font-semibold">
                          Phần I: {mcCount} câu TN • Phần II: {tfCount} câu Đ/S • Phần III: {essayCount} câu TL
                        </span>
                        {exam.topic && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 truncate max-w-xs">{exam.topic}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectExam(exam);
                          onClose();
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {isCurrent ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                        <span>{isCurrent ? 'Đang Xem' : 'Mở Đề Này'}</span>
                      </button>

                      {/* Nút Xóa (Icon Thùng Rác) */}
                      <button
                        type="button"
                        title="Xóa đề thi này khỏi Cloud Firebase"
                        onClick={() => setExamToDelete(exam)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>Bấm <b>"Mở Đề Này"</b> để tải vào Studio và tạo 45 mã đề kiểm tra cho học sinh.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đóng Kho Đề
          </button>
        </div>
      </div>

      {/* Confirmation Popup khi bấm nút XÓA (icon thùng rác) */}
      {examToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-lg font-black text-slate-900">
                Xác Nhận Xóa Đề Thi
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Thầy/Cô có chắc chắn muốn xóa đề thi này không?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 text-left">
                <div>Tiêu đề: <span className="text-indigo-700">{examToDelete.title}</span></div>
                <div>Mã đề: <span className="font-mono text-slate-700">{examToDelete.examCode}</span></div>
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                * Hành động này sẽ xóa vĩnh viễn đề thi khỏi Cloud Firebase và cập nhật lại danh sách tức thì.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setExamToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? 'Đang Xóa...' : 'Đồng Ý Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
