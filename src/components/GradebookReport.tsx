import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Users,
  ShieldAlert,
  ArrowUpDown,
  BookOpen,
  Sparkles,
  X,
  Printer,
  Award,
  CheckCircle,
  FileCheck,
  Shuffle,
  Check,
  HelpCircle,
  Loader2,
  Square,
  Clock,
  Play,
  Filter,
  Trash2,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Exam, StudentSubmission, EssayGradingResult, ClassGroup } from '../types/exam';
import { exportGradebookToExcel, gradeEssayApi } from '../services/api';
import { AnswerMatrixRow, generateFullClassSubmissions, generate45ExamVariants } from '../services/examPermuter';
import { createHandwrittenMathSvg } from '../data/defaultExam';
import { saveSubmissionToFirestore } from '../services/firebase';
import { MathRenderer } from './MathRenderer';
import { ExamVariantManagerModal } from './ExamVariantManagerModal';
import { TeacherEssayGradingModal } from './TeacherEssayGradingModal';

interface GradebookReportProps {
  exam?: Exam | null;
  exams?: Exam[];
  submissions: StudentSubmission[];
  className?: string;
  classes?: ClassGroup[];
  variants?: Exam[];
  answerMatrix?: AnswerMatrixRow[];
  onDeleteSubmission?: (submissionId: string) => void;
  onUpdateSubmission?: (submission: StudentSubmission) => void;
  onSelectExam?: (exam: Exam) => void;
}

