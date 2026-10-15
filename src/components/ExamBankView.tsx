import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  PlusCircle,
  Clock,
  Send,
  Share2,
  Trash2,
  Check,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { Exam, ClassGroup } from '../types/exam';

interface ExamBankViewProps {
  savedExams: Exam[];
  currentExam: Exam | null;
  classes: ClassGroup[];
  onSelectExam: (exam: Exam) => void;
  onNavigate: (tab: any) => void;
  onOpenAssignModal?: () => void;
  onDeleteExam?: (examId: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExamBankView: React.FC<ExamBankViewProps> = ({
  savedExams,
  currentExam,
  classes,
  onSelectExam,
  onNavigate,
  onOpenAssignModal,
  onDeleteExam,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<'all' | '10' | '11' | '12'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredExams = savedExams.filter((exam) => {
    // Hide internal variant children from top-level bank list to treat 1 exam session as 1 test
    if (exam.id.includes('-variant-') && exam.masterExamCode && exam.examCode !== exam.masterExamCode) {
      return false;
    }
    const matchSearch =
      (exam.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.examCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.topic || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchGrade = selectedGrade === 'all' || String(exam.grade) === selectedGrade;
    return matchSearch && matchGrade;
  });

  const handleCopyLink = (exam: Exam) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const url = `${origin}${path}?exam=${encodeURIComponent(exam.examCode)}&examId=${encodeURIComponent(exam.id)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(exam.id);
    setTimeout(() => setCopiedId(null), 2500);
    if (showToast) showToast(`Đã sao chép link phòng thi đề [${exam.examCode}]!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Ngân Hàng Đề Thi</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý toàn bộ {savedExams.length} đề thi đã lưu trên hệ thống Cloud Firebase & LocalStorage.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('create_exam')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Tạo Đề Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên đề thi, mã đề, hoặc chủ đề..."
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Grade Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Lọc:
          </span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: '10', label: 'Khối 10' },
            { id: '11', label: 'Khối 11' },
            { id: '12', label: 'Khối 12' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedGrade(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedGrade === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exam List */}
      <div className="space-y-3">
        {filteredExams.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Không tìm thấy đề thi phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Hãy thử thay đổi từ khóa tìm kiếm hoặc lọc khối lớp.</p>
          </div>
        ) : (
          filteredExams.map((exam) => {
            const isCurrent = currentExam?.id === exam.id;
            return (
              <div
                key={exam.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-200/50 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-xs">
                        {exam.examCode}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-xs">
                        Lớp {exam.grade || '11'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" /> {exam.durationMinutes || 45} phút
                      </span>
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đang chọn
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 truncate">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Chủ đề: <span className="font-semibold text-slate-700">{exam.topic || 'GDPT 2018'}</span> • {exam.multipleChoice.length} câu TN • {exam.trueFalseQuestions.length} câu Đ/S • {exam.essays.length} {exam.part3Type === 'short_answer' ? 'TL ngắn' : 'Tự luận'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectExam(exam);
                          if (showToast) showToast(`Đã kích hoạt đề thi [${exam.examCode}]!`);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer"
                      >
                        Kích Hoạt
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectExam(exam);
                        onNavigate('student_room');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Làm Thử</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(exam)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Sao chép link làm bài gửi học sinh"
                    >
                      {copiedId === exam.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedId === exam.id ? 'Đã chép' : 'Chép link'}</span>
                    </button>

                    {onOpenAssignModal && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectExam(exam);
                          onOpenAssignModal();
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Giao Lớp</span>
                      </button>
                    )}

                    {onDeleteExam && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc chắn muốn xóa đề thi "${exam.title}" (${exam.examCode})?`)) {
                            onDeleteExam(exam.id);
                          }
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        title="Xóa đề thi khỏi hệ thống"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
