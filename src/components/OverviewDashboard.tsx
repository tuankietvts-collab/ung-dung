import React from 'react';
import {
  BookOpen,
  Users,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Send,
  Share2,
  Check,
  PlusCircle,
  FileText,
  Clock,
  Layers,
  Award,
  CheckCircle2
} from 'lucide-react';
import { Exam, StudentSubmission, StudentRosterItem, ClassGroup, AppUser } from '../types/exam';

interface OverviewDashboardProps {
  currentExam: Exam | null;
  savedExams: Exam[];
  submissions: StudentSubmission[];
  roster: StudentRosterItem[];
  classes: ClassGroup[];
  currentUser: AppUser | null;
  onNavigate: (tab: any) => void;
  onSelectExam: (exam: Exam) => void;
  onOpenAssignModal?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  currentExam,
  savedExams,
  submissions,
  roster,
  classes,
  currentUser,
  onNavigate,
  onSelectExam,
  onOpenAssignModal,
  showToast,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const masterExams = React.useMemo(() => {
    return savedExams.filter((e) => !e.id.includes('-variant-') && (!e.masterExamCode || e.examCode === e.masterExamCode));
  }, [savedExams]);

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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 sm:p-8 shadow-md">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Nền tảng kiểm tra & Chấm tự luận AI • GDPT 2018</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            Xin chào, {currentUser?.fullName || 'Thầy Cô'}! 👋
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Hệ thống hỗ trợ tạo đề thi chuẩn cấu trúc Bộ GD&ĐT, tổ chức phòng thi trực tuyến với bàn phím công thức MathLive WYSIWYG, và tự động chấm bài tự luận qua ảnh bằng Gemini AI.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => onNavigate('create_exam')}
              className="px-4 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-blue-50 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              <span>Tạo Đề Thi Mới</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('student_room')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 text-white border border-white/20 font-black text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <GraduationCap className="w-4 h-4 text-amber-300" />
              <span>Vào Phòng Thi Trực Tuyến</span>
            </button>
          </div>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden md:flex items-center justify-center">
          <div className="w-64 h-64 rounded-full border-8 border-white" />
        </div>
      </div>

      {/* 4 Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Đề thi đã lưu */}
        <div
          onClick={() => onNavigate('exam_bank')}
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ngân hàng đề thi</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">{masterExams.length}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>Xem & kích hoạt bộ đề</span>
            <ArrowRight className="w-3 h-3 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Lớp học & Sĩ số */}
        <div
          onClick={() => onNavigate('classes')}
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Lớp học & Sĩ số</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">
            {classes.length} <span className="text-sm font-semibold text-slate-400">lớp</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>{roster.length} học sinh trong danh sách</span>
          </div>
        </div>

        {/* Card 3: Lượt bài nộp */}
        <div
          onClick={() => onNavigate('gradebook')}
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bài thi đã nộp</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">{submissions.length}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>Xem phổ điểm & báo cáo</span>
            <ArrowRight className="w-3 h-3 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Đề đang kích hoạt */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Đề đang mở</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-base font-black text-indigo-700 truncate mb-1" title={currentExam?.title}>
            {currentExam?.title || 'Chưa chọn'}
          </div>
          <div className="text-xs text-slate-500">
            Mã: <b className="font-mono text-slate-700">{currentExam?.examCode || 'N/A'}</b> ({currentExam?.durationMinutes || 45}p)
          </div>
        </div>
      </div>

      {/* Danh Sách Đề Thi Gần Đây */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Đề Thi Đang Quản Lý ({masterExams.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chọn đề để kích hoạt cho học sinh vào thi hoặc giao cho lớp học cụ thể.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('create_exam')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Tạo Đề Mới</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {masterExams.slice(0, 5).map((exam) => {
            const isCurrent = currentExam?.id === exam.id;
            return (
              <div
                key={exam.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isCurrent ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-xs">
                      {exam.examCode}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                      Khối {exam.grade || '11'}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {exam.durationMinutes || 45} phút
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đang kích hoạt
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {exam.title}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {exam.multipleChoice.length} câu TN • {exam.trueFalseQuestions.length} câu Đ/S • {exam.essays.length} {exam.part3Type === 'short_answer' ? 'câu trả lời ngắn' : 'câu tự luận'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {!isCurrent ? (
                    <button
                      type="button"
                      onClick={() => onSelectExam(exam)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      Kích Hoạt
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      onSelectExam(exam);
                      onNavigate('student_room');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Làm Thử</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(exam)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="Sao chép link làm bài"
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
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Giao Lớp</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {savedExams.length > 5 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('exam_bank')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Xem toàn bộ {savedExams.length} đề trong ngân hàng</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
