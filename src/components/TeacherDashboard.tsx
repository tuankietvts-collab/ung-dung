import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  FileText,
  Users,
  Building,
  FolderOpen,
  Share2,
  Shuffle,
  Download,
  Check,
  CheckCircle2,
  CloudUpload,
  Trash2,
  Plus,
  Search,
  Filter,
  GraduationCap,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Exam, StudentSubmission, StudentRosterItem, ClassGroup, TeacherProfile } from '../types/exam';
import { TeacherExamStudio } from './TeacherExamStudio';
import { GradebookReport } from './GradebookReport';
import { ClassManagementModal } from './ClassManagementModal';
import { DocumentExamStudio } from './DocumentExamStudio';
import { TeacherEssayGradingModal } from './TeacherEssayGradingModal';
import { exportGradebookToExcel } from '../services/api';
import { AnswerMatrixRow } from '../services/examPermuter';

interface TeacherDashboardProps {
  currentExam: Exam | null;
  savedExams: Exam[];
  submissions: StudentSubmission[];
  roster: StudentRosterItem[];
  classes: ClassGroup[];
  teacherProfile?: TeacherProfile | null;
  onExamCreated: (newExam: Exam) => void;
  onSelectSavedExam: (exam: Exam) => void;
  onDeleteSubmission?: (submissionId: string) => void;
  onSaveClass: (cls: ClassGroup) => Promise<void>;
  onDeleteClass: (classId: string) => Promise<void>;
  onSaveRoster: (students: StudentRosterItem[]) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  onSaveExamToCloud?: (exam: Exam) => Promise<void>;
  onDeleteExamFromCloud?: (examId: string) => Promise<void>;
  onGenerate45Variants?: () => void;
  variants?: Exam[];
  answerMatrix?: AnswerMatrixRow[];
  isCloudSaving?: boolean;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSwitchToStudentView?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentExam,
  savedExams,
  submissions,
  roster,
  classes,
  teacherProfile,
  onExamCreated,
  onSelectSavedExam,
  onDeleteSubmission,
  onSaveClass,
  onDeleteClass,
  onSaveRoster,
  onDeleteStudent,
  onSaveExamToCloud,
  onDeleteExamFromCloud,
  onGenerate45Variants,
  variants = [],
  answerMatrix = [],
  isCloudSaving = false,
  showToast,
  onSwitchToStudentView,
}) => {
  // Main Dashboard Tab: 'studio' (Soạn đề AI) | 'document' (Tải file đề thi) | 'gradebook' (Bảng thống kê kết quả)
  const [dashboardTab, setDashboardTab] = useState<'studio' | 'document' | 'gradebook'>('studio');

  // Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState<boolean>(false);
  const [isEssayGradingModalOpen, setIsEssayGradingModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [selectedClassForLink, setSelectedClassForLink] = useState<string>(
    classes.length > 0 ? classes[0].name : '12A1'
  );

  // Sync selectedClassForLink when classes change
  useEffect(() => {
    if (classes.length > 0 && !classes.some((c) => c.name === selectedClassForLink)) {
      setSelectedClassForLink(classes[0].name);
    }
  }, [classes, selectedClassForLink]);

  // Link copy logic with class param
  const handleCopyExamLink = (clsName?: string) => {
    if (!currentExam) {
      if (showToast) showToast('Chưa có đề thi nào được kích hoạt để sao chép link.', 'error');
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const effectiveClass = clsName || selectedClassForLink;
    const url = `${origin}${path}?exam=${encodeURIComponent(currentExam.examCode)}&examId=${encodeURIComponent(currentExam.id)}&class=${encodeURIComponent(effectiveClass)}`;

    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    if (showToast) {
      showToast(`Đã sao chép link phòng thi gắn với lớp ${effectiveClass}: ${url}`);
    }
  };

  // Export Excel
  const handleExportGradebook = () => {
    if (submissions.length === 0) {
      if (showToast) showToast('Chưa có bài thi nào được nộp để xuất bảng điểm.', 'info');
      return;
    }
    exportGradebookToExcel(
      submissions,
      currentExam,
      selectedClassForLink || (currentExam ? `Toán ${currentExam.grade}` : 'Toán 11')
    );
    if (showToast) showToast('Đã xuất bảng điểm chuẩn form sư phạm Bộ GD&ĐT (.xlsx)!');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* TOP TEACHER WORKSPACE TOOLBAR */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: View Tabs Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setDashboardTab('studio')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              dashboardTab === 'studio'
                ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Soạn Đề AI GDPT 2018</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('document')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              dashboardTab === 'document'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Đọc File Đa Định Dạng (.docx, .xlsx, .pdf, ảnh)</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('gradebook')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              dashboardTab === 'gradebook'
                ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Bảng Thống Kê & Sổ Điểm ({submissions.length})</span>
          </button>

          {currentExam && (
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate max-w-xs">Đang mở: <b className="text-indigo-700">{currentExam.title}</b> ({currentExam.examCode})</span>
            </div>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* NÚT: QUẢN LÝ LỚP HỌC */}
          <button
            type="button"
            onClick={() => setIsClassModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-extrabold text-xs rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Tạo lớp học mới và quản lý danh sách học sinh theo lớp"
          >
            <Building className="w-4 h-4 text-indigo-600" />
            <span>Quản Lý Lớp Học ({classes.length})</span>
          </button>

          {/* NÚT: DS HỌC SINH */}
          <button
            type="button"
            onClick={() => setIsClassModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Xem và nhập danh sách học sinh từ Excel/CSV"
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>DS Học Sinh ({roster.length})</span>
          </button>

          {/* NÚT: SAO CHÉP LINK PHÁT ĐỀ KÈM LỚP */}
          {currentExam && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <select
                value={selectedClassForLink}
                onChange={(e) => setSelectedClassForLink(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
              >
                {classes.map((cls) => (
                  <option key={cls.id || cls.name} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleCopyExamLink()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Sao chép link làm bài gửi cho học sinh làm trên điện thoại/máy tính"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Đã chép link!' : 'Gửi link vào thi'}</span>
              </button>
            </div>
          )}

          {/* NÚT: DUYỆT CHẤM TỰ LUẬN & CÂN CHỈNH AI */}
          <button
            type="button"
            onClick={() => setIsEssayGradingModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 hover:from-indigo-700 hover:to-indigo-950 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Duyệt bài chấm tự luận, điều chỉnh điểm số của AI, thêm nhận xét sư phạm và cân chỉnh mô hình"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Duyệt Tự Luận & Cân Chỉnh AI</span>
          </button>

          {/* NÚT: XUẤT BẢNG ĐIỂM EXCEL (.XLSX) */}
          <button
            type="button"
            onClick={handleExportGradebook}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Xuất bảng điểm ra file Excel .xlsx chuẩn mẫu sư phạm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Xuất Bảng Điểm Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD TAB CONTENT */}
      {dashboardTab === 'studio' ? (
        <TeacherExamStudio
          currentExam={currentExam}
          savedExams={savedExams}
          roster={roster}
          currentTeacher={teacherProfile || null}
          onExamCreated={onExamCreated}
          onSelectSavedExam={onSelectSavedExam}
          onSaveExamToCloud={onSaveExamToCloud}
          onDeleteExamFromCloud={onDeleteExamFromCloud}
          onGenerate45Variants={onGenerate45Variants}
          variants={variants}
          isCloudSaving={isCloudSaving}
          showToast={showToast}
          onSwitchToStudentView={onSwitchToStudentView}
        />
      ) : dashboardTab === 'document' ? (
        <DocumentExamStudio
          onExamCreated={(exam) => {
            onExamCreated(exam);
            onSelectSavedExam(exam);
          }}
          onOpenExamRoom={(exam) => {
            onSelectSavedExam(exam);
            if (onSwitchToStudentView) onSwitchToStudentView();
          }}
          showToast={showToast}
        />
      ) : (
        <GradebookReport
          exam={currentExam}
          submissions={submissions}
          className={selectedClassForLink}
          variants={variants}
          answerMatrix={answerMatrix}
          onDeleteSubmission={onDeleteSubmission}
        />
      )}

      {/* MODAL: QUẢN LÝ LỚP HỌC & DANH SÁCH HỌC SINH */}
      <ClassManagementModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        classes={classes}
        roster={roster}
        currentExam={currentExam}
        savedExams={savedExams}
        onSaveClass={onSaveClass}
        onDeleteClass={onDeleteClass}
        onSaveRoster={onSaveRoster}
        onDeleteStudent={onDeleteStudent}
        showToast={showToast}
      />

      {/* MODAL: DUYỆT CHẤM TỰ LUẬN, GHI ĐÈ ĐIỂM & HIỆU CHUẨN PROMPT */}
      <TeacherEssayGradingModal
        isOpen={isEssayGradingModalOpen}
        onClose={() => setIsEssayGradingModalOpen(false)}
        submissions={submissions}
        currentExam={currentExam}
        teacherName={teacherProfile?.fullName || 'Giáo viên bộ môn Toán'}
        showToast={showToast}
      />

    </div>
  );
};