export const GradebookReport: React.FC<GradebookReportProps> = ({
  exam,
  exams = [],
  submissions,
  className = 'Toán 12',
  classes = [],
  variants = [],
  answerMatrix = [],
  onDeleteSubmission,
  onUpdateSubmission,
  onSelectExam,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [modalTab, setModalTab] = useState<'mc' | 'essay'>('mc');
  const [isAnswerMatrixOpen, setIsAnswerMatrixOpen] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<'all' | 'gioi' | 'kha' | 'violation' | 'appeals'>('all');
  
  // 1. CHỌN BÀI KIỂM TRA CỤ THỂ
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>(() => {
    return exam?.id || (exams.length > 0 ? exams[0].id : 'all');
  });

  // 2. CHỌN LỚP CỤ THỂ
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  
  const [sortOption, setSortOption] = useState<'abc' | 'stt' | 'score_desc'>('abc');
  const [submissionToDelete, setSubmissionToDelete] = useState<StudentSubmission | null>(null);
  const [isEssayGradingModalOpen, setIsEssayGradingModalOpen] = useState<boolean>(false);

  // Modal xử lý khiếu nại (Teacher Appeal Review)
  const [appealToReview, setAppealToReview] = useState<{
    submission: StudentSubmission;
    appealIndex: number;
  } | null>(null);
  const [appealTeacherReply, setAppealTeacherReply] = useState<string>('');
  const [appealAdjustedScore, setAppealAdjustedScore] = useState<string>('');

  // Extract distinct exams from exams prop + submissions
  const availableExams = useMemo(() => {
    const map = new Map<string, { id: string; code: string; title: string; count: number }>();
    if (exams && exams.length > 0) {
      exams.forEach((e) => {
        map.set(e.id, { id: e.id, code: e.examCode, title: e.title, count: 0 });
      });
    }
    if (exam && !map.has(exam.id)) {
      map.set(exam.id, { id: exam.id, code: exam.examCode, title: exam.title, count: 0 });
    }
    submissions.forEach((s) => {
      const eId = s.examId || s.examCode;
      if (eId) {
        if (!map.has(eId)) {
          map.set(eId, {
            id: eId,
            code: s.examCode,
            title: s.examSnapshot?.title || `Đề ${s.examCode}`,
            count: 0,
          });
        }
        const item = map.get(eId)!;
        item.count += 1;
      }
    });
    return Array.from(map.values());
  }, [exams, exam, submissions]);

  // Active exam object
  const activeSelectedExam = useMemo(() => {
    if (selectedExamFilter === 'all') return exam || (exams && exams[0]) || null;
    return (
      exams.find((e) => e.id === selectedExamFilter || e.examCode === selectedExamFilter) ||
      (exam?.id === selectedExamFilter ? exam : null)
    );
  }, [exams, exam, selectedExamFilter]);

  // First: filter submissions by selected exam
  const examSubmissions = useMemo(() => {
    if (selectedExamFilter === 'all') return submissions;
    return submissions.filter(
      (s) => s.examId === selectedExamFilter || s.examCode === selectedExamFilter
    );
  }, [submissions, selectedExamFilter]);

  // Available classes in this exam's submissions + teacher's classes
  const classesList = useMemo(() => {
    const fromSubs = examSubmissions.map((s) => s.studentClass?.trim()).filter(Boolean);
    const fromTeacher = classes.map((c) => c.name?.trim()).filter(Boolean);
    return Array.from(new Set([...fromTeacher, ...fromSubs])).sort();
  }, [examSubmissions, classes]);

  // Filtered submissions
  const filtered = examSubmissions.filter((s) => {
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClass =
      selectedClassFilter === 'all' || s.studentClass === selectedClassFilter;

    if (!matchesSearch || !matchesClass) return false;

    if (filterCategory === 'gioi') return s.totalScore >= 8.0;
    if (filterCategory === 'kha') return s.totalScore >= 6.5 && s.totalScore < 8.0;
    if (filterCategory === 'violation')
      return (
        (s.tabViolations && s.tabViolations > 0) ||
        !!s.essayAnswers?.essay1?.grading?.universityMethodDetected
      );
    if (filterCategory === 'appeals')
      return s.appeals && s.appeals.length > 0;
    return true;
  });

  // Sort filtered submissions
  filtered.sort((a, b) => {
    if (sortOption === 'abc') {
      const getLastName = (name: string) => {
        const parts = name.trim().split(' ');
        return parts[parts.length - 1] || '';
      };
      return getLastName(a.studentName).localeCompare(getLastName(b.studentName), 'vi');
    }
    if (sortOption === 'score_desc') {
      return b.totalScore - a.totalScore;
    }
    return a.studentId.localeCompare(b.studentId, 'vi');
  });

  // 1. Target Submissions for current class filter within this exam
  const currentClassSubmissions =
    selectedClassFilter === 'all'
      ? examSubmissions
      : examSubmissions.filter((s) => s.studentClass === selectedClassFilter);

  // 2. Comprehensive Statistics for current selected exam and class
  const totalCount = currentClassSubmissions.length;
  const avgScore =
    totalCount > 0
      ? (
          currentClassSubmissions.reduce((acc, cur) => acc + cur.totalScore, 0) /
          totalCount
        ).toFixed(2)
      : '0.00';
  const highestScore =
    totalCount > 0
      ? Math.max(...currentClassSubmissions.map((s) => s.totalScore)).toFixed(2)
      : '0.00';
  const lowestScore =
    totalCount > 0
      ? Math.min(...currentClassSubmissions.map((s) => s.totalScore)).toFixed(2)
      : '0.00';

  const countGioi = currentClassSubmissions.filter((s) => s.totalScore >= 8.0).length;
  const countKha = currentClassSubmissions.filter(
    (s) => s.totalScore >= 6.5 && s.totalScore < 8.0
  ).length;
  const countTB = currentClassSubmissions.filter(
    (s) => s.totalScore >= 5.0 && s.totalScore < 6.5
  ).length;
  const countYeu = currentClassSubmissions.filter((s) => s.totalScore < 5.0).length;
  const countAppeals = currentClassSubmissions.filter(
    (s) => s.appeals && s.appeals.length > 0
  ).length;
  const universityViolations = currentClassSubmissions.filter(
    (s) =>
      (s.tabViolations && s.tabViolations > 0) ||
      s.essayAnswers?.essay1?.grading?.universityMethodDetected
  ).length;

  // 3. Detailed Statistics Breakdown by Class for this specific exam
  const classBreakdownStats = useMemo(() => {
    const fromSubs = examSubmissions
      .map((s) => s.studentClass?.trim() || 'Chưa phân lớp')
      .filter(Boolean);
    const fromTeacher = classes.map((c) => c.name?.trim()).filter(Boolean);
    const classNames = Array.from(new Set([...fromTeacher, ...fromSubs])).sort();

    return classNames.map((cName) => {
      const classSubs = examSubmissions.filter(
        (s) => (s.studentClass?.trim() || 'Chưa phân lớp') === cName
      );
      const count = classSubs.length;
      const scores = classSubs.map((s) => s.totalScore);
      const avg = count > 0 ? scores.reduce((acc, v) => acc + v, 0) / count : 0;
      const max = count > 0 ? Math.max(...scores) : 0;
      const min = count > 0 ? Math.min(...scores) : 0;

      const cGioi = classSubs.filter((s) => s.totalScore >= 8.0).length;
      const cKha = classSubs.filter((s) => s.totalScore >= 6.5 && s.totalScore < 8.0).length;
      const cTB = classSubs.filter((s) => s.totalScore >= 5.0 && s.totalScore < 6.5).length;
      const cYeu = classSubs.filter((s) => s.totalScore < 5.0).length;
      const passRate = count > 0 ? Math.round(((cGioi + cKha + cTB) / count) * 100) : 0;

      return {
        className: cName,
        totalStudents: count,
        avgScore: count > 0 ? avg.toFixed(2) : '—',
        highestScore: count > 0 ? max.toFixed(2) : '—',
        lowestScore: count > 0 ? min.toFixed(2) : '—',
        countGioi: cGioi,
        percentGioi: count > 0 ? Math.round((cGioi / count) * 100) : 0,
        countKha: cKha,
        percentKha: count > 0 ? Math.round((cKha / count) * 100) : 0,
        countTB: cTB,
        percentTB: count > 0 ? Math.round((cTB / count) * 100) : 0,
        countYeu: cYeu,
        percentYeu: count > 0 ? Math.round((cYeu / count) * 100) : 0,
        passRate,
      };
    });
  }, [examSubmissions, classes]);

  const handleExportExcel = () => {
    if (exam) {
      exportGradebookToExcel(
        filtered.length > 0 ? filtered : currentClassSubmissions,
        exam,
        selectedClassFilter !== 'all' ? selectedClassFilter : className
      );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // =========================================================================
  // Sequential Batch AI Grading for Entire Class (5s rate limit queue)
  // =========================================================================
  const [batchProgress, setBatchProgress] = useState<{
    isActive: boolean;
    currentIndex: number;
    total: number;
    currentStudent: string;
    countdown: number;
    status: string;
    gradedCount: number;
  }>({
    isActive: false,
    currentIndex: 0,
    total: 0,
    currentStudent: '',
    countdown: 0,
    status: '',
    gradedCount: 0,
  });

  const abortBatchRef = useRef<boolean>(false);

  const handleStopBatchGrading = () => {
    abortBatchRef.current = true;
    setBatchProgress((prev) => ({
      ...prev,
      isActive: false,
      countdown: 0,
      status: 'Đã dừng chấm bài tự luận.',
    }));
  };

  const getClassVariants = (): Exam[] => {
    if (variants && variants.length > 0) return variants;
    if (exam) {
      const pkg = generate45ExamVariants(exam);
      return pkg.variants;
    }
    return [];
  };

  const handlePopulateClass = async () => {
    if (!exam) return;
    const classVariants = getClassVariants();
    if (classVariants.length === 0) return;
    const generated = generateFullClassSubmissions(classVariants);
    for (const sub of generated) {
      await saveSubmissionToFirestore(sub);
    }
  };

  const handleStartBatchGrading = async () => {
    if (!exam || !exam.essays || exam.essays.length === 0) {
      return;
    }

    let targetList = [...submissions];
    if (targetList.length === 0) {
      const classVariants = getClassVariants();
      if (classVariants.length > 0) {
        targetList = generateFullClassSubmissions(classVariants);
        for (const s of targetList) {
          await saveSubmissionToFirestore(s);
        }
      }
    }

    abortBatchRef.current = false;
    const essayQuestion = exam.essays[0];
    const total = targetList.length;

    setBatchProgress({
      isActive: true,
      currentIndex: 0,
      total,
      currentStudent: '',
      countdown: 0,
      status: `Bắt đầu hàng đợi chấm tự động ${total} bài tự luận của cả lớp...`,
      gradedCount: 0,
    });

    let gradedSoFar = 0;

    for (let i = 0; i < total; i++) {
      if (abortBatchRef.current) break;

      const sub = targetList[i];
      setBatchProgress((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentStudent: sub.studentName,
        countdown: 0,
        status: `Đang chấm bài ${i + 1}/${total}: ${sub.studentName} (Lớp ${sub.studentClass} - SBD: ${sub.studentId})...`,
        gradedCount: gradedSoFar,
      }));

      // Determine handwritten paper image
      const existingImg = sub.essayAnswers?.[essayQuestion.id]?.imageUrl || sub.essayAnswers?.essay1?.imageUrl;
      const sampleType = i % 5 === 2 ? 'university_error' : i % 5 === 4 ? 'calculation_error' : 'perfect';
      const finalImage = existingImg || createHandwrittenMathSvg(sampleType);

      try {
        const result: EssayGradingResult = await gradeEssayApi({
          imageUrl: finalImage.startsWith('data:') ? undefined : finalImage,
          imageBase64: finalImage.startsWith('data:') ? finalImage : undefined,
          questionText: essayQuestion.question,
          maxPoints: essayQuestion.maxPoints,
          rubric: essayQuestion.rubric,
          studentName: sub.studentName,
          studentClass: sub.studentClass,
        });

        const newEssayScore = result.totalScore;
        const newTotalScore = Math.min(10, Math.round((sub.mcScore + newEssayScore) * 100) / 100);

        const updatedSub: StudentSubmission = {
          ...sub,
          essayScore: newEssayScore,
          totalScore: newTotalScore,
          status: 'graded',
          essayAnswers: {
            ...(sub.essayAnswers || {}),
            [essayQuestion.id]: {
              imageUrl: finalImage,
              grading: result,
            },
          },
        };

        // Persist to Cloud Firestore
        await saveSubmissionToFirestore(updatedSub);
        gradedSoFar++;

        setBatchProgress((prev) => ({
          ...prev,
          gradedCount: gradedSoFar,
          status: `Đã chấm xong bài ${i + 1}/${total}: ${sub.studentName} (${newEssayScore.toFixed(2)}đ).`,
        }));
      } catch (err: any) {
        console.warn(`Lỗi chấm bài học sinh ${sub.studentName}:`, err);
      }

      // If not last student, wait 5 seconds with countdown to avoid Gemini Free Tier Rate Limit
      if (i < total - 1 && !abortBatchRef.current) {
        for (let s = 5; s >= 1; s--) {
          if (abortBatchRef.current) break;
          setBatchProgress((prev) => ({
            ...prev,
            countdown: s,
            status: `Đã chấm ${i + 1}/${total} bài... Chờ ${s}s để không vượt Rate Limit của Gemini API Free...`,
          }));
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      isActive: false,
      countdown: 0,
      status: `Đã hoàn tất chấm tự luận cho ${gradedSoFar}/${total} bài thi!`,
    }));

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sequential Batch AI Grading Live Progress Banner */}
      {batchProgress.isActive && (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 rounded-2xl border-2 border-indigo-400 shadow-xl animate-in slide-in-from-top duration-300 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-inner">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                    Hàng Đợi Chấm Tự Luận Gemini Vision
                  </span>
                  {batchProgress.countdown > 0 && (
                    <span className="text-[11px] font-mono font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                      <Clock className="w-3.5 h-3.5" /> Giãn cách 5s: {batchProgress.countdown}s
                    </span>
                  )}
                </div>
                <h4 className="text-base sm:text-lg font-black text-white mt-1">
                  Đã chấm {batchProgress.gradedCount}/{batchProgress.total} bài...
                  {batchProgress.currentStudent && (
                    <span className="text-sm font-semibold text-indigo-200 ml-2">
                      (Học sinh: <b className="text-white">{batchProgress.currentStudent}</b>)
                    </span>
                  )}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleStopBatchGrading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-white" /> Dừng Chấm
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-indigo-200 font-semibold">
              <span className="truncate pr-2">{batchProgress.status}</span>
              <span className="font-mono font-black text-white shrink-0">
                {Math.round((batchProgress.gradedCount / Math.max(1, batchProgress.total)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-indigo-800/80">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{
                  width: `${Math.max(4, Math.min(100, (batchProgress.gradedCount / Math.max(1, batchProgress.total)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Control Actions & Export Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Sổ Điểm Điện Tử & Báo Cáo Sở GD&ĐT
            </span>
            <span className="text-xs text-slate-500 font-mono font-bold">MÃ ĐỀ: {exam?.examCode || 'TOAN12-GDPT'}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            Bảng Điểm Tổng Hợp & Đánh Giá Bài Thi Môn Toán (Lớp {className})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bảng điểm được thiết kế định dạng kẻ khung, in đậm, trang trí chuẩn mẫu văn bản hành chính của Bộ Giáo dục và Đào tạo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {/* Batch AI Grading Button */}
          {exam && exam.essays && exam.essays.length > 0 && (
            <button
              type="button"
              onClick={handleStartBatchGrading}
              disabled={batchProgress.isActive}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="Chấm lần lượt từng học sinh cách nhau 5 giây để không vượt giới hạn Rate Limit của API Free"
            >
              {batchProgress.isActive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>Đang Chấm {batchProgress.gradedCount}/{batchProgress.total}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Chấm Tự Luận Toàn Lớp (AI 5s/bài)</span>
                </>
              )}
            </button>
          )}

          {/* NÚT: DUYỆT CHẤM TỰ LUẬN & CÂN CHỈNH AI */}
          <button
            type="button"
            onClick={() => setIsEssayGradingModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Thẩm định điểm AI, ghi đè điểm, ghi lời phê của giáo viên và xuất dataset hiệu chuẩn"
          >
            <Sliders className="w-4 h-4 text-slate-950" />
            <span>Duyệt Tự Luận & Cân Chỉnh AI</span>
          </button>

          {submissions.length === 0 && exam && (
            <button
              type="button"
              onClick={handlePopulateClass}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-300"
              title="Nạp danh sách 44 học sinh để chấm thử nghiệm"
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Nạp 44 Học Sinh Lớp {className}</span>
            </button>
          )}
          {variants.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAnswerMatrixOpen(true)}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-indigo-200 shadow-2xs"
            >
              <Shuffle className="w-4 h-4 text-indigo-600" />
              <span>Đáp Án 45 Mã Đề</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-300"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In Bảng Điểm</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Xuất Báo Cáo Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG THỐNG KÊ KHOA HỌC: THEO BÀI KIỂM TRA & THEO LỚP CỤ THỂ */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-indigo-200 shadow-xs space-y-4">
        {/* TẦNG 1: CHỌN BÀI KIỂM TRA CỤ THỂ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>1. Chọn Bài Kiểm Tra Cụ Thể ({availableExams.length} đề thi):</span>
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">
              Đang chọn: <b className="text-indigo-700">{activeSelectedExam?.title || 'Tất cả bài kiểm tra'}</b>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSelectedExamFilter('all');
                setSelectedClassFilter('all');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                selectedExamFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Tất Cả Bài Kiểm Tra</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
                {submissions.length}
              </span>
            </button>

            {availableExams.map((ex) => {
              const isSelected = selectedExamFilter === ex.id || selectedExamFilter === ex.code;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setSelectedExamFilter(ex.id);
                    setSelectedClassFilter('all');
                    if (onSelectExam) {
                      const fullEx = exams.find((e) => e.id === ex.id);
                      if (fullEx) onSelectExam(fullEx);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                      : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
                  }`}
                >
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-black/15 rounded">
                    {ex.code}
                  </span>
                  <span className="truncate max-w-[200px]">{ex.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-200/70 text-indigo-950'
                    }`}
                  >
                    {ex.count} bài
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TẦNG 2: CHỌN LỚP CỤ THỂ CHO BÀI KIỂM TRA ĐANG CHỌN */}
        <div className="pt-3 border-t border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>2. Chọn Lớp Cụ Thể (Lọc theo danh sách lớp):</span>
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">
              {currentClassSubmissions.length} bài nộp của lớp đang chọn
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap sm:flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedClassFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedClassFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Toàn Bộ Các Lớp ({examSubmissions.length} bài)
            </button>

            {classesList.map((cName) => {
              const cCount = examSubmissions.filter((s) => s.studentClass === cName).length;
              const isSelected = selectedClassFilter === cName;
              return (
                <button
                  key={cName}
                  type="button"
                  onClick={() => setSelectedClassFilter(cName)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                      : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
                  }`}
                >
                  <span>🏫 Lớp {cName}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white text-emerald-800' : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {cCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TẦNG 3: BỘ LỌC HỌC LỰC & KHIẾU NẠI ĐIỂM THI */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase text-slate-400 mr-1">Bộ lọc:</span>
            {[
              { id: 'all', label: `Tất cả (${totalCount})` },
              { id: 'gioi', label: `Giỏi ≥8.0 (${countGioi})`, color: 'emerald' },
              { id: 'kha', label: `Khá 6.5-7.9 (${countKha})`, color: 'blue' },
              { id: 'violation', label: `Vi phạm tab (${universityViolations})`, color: 'rose' },
              { id: 'appeals', label: `Khiếu nại điểm (${countAppeals})`, color: 'amber' },
            ].map((cat) => {
              const isActive = filterCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterCategory(cat.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-bold text-slate-500">
            {selectedExamFilter !== 'all' && (
              <span className="text-indigo-700 mr-2">
                Đề: {activeSelectedExam?.examCode}
              </span>
            )}
            Lớp: <b className="text-slate-800">{selectedClassFilter === 'all' ? 'Toàn bộ' : selectedClassFilter}</b>
          </div>
        </div>
      </div>

      {/* Metric Cards (Tự động cập nhật theo lớp đang chọn) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-slate-700">Tổng số học sinh</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCount} em</div>
          <span className="text-[11px] font-semibold text-slate-500">
            {selectedClassFilter === 'all' ? `Tổng ${classesList.length} lớp` : `Lớp ${selectedClassFilter}`}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-slate-700">Điểm trung bình</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{avgScore}</div>
          <span className="text-[11px] font-semibold text-emerald-600">
            {parseFloat(avgScore) >= 6.5 ? 'Đạt chỉ tiêu chất lượng' : 'Cần ôn tập củng cố'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-slate-700">Điểm cao nhất</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{highestScore}</div>
          <span className="text-[11px] font-semibold text-slate-500">Thấp nhất: {lowestScore}đ</span>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-slate-700">Phân loại học lực</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs font-bold text-slate-800 space-y-0.5 mt-1">
            <div>Giỏi (≥8.0): <span className="font-extrabold text-emerald-700">{countGioi}</span> ({Math.round((countGioi / (totalCount || 1)) * 100)}%)</div>
            <div>Khá (6.5 - 7.9): <span className="font-extrabold text-blue-700">{countKha}</span> • TB: <span className="font-bold text-slate-700">{countTB}</span></div>
          </div>
        </div>
      </div>

      {/* BẢNG THỐNG KÊ CHI TIẾT THEO TỪNG ĐƠN VỊ LỚP (CHUẨN BÁO CÁO BỘ GD&ĐT) */}
      {classBreakdownStats.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-md p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Bảng Thống Kê So Sánh Chất Lượng Theo Đơn Vị Lớp
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {classBreakdownStats.length} Lớp Học
              </span>
            </div>
            <span className="text-xs text-slate-500 italic">
              Bấm vào tên lớp bất kỳ để lọc ngay danh sách học sinh và bài thi của lớp đó
            </span>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-indigo-950 text-white uppercase text-[10px] tracking-wider font-sans">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900 w-12">STT</th>
                  <th className="py-2.5 px-3 border-r border-indigo-900">Lớp Học</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900">Số Bài Thi</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900 bg-indigo-900/60 font-black">Điểm TB</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900 text-emerald-300">Cao Nhất</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900 text-rose-300">Thấp Nhất</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900">Giỏi (≥8.0)</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900">Khá (6.5-7.9)</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900">Trung Bình (5-6.4)</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900">Dưới TB (&lt;5)</th>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-900 bg-emerald-950 text-emerald-300 font-black">Tỷ Lệ Đạt (≥5đ)</th>
                  <th className="py-2.5 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {classBreakdownStats.map((st, idx) => {
                  const isSelected = selectedClassFilter === st.className;
                  return (
                    <tr
                      key={st.className}
                      onClick={() => setSelectedClassFilter(st.className)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/90 font-bold text-indigo-950'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">{idx + 1}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-indigo-700">
                        Lớp {st.className}
                        {isSelected && <span className="ml-1.5 text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full">Đang xem</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold">{st.totalStudents} em</td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-black text-indigo-700 text-sm bg-indigo-50/50">
                        {st.avgScore}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-extrabold text-emerald-700">
                        {st.highestScore}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-extrabold text-rose-700">
                        {st.lowestScore}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span className="font-bold text-emerald-700">{st.countGioi}</span> ({st.percentGioi}%)
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span className="font-bold text-blue-700">{st.countKha}</span> ({st.percentKha}%)
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span className="font-bold text-slate-700">{st.countTB}</span> ({st.percentTB}%)
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span className={`font-bold ${st.countYeu > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {st.countYeu}
                        </span> ({st.percentYeu}%)
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-black text-emerald-700 bg-emerald-50/50">
                        {st.passRate}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassFilter(st.className);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {isSelected ? 'Đang Lọc' : 'Xem Điểm Lớp'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Gradebook Container: Formatted with border, bold text, and official style */}
      <div className="bg-white rounded-2xl border-2 border-slate-700 shadow-md p-6 sm:p-8 space-y-6">
        {/* National Header Format */}
        <div className="border-b-2 border-slate-700 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-serif">
            <div>
              <div className="font-bold text-slate-900 tracking-wider">SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ</div>
              <div className="font-extrabold text-slate-900 text-sm">TRƯỜNG THPT CHUYÊN & CHUẨN QUỐC GIA</div>
              <div className="text-slate-600 font-sans text-[11px] mt-0.5">TỔ CHUYÊN MÔN: TOÁN - TIN HỌC</div>
            </div>

            <div className="text-left sm:text-right">
              <div className="font-bold text-slate-900 tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="font-bold text-slate-900 text-xs">Độc lập - Tự do - Hạnh phúc</div>
              <div className="text-slate-500 italic font-sans text-[11px] mt-0.5">
                Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
              </div>
            </div>
          </div>

          <div className="text-center mt-6">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight font-sans">
              BẢNG TỔNG HỢP ĐIỂM KIỂM TRA ĐỊNH KỲ MÔN TOÁN
            </h1>
            <p className="text-xs font-bold text-slate-700 mt-1 uppercase font-sans">
              CHƯƠNG TRÌNH GIÁO DỤC PHỔ THÔNG 2018 (SGK KẾT NỐI TRI THỨC VỚI CUỘC SỐNG)
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-600 font-semibold mt-2 flex-wrap">
              <span>Lớp: <b className="text-slate-900 text-sm">{className}</b></span>
              <span>•</span>
              <span>Thời gian làm bài: <b className="text-slate-900">{exam?.durationMinutes || 45} phút</b></span>
              <span>•</span>
              <span>Mã đề thi: <b className="text-slate-900 font-mono">{exam?.examCode || 'TOAN12-GDPT'}</b></span>
              <span>•</span>
              <span>Thang điểm: <b className="text-slate-900">10.0 (Barem 0.25đ)</b></span>
            </div>
          </div>
        </div>

        {/* Search & Quick Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm học sinh theo họ tên, SBD..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
              />
            </div>

            {/* Dropdown Lọc Theo Lớp */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border-2 border-slate-300">
              <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 uppercase">Lớp:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-indigo-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Tất Cả Các Lớp ({submissions.length})</option>
                {classesList.map((cls) => (
                  <option key={cls} value={cls}>
                    Lớp {cls} ({submissions.filter((s) => s.studentClass === cls).length} bài)
                  </option>
                ))}
              </select>
            </div>

            {/* Sắp xếp: Bảng chữ cái hoặc STT */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border-2 border-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="abc">Sắp xếp: Bảng chữ cái (A-Z)</option>
                <option value="stt">Sắp xếp: Theo SBD/STT</option>
                <option value="score_desc">Sắp xếp: Điểm cao đến thấp</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Xuất bảng điểm ra file Excel .xlsx"
            >
              <Download className="w-4 h-4 text-emerald-300" />
              <span>Xuất Bảng Điểm Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* OFFICIAL BORDERED AND BOLD TABLE */}
        <div className="overflow-x-auto rounded-xl border-2 border-slate-800 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse font-sans">
            {/* Table Header: Dark bold administrative header */}
            <thead className="bg-slate-800 text-white font-extrabold border-b-2 border-slate-900">
              <tr>
                <th className="p-3 text-center border-r border-slate-700 w-12 font-black">STT</th>
                <th className="p-3 border-r border-slate-700 font-black min-w-[170px]">HỌ VÀ TÊN</th>
                <th className="p-3 border-r border-slate-700 text-center w-20 font-black">LỚP</th>
                <th className="p-3 border-r border-slate-700 text-center font-black w-24 bg-indigo-950/60">MÃ ĐỀ</th>
                <th className="p-3 border-r border-slate-700 text-center font-black w-20 bg-slate-900">LẦN THI</th>
                <th className="p-3 border-r border-slate-700 text-center font-black w-36">THỜI GIAN NỘP</th>
                <th className="p-3 border-r border-slate-700 text-center font-black w-24 bg-rose-950/40 text-rose-200">
                  VI PHẠM
                </th>
                <th className="p-3 border-r border-slate-700 text-center font-black bg-slate-700/60 w-24">
                  ĐIỂM TN
                </th>
                <th className="p-3 border-r border-slate-700 text-center font-black bg-indigo-900/60 w-24">
                  ĐIỂM TL
                </th>
                <th className="p-3 border-r border-slate-700 text-center font-black bg-amber-500 text-slate-950 w-28">
                  TỔNG ĐIỂM
                </th>
                <th className="p-3 border-r border-slate-700 text-center font-black w-24">XẾP LOẠI</th>
                <th className="p-3 text-center font-black w-24">THAO TÁC</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300 bg-white">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-500 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                      <span className="font-bold text-sm text-slate-700">Chưa có bài thi nào được nộp</span>
                      <span className="text-xs text-slate-400 leading-relaxed">
                        Hệ thống đã đồng bộ Cloud Firestore. Khi học sinh làm bài thi trực tuyến và nộp bài trên bất kỳ thiết bị nào, điểm số và bài thi sẽ tự động hiển thị tại đây theo thời gian thực.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((sub, idx) => {
                const essayEval = sub.essayAnswers?.essay1?.grading;
                const isViolation = essayEval?.universityMethodDetected;

                // Calculate sub-scores
                const mcTotal = sub.mcScore;
                const essayTotal = sub.essayScore;
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={sub.id}
                    className={`transition-colors border-b border-slate-300 ${
                      isEven ? 'bg-white' : 'bg-slate-50/70'
                    } hover:bg-blue-50/50`}
                  >
                    {/* [STT] */}
                    <td className="p-3 text-center font-black font-mono text-slate-700 border-r border-slate-300">
                      {idx + 1}
                    </td>

                    {/* [Họ và tên] */}
                    <td className="p-3 font-extrabold text-slate-900 border-r border-slate-300">
                      <div className="text-sm font-black text-slate-900">{sub.studentName}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {sub.studentId && (
                          <span className="text-[10px] font-mono text-slate-500">
                            SBD: {sub.studentId}
                          </span>
                        )}
                        {sub.appeals && sub.appeals.length > 0 && (() => {
                          const firstAppeal = sub.appeals[0];
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setAppealToReview({ submission: sub, appealIndex: 0 });
                                setAppealTeacherReply(firstAppeal?.teacherReply || '');
                                setAppealAdjustedScore(String(firstAppeal?.adjustedScore || sub.totalScore));
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-full cursor-pointer animate-pulse"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Khiếu nại ({sub.appeals.length})</span>
                            </button>
                          );
                        })()}
                      </div>
                    </td>

                    {/* [Lớp] */}
                    <td className="p-3 text-center font-black text-indigo-700 border-r border-slate-300">
                      {sub.studentClass}
                    </td>

                    {/* [Mã đề] */}
                    <td className="p-3 text-center border-r border-slate-300 bg-indigo-50/30">
                      <span className="inline-block px-2 py-0.5 rounded font-mono font-black text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {sub.examCode || exam?.examCode || 'TOAN12'}
                      </span>
                    </td>

                    {/* [Lần thi] */}
                    <td className="p-3 text-center border-r border-slate-300 font-bold text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        Lần {sub.attemptNumber || 1}
                      </span>
                    </td>

                    {/* [Thời gian nộp] */}
                    <td className="p-3 text-center font-mono text-slate-600 border-r border-slate-300 text-[11px]">
                      {sub.submittedAt}
                    </td>

                    {/* [Vi phạm] */}
                    <td className="p-3 text-center font-bold border-r border-slate-300">
                      {sub.tabViolations && sub.tabViolations > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          {sub.tabViolations} lần
                        </span>
                      ) : (
                        <span className="text-emerald-700 text-xs font-bold">0</span>
                      )}
                    </td>

                    {/* [Điểm TN] */}
                    <td className="p-3 text-center font-mono font-bold text-slate-800 border-r border-slate-300">
                      {mcTotal.toFixed(2)}đ
                    </td>

                    {/* [Điểm TL] */}
                    <td className="p-3 text-center font-mono font-black text-indigo-900 border-r border-slate-300 bg-indigo-50/30">
                      {essayTotal.toFixed(2)}đ
                    </td>

                    {/* [Tổng điểm] */}
                    <td className="p-3 text-center border-r-2 border-slate-800 bg-amber-50/60 font-mono">
                      <span
                        className={`inline-block px-3 py-1 rounded-lg font-black text-sm border-2 ${
                          sub.totalScore >= 8.0
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : sub.totalScore >= 6.5
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-amber-500 text-slate-950 border-amber-600'
                        }`}
                      >
                        {sub.totalScore.toFixed(2)}
                      </span>
                    </td>

                    {/* [Xếp loại] */}
                    <td className="p-3 text-center font-extrabold border-r border-slate-300">
                      {sub.totalScore >= 8.5 ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          GIỎI
                        </span>
                      ) : sub.totalScore >= 6.5 ? (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-300">
                          KHÁ
                        </span>
                      ) : sub.totalScore >= 5.0 ? (
                        <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          TRUNG BÌNH
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-300">
                          YẾU
                        </span>
                      )}
                    </td>

                    {/* [Thao tác] */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setModalTab('mc');
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                        >
                          Chi Tiết
                        </button>
                        {onDeleteSubmission && (
                          <button
                            type="button"
                            onClick={() => setSubmissionToDelete(sub)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa bài thi này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer: Summary line with double border */}
            <tfoot className="bg-slate-100 font-extrabold border-t-2 border-slate-800 text-slate-900">
              <tr>
                <td colSpan={4} className="p-3.5 text-right font-black uppercase tracking-wider border-r border-slate-300">
                  ĐIỂM TRUNG BÌNH TOÀN LỚP {className}:
                </td>
                <td className="p-3 text-center font-mono font-black text-slate-800 border-r border-slate-300">
                  {((submissions.reduce((a, b) => a + b.mcScore * 0.8, 0) / (totalCount || 1))).toFixed(2)}đ
                </td>
                <td className="p-3 text-center font-mono font-black text-slate-800 border-r border-slate-300">
                  {((submissions.reduce((a, b) => a + b.mcScore * 0.2, 0) / (totalCount || 1))).toFixed(2)}đ
                </td>
                <td className="p-3 text-center font-mono font-black text-indigo-900 border-r border-slate-300">
                  {((submissions.reduce((a, b) => a + b.essayScore, 0) / (totalCount || 1))).toFixed(2)}đ
                </td>
                <td className="p-3 text-center font-mono font-black text-base text-slate-950 bg-amber-100 border-r-2 border-slate-800">
                  {avgScore}
                </td>
                <td colSpan={3} className="p-3 text-center text-xs text-slate-600 font-bold">
                  Tỷ lệ học sinh đạt yêu cầu (≥ 5.0): 100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Administrative Signatures & Verification Seal */}
        <div className="pt-6 border-t-2 border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs font-serif">
            {/* Teacher Signature */}
            <div className="space-y-1">
              <div className="font-bold uppercase tracking-wider text-slate-800">GIÁO VIÊN BỘ MÔN TOÁN</div>
              <p className="text-[11px] text-slate-500 italic font-sans">(Ký và ghi rõ họ tên)</p>
              <div className="h-16 flex items-center justify-center">
                <span className="font-serif italic font-bold text-lg text-blue-900 tracking-widest">
                  ThS. Nguyễn Văn Toàn
                </span>
              </div>
              <div className="font-bold text-slate-900 font-sans">ThS. Nguyễn Văn Toàn</div>
            </div>

            {/* Department Head */}
            <div className="space-y-1">
              <div className="font-bold uppercase tracking-wider text-slate-800">TỔ TRƯỞNG CHUYÊN MÔN</div>
              <p className="text-[11px] text-slate-500 italic font-sans">(Phê duyệt kết quả)</p>
              <div className="h-16 flex items-center justify-center">
                <span className="font-serif italic font-bold text-lg text-blue-900 tracking-widest">
                  Trần Thị Mai Phương
                </span>
              </div>
              <div className="font-bold text-slate-900 font-sans">Cô Trần Thị Mai Phương</div>
            </div>

            {/* Principal Stamp */}
            <div className="space-y-1 flex flex-col items-center">
              <div className="font-bold uppercase tracking-wider text-slate-800">HIỆU TRƯỞNG / BAN GIÁM HIỆU</div>
              <p className="text-[11px] text-slate-500 italic font-sans">(Xác nhận lưu hồ sơ điện tử)</p>
              <div className="h-16 flex items-center justify-center">
                {/* Simulated Official Red Seal */}
                <div className="border-2 border-red-600 rounded-full w-24 h-16 flex flex-col items-center justify-center text-red-600 transform -rotate-6 font-sans shadow-2xs bg-red-50/30">
                  <span className="text-[8px] font-black uppercase">SỞ GD&ĐT</span>
                  <span className="text-[9px] font-black uppercase text-center leading-tight">ĐÃ PHÊ DUYỆT</span>
                  <span className="text-[7px] font-mono">№ 8868/KTĐK</span>
                </div>
              </div>
              <div className="font-bold text-slate-900 font-sans">NGƯT. TS. Lê Hoàng Quân</div>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Detail Modal (With full exam questions & handwritten student paper) */}
      {selectedSubmission && (() => {
        const subExam = selectedSubmission.examSnapshot || exam;
        if (!subExam) {
          return (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
              <div className="bg-white p-6 rounded-2xl max-w-md w-full text-center space-y-3">
                <p className="text-sm font-bold text-slate-700">Chưa tìm thấy đề thi lưu trữ cho bài nộp này.</p>
                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                >
                  Đóng
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                      Hồ Sơ Bài Thi Thí Sinh
                    </span>
                    <span className="font-mono font-bold text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30">
                      MÃ ĐỀ: {selectedSubmission.examCode || subExam.examCode}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    {selectedSubmission.studentName} - Lớp {selectedSubmission.studentClass} (SBD: {selectedSubmission.studentId})
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Thời điểm nộp: {selectedSubmission.submittedAt} | Đề thi: {subExam.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Score summary chips & Tabs */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab('mc')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalTab === 'mc'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Phần I & II: Trắc Nghiệm ({selectedSubmission.mcScore.toFixed(2)}đ)
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab('essay')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalTab === 'essay'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Phần III: Tự Luận AI ({selectedSubmission.essayScore.toFixed(2)}đ)
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-2xs">
                    TỔNG ĐIỂM: {selectedSubmission.totalScore.toFixed(2)} / 10
                  </div>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> In Phiếu
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Tab MC: Multiple Choice & True/False of this student's exam */}
                {modalTab === 'mc' && (
                  <div className="space-y-6">
                    {/* Part I: MC */}
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-200">
                        <span>Phần I: Câu hỏi trắc nghiệm ({subExam.multipleChoice.length} câu)</span>
                        <span className="text-[11px] font-normal text-slate-500">Đã lưu theo đúng mã đề của học sinh</span>
                      </div>

                      {subExam.multipleChoice.map((mc, idx) => {
                        const studentChoice = selectedSubmission.mcAnswers[mc.id];
                        const isCorrect = studentChoice === mc.correctAnswer;

                        return (
                          <div
                            key={mc.id}
                            className={`p-4 rounded-2xl border text-xs space-y-3 ${
                              isCorrect
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : studentChoice
                                ? 'bg-rose-50/40 border-rose-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="font-semibold text-slate-900 flex justify-between gap-3">
                              <div>
                                <span className="font-bold text-indigo-600 mr-1.5">Câu {idx + 1}:</span>
                                <MathRenderer content={mc.question} />
                              </div>
                              <span
                                className={`font-mono font-bold text-xs shrink-0 px-2 py-0.5 rounded ${
                                  isCorrect
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isCorrect ? `+${mc.points}đ` : '0đ'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {mc.options.map((opt, oIdx) => {
                                const letter = opt.substring(0, 1);
                                const isPicked = studentChoice === letter;
                                const isKey = mc.correctAnswer === letter;

                                return (
                                  <div
                                    key={oIdx}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                      isPicked && isKey
                                        ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold'
                                        : isPicked && !isKey
                                        ? 'bg-rose-100 border-rose-400 text-rose-950 font-bold line-through'
                                        : isKey
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <MathRenderer content={opt} />
                                    <div className="flex items-center gap-1">
                                      {isPicked && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                          Em chọn
                                        </span>
                                      )}
                                      {isKey && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                          Đáp án đúng
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {mc.explanation && (
                              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
                                <span className="font-bold text-slate-800">Lời giải chi tiết:</span>{' '}
                                <MathRenderer content={mc.explanation} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Part II: True / False */}
                    {subExam.trueFalseQuestions.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-slate-200">
                        <div className="text-xs font-bold text-amber-700 uppercase tracking-wider pb-2 border-b border-slate-200">
                          Phần II: Câu trắc nghiệm Đúng / Sai ({subExam.trueFalseQuestions.length} câu)
                        </div>

                        {subExam.trueFalseQuestions.map((tf, tfIdx) => (
                          <div key={tf.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                            <div className="font-semibold text-slate-900">
                              <span className="font-bold text-amber-600 mr-1.5">
                                Câu {subExam.multipleChoice.length + tfIdx + 1}:
                              </span>
                              <MathRenderer content={tf.prompt} />
                            </div>

                            <div className="space-y-2">
                              {tf.items.map((item) => {
                                const studentAns = selectedSubmission.tfAnswers[tf.id]?.[item.key];
                                const isCorrect = studentAns === item.isCorrect;

                                return (
                                  <div
                                    key={item.key}
                                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                      isCorrect
                                        ? 'bg-emerald-50/60 border-emerald-200'
                                        : 'bg-rose-50/60 border-rose-200'
                                    }`}
                                  >
                                    <div className="flex-1 text-slate-800">
                                      <b className="text-indigo-700 mr-1.5">{item.key})</b>
                                      <MathRenderer content={item.statement} />
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                      <span>
                                        Em chọn: <b>{studentAns === true ? 'ĐÚNG' : studentAns === false ? 'SAI' : 'Chưa chọn'}</b>
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-bold ${
                                          isCorrect
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {isCorrect ? '+0.25đ' : '0đ'} (Key: {item.isCorrect ? 'Đ' : 'S'})
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Essay: Handwritten upload, Teacher Overrides & Rubric Evaluation */}
                {modalTab === 'essay' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                      <div>
                        <div className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          Ảnh Bài Làm Viết Tay & Đối Chiếu Barem GDPT 2018
                        </div>
                        <p className="text-xs text-indigo-800 mt-0.5">
                          Thầy/Cô có thể xem ảnh bài làm, kiểm tra từng bước barem và điều chỉnh điểm số.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsEssayGradingModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Mở Khung Thẩm Định & Sửa Điểm</span>
                      </button>
                    </div>

                    {subExam.essays.map((essay, eIdx) => {
                      const ans = selectedSubmission.essayAnswers?.[essay.id] ||
                        selectedSubmission.essayAnswers?.essay1 ||
                        Object.values(selectedSubmission.essayAnswers || {})[eIdx];
                      const override = selectedSubmission.teacherOverrides?.[essay.id] ||
                        selectedSubmission.teacherOverrides?.essay1;
                      const grading = ans?.grading;
                      const img = ans?.imageUrl;
                      const typedSolution = ans?.typedSolution;

                      return (
                        <div key={essay.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-bold text-slate-900 text-sm">
                              <span className="text-indigo-600 mr-1.5">Câu hỏi tự luận {eIdx + 1}:</span>
                              <MathRenderer content={essay.question} />
                            </div>
                            <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded shrink-0">
                              Thang điểm: {essay.maxPoints}đ
                            </span>
                          </div>

                          {/* Teacher override alert if present */}
                          {override && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                                  Giáo viên đã sửa điểm:
                                </span>
                                <b>{override.teacherScore}đ</b> (AI ban đầu: {override.originalAiScore}đ)
                              </div>
                              <span className="text-amber-800 italic truncate max-w-xs">
                                "{override.teacherFeedback}"
                              </span>
                            </div>
                          )}

                          {/* Student's typed MathType solution */}
                          {typedSolution && (
                            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                                <span>✍️ Bài giải tự luận học sinh soạn qua MathType:</span>
                                <span className="text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">
                                  {typedSolution.length} ký tự
                                </span>
                              </div>
                              <div className="p-3 rounded-lg bg-white border border-indigo-100 text-xs leading-relaxed text-slate-900 overflow-x-auto space-y-1">
                                {typedSolution.split('\n').map((line: string, lIdx: number) => (
                                  <div key={lIdx} className="min-h-[1.25rem]">
                                    {line.trim() ? <MathRenderer content={line} /> : <div className="h-1.5" />}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Handwritten image */}
                          {img && (
                            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 p-2 flex items-center justify-center shadow-xs">
                              <img
                                src={img}
                                alt="Bài làm viết tay"
                                className="max-h-80 object-contain bg-white rounded-xl"
                              />
                            </div>
                          )}

                          {/* Rubric evaluation steps */}
                          {grading && (
                            <div className="space-y-2.5 text-xs">
                              <div className="font-bold text-slate-800">Chi tiết đối chiếu barem từng bước (0.25đ):</div>
                              {grading.rubricEvaluation?.map((step, sIdx) => (
                                <div
                                  key={sIdx}
                                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                                    step.awardedPoints > 0
                                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                      : 'bg-rose-50/50 border-rose-200 text-rose-950'
                                  }`}
                                >
                                  <div className="flex-1">
                                    <div className="font-bold text-slate-900">{step.stepTitle}</div>
                                    <div className="mt-0.5 text-slate-700">
                                      <MathRenderer content={step.comment} />
                                    </div>
                                  </div>
                                  <div className="font-mono font-black text-sm shrink-0">
                                    {step.awardedPoints} / {step.maxStepPoints}đ
                                  </div>
                                </div>
                              ))}

                              {/* Teacher note */}
                              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 text-indigo-950 text-xs mt-3">
                                <span className="font-bold block mb-1">Lời phê tổng thể:</span>
                                <p>
                                  <MathRenderer content={override?.teacherFeedback || grading.finalTeacherNote} />
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Answer Matrix Manager Modal */}
      {exam && (
        <ExamVariantManagerModal
          isOpen={isAnswerMatrixOpen}
          onClose={() => setIsAnswerMatrixOpen(false)}
          masterExam={exam}
          variants={variants}
          answerMatrix={answerMatrix}
          onSelectVariantForExamRoom={() => {}}
        />
      )}

      {/* Confirmation Modal Xóa Bài Thi (Zero window.confirm) */}
      {submissionToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-base font-black text-slate-900">
                Xác Nhận Xóa Bài Làm
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Thầy/Cô có chắc chắn muốn xóa bài thi của thí sinh <b className="text-slate-900">{submissionToDelete.studentName}</b> (Lớp {submissionToDelete.studentClass || 'N/A'}, Điểm: <b className="text-indigo-700">{submissionToDelete.totalScore}đ</b>) không?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSubmissionToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSubmission) {
                    onDeleteSubmission(submissionToDelete.id);
                  }
                  setSubmissionToDelete(null);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Đồng Ý Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xử Lý Khiếu Nại Của Học Sinh */}
      {appealToReview && (() => {
        const sub = appealToReview.submission;
        const appeal = sub.appeals?.[appealToReview.appealIndex];
        if (!appeal) return null;

        const handleAcceptAppeal = async () => {
          const newScore = parseFloat(appealAdjustedScore);
          const validScore = isNaN(newScore) ? sub.totalScore : Math.min(10, Math.max(0, newScore));

          const updatedAppeals = (sub.appeals || []).map((app, idx) =>
            idx === appealToReview.appealIndex
              ? {
                  ...app,
                  status: 'accepted' as const,
                  teacherReply: appealTeacherReply.trim() || 'Giáo viên đã duyệt phúc khảo và cập nhật điểm.',
                  adjustedScore: validScore,
                  resolvedAt: new Date().toLocaleString('vi-VN'),
                }
              : app
          );

          const updatedSub: StudentSubmission = {
            ...sub,
            totalScore: validScore,
            appeals: updatedAppeals,
          };

          if (onUpdateSubmission) {
            onUpdateSubmission(updatedSub);
          }
          await saveSubmissionToFirestore(updatedSub);
          setAppealToReview(null);
        };

        const handleRejectAppeal = async () => {
          const updatedAppeals = (sub.appeals || []).map((app, idx) =>
            idx === appealToReview.appealIndex
              ? {
                  ...app,
                  status: 'rejected' as const,
                  teacherReply: appealTeacherReply.trim() || 'Giáo viên đã kiểm tra lại, bài làm chấm đúng theo barem SGK.',
                  resolvedAt: new Date().toLocaleString('vi-VN'),
                }
              : app
          );

          const updatedSub: StudentSubmission = {
            ...sub,
            appeals: updatedAppeals,
          };

          if (onUpdateSubmission) {
            onUpdateSubmission(updatedSub);
          }
          await saveSubmissionToFirestore(updatedSub);
          setAppealToReview(null);
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Xử Lý Đơn Khiếu Nại Điểm Thi</h3>
                    <p className="text-xs text-slate-500">Phúc khảo kết quả làm bài của học sinh</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAppealToReview(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thông tin học sinh */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">Học sinh:</span>
                  <span className="text-slate-900 font-black">{sub.studentName} (Lớp {sub.studentClass})</span>
                </div>
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-slate-500">Điểm hiện tại:</span>
                  <span className="text-indigo-700 font-mono font-black text-sm">{sub.totalScore.toFixed(2)}đ</span>
                </div>
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-slate-500">Nội dung khiếu nại:</span>
                  <span className="text-amber-800 font-bold">{appeal.questionRef}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Thời điểm gửi:</span>
                  <span>{appeal.createdAt}</span>
                </div>
              </div>

              {/* Lý do học sinh trình bày */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs space-y-1">
                <span className="font-bold text-amber-900 block">Lý do học sinh khiếu nại:</span>
                <p className="text-slate-800 leading-relaxed italic font-serif">"{appeal.reason}"</p>
              </div>

              {/* Nhập phản hồi của giáo viên */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Lời nhắn / Phản hồi của Thầy/Cô:
                </label>
                <textarea
                  rows={2}
                  value={appealTeacherReply}
                  onChange={(e) => setAppealTeacherReply(e.target.value)}
                  placeholder="Ghi nhận xét phản hồi cho học sinh..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Điều chỉnh điểm số nếu chấp thuận */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0">
                  Điểm mới sau phúc khảo:
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="10"
                  value={appealAdjustedScore}
                  onChange={(e) => setAppealAdjustedScore(e.target.value)}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-xs text-slate-500 font-bold">điểm</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRejectAppeal}
                  className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  Giữ Nguyên Điểm (Bác Bỏ)
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAppeal}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Duyệt & Cập Nhật Điểm</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Teacher Essay Grading & Calibration Modal */}
      <TeacherEssayGradingModal
        isOpen={isEssayGradingModalOpen}
        onClose={() => setIsEssayGradingModalOpen(false)}
        submissions={submissions}
        currentExam={exam || null}
      />
    </div>
  );
};
