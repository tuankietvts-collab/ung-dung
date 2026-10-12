import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  User,
  GraduationCap,
  Send,
  CheckCircle2,
  Sparkles,
  Trophy,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Lock,
  Timer,
  BellRing,
  FastForward,
  Check,
  ShieldAlert,
  Printer,
  ChevronRight,
  ListChecks,
  HelpCircle,
  Camera,
  ArrowRight,
  FileText,
  FileCheck,
  Search,
  Eye,
  X,
  XCircle,
  MessageSquarePlus,
  RefreshCw,
  FolderKanban,
  CheckCircle,
  History
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Exam, StudentSubmission, EssayGradingResult, StudentRosterItem, AppUser } from '../types/exam';
import { StudentEssayUpload } from './StudentEssayUpload';
import { MathRenderer } from './MathRenderer';
import { QuestionVisual } from './QuestionVisual';
import { MathFormulaEditor } from './MathFormulaEditor';
import { MathLiveField } from './MathLiveField';
import { isInvalidStudentName } from '../services/studentRosterParser';
import { sanitizeExamQuestions } from '../services/examPermuter';
import { submitStudentAppeal } from '../services/firebase';

// Helper for mathematical answer comparison (supports LaTeX \frac, decimals, intervals, expressions)
const isMathShortAnswerCorrect = (studentAns: string, key: string): boolean => {
  if (!studentAns || !key) return false;
  const sRaw = studentAns.trim();
  const kRaw = key.trim();
  if (sRaw.toLowerCase() === kRaw.toLowerCase()) return true;

  // Normalize LaTeX expressions
  const normalize = (str: string) => {
    return str
      .replace(/^\$+|\$+$/g, '') // remove leading/trailing $
      .replace(/\\left|\\right/g, '') // remove \left, \right
      .replace(/\\,/g, '') // remove thin space
      .replace(/\\;/g, ';') // semicolon
      .replace(/\\quad|\\qquad/g, '')
      .replace(/\\displaystyle/g, '')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\mathrm\{([^}]+)\}/g, '$1')
      .replace(/\\mathbf\{([^}]+)\}/g, '$1')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2') // \frac{a}{b} -> a/b
      .replace(/\s+/g, '') // strip whitespace
      .toLowerCase();
  };

  const normS = normalize(sRaw);
  const normK = normalize(kRaw);
  if (normS === normK) return true;

  // Check with comma vs dot decimal in numbers (e.g. 0,5 vs 0.5)
  const dotS = normS.replace(/,/g, '.');
  const dotK = normK.replace(/,/g, '.');
  if (dotS === dotK) return true;

  // Numeric equivalence check (e.g. 1/2 == 0.5 or 0.5 == 1/2)
  const parseNumeric = (str: string): number | null => {
    const fracMatch = str.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (fracMatch) {
      const num = parseFloat(fracMatch[1]);
      const den = parseFloat(fracMatch[2]);
      if (den !== 0) return num / den;
    }
    const val = parseFloat(str);
    return isNaN(val) ? null : val;
  };

  const valS = parseNumeric(dotS);
  const valK = parseNumeric(dotK);
  if (valS !== null && valK !== null) {
    return Math.abs(valS - valK) < 0.0001;
  }

  return false;
};

interface StudentExamRoomProps {
  exam: Exam | null;
  savedExams?: Exam[];
  submissions?: StudentSubmission[];
  currentUser?: AppUser | null;
  variants?: Exam[];
  roster?: StudentRosterItem[];
  onSelectExam?: (exam: Exam) => void;
  onSelectVariant?: (variant: Exam) => void;
  onSubmit: (submission: StudentSubmission) => void;
  onViewGradebook: () => void;
  onGoToTeacher?: () => void;
  backendUrl?: string;
  onOpenAuthModal?: () => void;
}

export const StudentExamRoom: React.FC<StudentExamRoomProps> = ({
  exam: rawExam,
  savedExams = [],
  submissions = [],
  currentUser,
  variants = [],
  roster = [],
  onSelectExam,
  onSelectVariant,
  onSubmit,
  onViewGradebook,
  onGoToTeacher,
  backendUrl = '',
  onOpenAuthModal,
}) => {
  const exam = React.useMemo(() => (rawExam ? sanitizeExamQuestions(rawExam) : null), [rawExam]);
  // Check URL parameters for direct link access
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialName = urlParams?.get('student') || urlParams?.get('name') || currentUser?.fullName || '';
  const initialClass = urlParams?.get('class') || urlParams?.get('lop') || currentUser?.className || '';
  const initialSbd = urlParams?.get('sbd') || urlParams?.get('id') || currentUser?.sbd || currentUser?.username || '';

  // Student Info & Official Entry State
  const [studentName, setStudentName] = useState<string>(initialName);
  const [studentClass, setStudentClass] = useState<string>(initialClass);
  const [studentId, setStudentId] = useState<string>(initialSbd);

  // Sync if currentUser changes
  useEffect(() => {
    if (currentUser && currentUser.role === 'student') {
      if (currentUser.fullName) setStudentName(currentUser.fullName);
      if (currentUser.className) setStudentClass(currentUser.className);
      if (currentUser.sbd || currentUser.username) setStudentId(currentUser.sbd || currentUser.username);
    }
  }, [currentUser]);

  // Tab mode for Student Portal: 'exam' (doing exam) or 'dashboard' (viewing assigned exams list)
  const [studentPortalTab, setStudentPortalTab] = useState<'exam' | 'assigned_list'>('exam');
  const [isExamStarted, setIsExamStarted] = useState<boolean>(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isEditInfoOpen, setIsEditInfoOpen] = useState<boolean>(false);
  const [isNameInputFocused, setIsNameInputFocused] = useState<boolean>(false);
  const [rosterFilter, setRosterFilter] = useState<string>('');

  // Anti-cheat & Tab switch surveillance
  const [tabViolations, setTabViolations] = useState<number>(0);
  const [showViolationWarning, setShowViolationWarning] = useState<boolean>(false);
  const examStartTimeRef = useRef<string>('');

  // Active exam code (can be variant code)
  const [assignedExamCode, setAssignedExamCode] = useState<string>(exam?.examCode || '');

  // Answers State
  const [mcAnswers, setMcAnswers] = useState<Record<string, string>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<string, Record<string, boolean | null>>>({});
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({});

  // Detect whether Part 3 is short answer or essay from exam structure
  const initialPart3Type =
    exam?.part3Type ||
    (exam?.essays?.length && exam.essays.every((e) => e.type === 'short_answer')
      ? 'short_answer'
      : 'essay');

  const [part3Mode, setPart3Mode] = useState<'short_answer' | 'essay'>(initialPart3Type);
  const [essayGradingData, setEssayGradingData] = useState<
    Record<string, {
      imageUrl?: string;
      imageUrls?: string[];
      typedSolution?: string;
      submissionType?: 'image' | 'typed' | 'both';
      grading?: EssayGradingResult;
    }>
  >({});

  // Countdown Timer State
  const durationMinutes = exam?.durationMinutes && exam.durationMinutes > 0 ? exam.durationMinutes : 45;
  const initialSeconds = durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState<number>(initialSeconds);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState<boolean>(false);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState<boolean>(false);
  const [submissionTime, setSubmissionTime] = useState<string>('');
  const [showDetailedSolutions, setShowDetailedSolutions] = useState<boolean>(false);

  // Active question highlight state
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  // Mobile Floating Grid Drawer State
  const [isMobileQuestionGridOpen, setIsMobileQuestionGridOpen] = useState<boolean>(false);

  // Submission State
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [calculatedScore, setCalculatedScore] = useState<{
    mc: number;
    tf: number;
    essay: number;
    total: number;
  } | null>(null);

  // Last submitted object for appeal reference
  const [activeSubmission, setActiveSubmission] = useState<StudentSubmission | null>(null);

  // Appeal Modal State
  const [isAppealModalOpen, setIsAppealModalOpen] = useState<boolean>(false);
  const [appealQuestionRef, setAppealQuestionRef] = useState<string>('Điểm toàn bài');
  const [appealReason, setAppealReason] = useState<string>('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState<boolean>(false);
  const [appealSuccessMsg, setAppealSuccessMsg] = useState<string | null>(null);

  // Count past attempts by this student for the active exam
  const myPastSubmissionsForExam = React.useMemo(() => {
    if (!exam) return [];
    const effectiveName = studentName.trim().toLowerCase();
    const effectiveId = studentId.trim().toLowerCase();
    return submissions.filter((s) => {
      const matchExam = s.examId === exam.id || s.examCode === exam.examCode;
      const matchStudent =
        (effectiveName && s.studentName.trim().toLowerCase() === effectiveName) ||
        (effectiveId && s.studentId.trim().toLowerCase() === effectiveId);
      return matchExam && matchStudent;
    });
  }, [submissions, exam, studentName, studentId]);

  const pastAttemptsCount = myPastSubmissionsForExam.length;
  const currentAttemptNumber = pastAttemptsCount + 1;
  const maxAllowedAttempts = exam?.maxAttempts !== undefined ? exam.maxAttempts : 1; // 0 = unlimited
  const isAttemptsExceeded = maxAllowedAttempts > 0 && pastAttemptsCount >= maxAllowedAttempts;

  // Local storage key for preserving student progress across accidental exits / refreshes
  const progressStorageKey = React.useMemo(() => {
    if (!exam) return '';
    const sid = studentId.trim() || studentName.trim() || 'guest';
    return `edumath_progress_${exam.id || exam.examCode}_${sid}`;
  }, [exam?.id, exam?.examCode, studentId, studentName]);

  // Restore saved progress when starting or loading exam
  useEffect(() => {
    if (!progressStorageKey || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(progressStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mcAnswers) setMcAnswers(parsed.mcAnswers);
        if (parsed.tfAnswers) setTfAnswers(parsed.tfAnswers);
        if (parsed.shortAnswers) setShortAnswers(parsed.shortAnswers);
        if (parsed.essayGradingData) setEssayGradingData(parsed.essayGradingData);
        if (typeof parsed.timeLeft === 'number' && parsed.timeLeft > 0) setTimeLeft(parsed.timeLeft);
        if (parsed.assignedExamCode) setAssignedExamCode(parsed.assignedExamCode);
        if (parsed.isExamStarted) setIsExamStarted(true);
      }
    } catch (e) {
      console.warn('Error restoring exam progress:', e);
    }
  }, [progressStorageKey]);

  // Auto-save in-progress answers every time they change
  useEffect(() => {
    if (!progressStorageKey || !isExamStarted || isSubmitted || typeof window === 'undefined') return;
    try {
      const dataToSave = {
        mcAnswers,
        tfAnswers,
        shortAnswers,
        essayGradingData,
        timeLeft,
        assignedExamCode,
        isExamStarted: true,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(progressStorageKey, JSON.stringify(dataToSave));
    } catch (e) {
      // storage quota or ignore
    }
  }, [progressStorageKey, isExamStarted, isSubmitted, mcAnswers, tfAnswers, shortAnswers, essayGradingData, timeLeft, assignedExamCode]);

  // Reset exam room whenever active exam changes
  useEffect(() => {
    if (exam) {
      const mins = exam.durationMinutes && exam.durationMinutes > 0 ? exam.durationMinutes : 45;
      setTimeLeft(mins * 60);
      setIsSubmitted(false);
      setIsTimeUp(false);
      setCalculatedScore(null);
      setMcAnswers({});
      setTfAnswers({});
      setShortAnswers({});
      setEssayGradingData({});
      const p3 =
        exam.part3Type ||
        (exam.essays?.length && exam.essays.every((e) => e.type === 'short_answer')
          ? 'short_answer'
          : 'essay');
      setPart3Mode(p3);
    }
  }, [exam?.id]);

  const isExamLocked = isSubmitted || isTimeUp;

  // Handle MC change
  const handleMcSelect = (questionId: string, choiceLetter: string) => {
    if (isExamLocked) return;
    setMcAnswers((prev) => ({
      ...prev,
      [questionId]: choiceLetter,
    }));
  };

  // Handle TF change
  const handleTfSelect = (questionId: string, subKey: string, value: boolean) => {
    if (isExamLocked) return;
    setTfAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [subKey]: value,
      },
    }));
  };

  // Handle Essay grading callback (supporting multiple images and direct typed solutions)
  const handleEssayGraded = (
    essayId: string,
    result: EssayGradingResult | null,
    imageUrl?: string,
    imageUrls?: string[],
    typedSolution?: string
  ) => {
    setEssayGradingData((prev) => {
      const existing = prev[essayId] || {};
      const newUrls = imageUrls !== undefined ? imageUrls : (imageUrl ? [imageUrl] : existing.imageUrls || []);
      const newPrimary = imageUrl !== undefined ? imageUrl : (newUrls[0] || existing.imageUrl || '');
      const newSolution = typedSolution !== undefined ? typedSolution : existing.typedSolution;
      const newGrading = result !== undefined ? (result || undefined) : existing.grading;

      let subType: 'image' | 'typed' | 'both' = 'image';
      if (newSolution?.trim() && (newPrimary || (newUrls && newUrls.length > 0))) {
        subType = 'both';
      } else if (newSolution?.trim()) {
        subType = 'typed';
      }

      return {
        ...prev,
        [essayId]: {
          imageUrl: newPrimary,
          imageUrls: newUrls,
          typedSolution: newSolution,
          submissionType: subType,
          grading: newGrading,
        },
      };
    });
  };

  // Handle Starting the Exam
  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = studentName.trim();
    const cleanClass = studentClass.trim();

    if (!cleanName) {
      setEntryError('Vui lòng nhập Họ và tên học sinh.');
      return;
    }
    if (!cleanClass) {
      setEntryError('Vui lòng nhập Lớp của học sinh (Ví dụ: 10A1, 10A2, 12A8).');
      return;
    }
    if (!studentId.trim()) {
      setStudentId(`HS-${Math.floor(100 + Math.random() * 900)}`);
    }

    // Assign equivalent variant if available for anti-copying
    let codeToUse = exam?.examCode || 'TOAN12';
    if (variants && variants.length > 0 && onSelectVariant) {
      const charSum = cleanName.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const vIdx = charSum % variants.length;
      const assigned = variants[vIdx];
      if (assigned) {
        codeToUse = assigned.examCode;
        onSelectVariant(assigned);
      }
    }
    setAssignedExamCode(codeToUse);
    examStartTimeRef.current = new Date().toISOString();

    setEntryError(null);
    setIsExamStarted(true);
  };

  // Quick select student from roster
  const handleSelectFromRoster = (st: StudentRosterItem) => {
    setStudentName(st.fullName);
    setStudentClass(st.className);
    setStudentId(st.sbd);
    setEntryError(null);
  };

  // Anti-cheat tab switch surveillance during active exam
  useEffect(() => {
    if (!isExamStarted || isSubmitted || isTimeUp) return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabViolations((prev) => prev + 1);
        setShowViolationWarning(true);
      }
    };

    const handleBlur = () => {
      setTabViolations((prev) => prev + 1);
      setShowViolationWarning(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isExamStarted, isSubmitted, isTimeUp]);

  // Countdown ticking effect: Only begins when student has clicked "Bắt đầu làm bài"
  useEffect(() => {
    if (!isExamStarted || isSubmitted || isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, isSubmitted, isTimeUp]);

  // Submit and Calculate total score
  const handleSubmitExam = (isAutoOnTimeout = false) => {
    if (isSubmitted || !exam) return;
    setShowConfirmSubmitModal(false);

    const finalStudentName = studentName.trim() || (isAutoOnTimeout ? 'Thí sinh (Tự động nộp khi hết giờ)' : 'Thí sinh');
    const finalStudentClass = studentClass.trim() || exam?.className || 'Toán 12';
    const finalStudentId = studentId.trim() || `SBD-${Date.now().toString().slice(-4)}`;

    // 1. Programmatic multiple choice grading
    let mcScore = 0;
    exam.multipleChoice.forEach((mc) => {
      if (mcAnswers[mc.id] === mc.correctAnswer) {
        mcScore += mc.points;
      }
    });

    // 2. Programmatic True/False grading
    let tfScore = 0;
    exam.trueFalseQuestions.forEach((tf) => {
      const userAnswersForTf = tfAnswers[tf.id] || {};
      tf.items.forEach((item) => {
        if (userAnswersForTf[item.key] === item.isCorrect) {
          tfScore += tf.pointsPerSub;
        }
      });
    });

    // 3. Essay / Short Answer Score
    let essayScore = 0;
    if (part3Mode === 'short_answer') {
      exam.essays.forEach((essay) => {
        const studentAns = (shortAnswers[essay.id] || '').trim();
        if (studentAns) {
          if (essay.shortAnswerKey) {
            const isCorrect = isMathShortAnswerCorrect(studentAns, essay.shortAnswerKey);
            if (isCorrect) essayScore += essay.maxPoints || 0.5;
          } else {
            essayScore += essay.maxPoints || 0.5;
          }
        }
      });
    } else {
      exam.essays.forEach((essay) => {
        const graded = essayGradingData[essay.id]?.grading;
        if (graded) {
          essayScore += graded.totalScore;
        }
      });
    }

    const totalRaw = mcScore + tfScore + essayScore;
    const finalTotal = Math.min(10, Math.round(totalRaw * 100) / 100);

    setCalculatedScore({
      mc: mcScore,
      tf: tfScore,
      essay: essayScore,
      total: finalTotal,
    });
    setIsSubmitted(true);

    const nowStr =
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' ' +
      new Date().toLocaleDateString('vi-VN');
    setSubmissionTime(nowStr);

    if (isAutoOnTimeout) {
      setShowTimeoutModal(true);
    }

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    const newSubmission: StudentSubmission = {
      id: `${assignedExamCode || exam.examCode}_${finalStudentClass}_${finalStudentName}_${Date.now()}`.replace(/[\/\s#?]/g, '_'),
      studentName: finalStudentName,
      studentClass: finalStudentClass,
      studentId: finalStudentId,
      examCode: assignedExamCode || exam.examCode,
      examId: exam.id,
      attemptNumber: currentAttemptNumber,
      submittedAt: nowStr,
      startTime: examStartTimeRef.current || new Date().toISOString(),
      tabViolations,
      mcAnswers,
      tfAnswers,
      shortAnswers,
      essayAnswers: essayGradingData,
      mcScore: mcScore + tfScore,
      essayScore,
      totalScore: finalTotal,
      status: 'graded',
      examSnapshot: exam,
    };

    setActiveSubmission(newSubmission);
    onSubmit(newSubmission);

    // Clear progress from localStorage upon completed submission
    if (progressStorageKey && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(progressStorageKey);
      } catch (e) {
        // ignore
      }
    }
  };

  // Trigger auto submit when time is up
  const autoSubmitHandledRef = useRef(false);
  useEffect(() => {
    if (isTimeUp && !isSubmitted && !autoSubmitHandledRef.current) {
      autoSubmitHandledRef.current = true;
      handleSubmitExam(true);
    }
  }, [isTimeUp, isSubmitted]);

  // Format time as MM:SS (or HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Scroll to question smoothly
  const scrollToQuestion = (targetId: string) => {
    setActiveQuestionId(targetId);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // If no exam exists yet, show empty state
  if (!exam) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            Phòng Thi Trực Tuyến
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-2">Chưa Có Đề Thi Nào Được Kích Hoạt</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Hệ thống hiện chưa có đề thi nào được lưu trên cơ sở dữ liệu Cloud Firebase. Giáo viên vui lòng chuyển sang tab <strong className="text-slate-800">Giáo Viên Tạo Đề</strong> để tạo đề thi mới hoặc chia sẻ link đề cho học sinh!
          </p>
        </div>
        {onGoToTeacher && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onGoToTeacher}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Chuyển sang Giáo Viên Tạo Đề
            </button>
          </div>
        )}
      </div>
    );
  }

  // Answer stats & calculation for Navigation Grid
  const totalQuestions = exam.multipleChoice.length + exam.trueFalseQuestions.length + exam.essays.length;

  const isMcAnswered = (id: string) => !!mcAnswers[id];
  const isTfAnswered = (id: string) => {
    const subs = tfAnswers[id];
    return subs ? Object.keys(subs).length > 0 : false;
  };
  const isEssayAnswered = (id: string) => {
    if (part3Mode === 'short_answer') {
      return !!shortAnswers[id]?.trim();
    }
    const ans = essayGradingData[id];
    return !!(ans?.imageUrl || (ans?.imageUrls && ans.imageUrls.length > 0) || ans?.typedSolution?.trim());
  };

  const answeredMcCount = exam.multipleChoice.filter((q) => isMcAnswered(q.id)).length;
  const answeredTfCount = exam.trueFalseQuestions.filter((q) => isTfAnswered(q.id)).length;
  const answeredEssayCount = exam.essays.filter((q) => isEssayAnswered(q.id)).length;
  const totalAnsweredCount = answeredMcCount + answeredTfCount + answeredEssayCount;
  const completionPercentage = Math.round((totalAnsweredCount / Math.max(1, totalQuestions)) * 100);

  // Filtered roster suggestions (Strictly valid students only)
  const validRoster = (roster || []).filter((st) => !isInvalidStudentName(st.fullName));
  const rosterSuggestions = validRoster.filter(
    (st) =>
      st.fullName.toLowerCase().includes(rosterFilter.toLowerCase()) ||
      st.sbd.toLowerCase().includes(rosterFilter.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-300 relative space-y-6">
      {/* Anti-cheat violation alert banner */}
      {isExamStarted && !isSubmitted && showViolationWarning && (
        <div className="bg-rose-600 text-white px-5 py-3.5 rounded-2xl shadow-xl border-2 border-rose-400 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-200 animate-bounce" />
            </div>
            <div>
              <div className="font-black text-xs uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                <span>CẢNH BÁO GIÁM SÁT THI TRỰC TUYẾN</span>
                <span className="bg-black/30 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-white font-black">
                  Vi phạm rời màn hình: {tabViolations} lần
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                Hệ thống phát hiện bạn vừa chuyển tab hoặc rời ứng dụng. Số lần vi phạm được đồng bộ trực tiếp vào cơ sở dữ liệu bài thi gửi đến Thầy/Cô!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowViolationWarning(false)}
            className="px-3 py-1.5 bg-black/25 hover:bg-black/40 text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            Đã Hiểu
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MANDATORY ENTRY MODAL: ĐIỂM DANH NHANH 2 Ô TRƯỚC KHI BẮT ĐẦU           */}
      {/* Bắt đầu bấm giờ làm bài ngay khi học sinh nhấn "Bắt đầu làm bài"           */}
      {/* ========================================================================= */}
      {!isExamStarted && !isSubmitted && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 text-slate-900 relative">
            {/* Nút thoát / Về trang Giáo viên */}
            {onGoToTeacher && (
              <button
                type="button"
                onClick={onGoToTeacher}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Trở về trang Giáo viên"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Về Trang Giáo Viên</span>
              </button>
            )}

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block">
                  Phòng Thi Trực Tuyến GDPT 2018
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Điểm Danh Vào Làm Bài Thi
                </h3>
                <p className="text-xs font-bold text-indigo-700">
                  Hệ Thống Khảo Thí EduMath AI • Thầy Trịnh Tuấn Kiệt
                </p>
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {currentUser && currentUser.role === 'student'
                  ? 'Hệ thống đã nhận diện tài khoản của em. Vui lòng bấm Bắt Đầu Làm Bài!'
                  : 'Vui lòng điền Họ và tên và Lớp của bạn, hoặc đăng nhập tài khoản do giáo viên cấp.'}
              </p>
            </div>

            {/* If logged in student: show verified badge */}
            {currentUser && currentUser.role === 'student' ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md">
                      TÀI KHOẢN ĐÃ XÁC THỰC
                    </span>
                  </div>
                  <div className="font-extrabold text-sm text-emerald-950 mt-0.5">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono font-bold">
                    Lớp: {currentUser.className || studentClass} • SBD: {currentUser.sbd || studentId || currentUser.username}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex items-center justify-between gap-2 shadow-2xs">
                <div className="text-[11px]">
                  <span className="font-bold text-blue-900">Vào thi tự do qua Link:</span> Điền Họ tên & Lớp bên dưới là làm bài ngay không cần mật khẩu.
                </div>
                {onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="text-[11px] font-black text-indigo-700 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 shrink-0 cursor-pointer shadow-2xs"
                  >
                    Đăng nhập tài khoản lớp →
                  </button>
                )}
              </div>
            )}

            {/* Thông tin bài thi: [Tên đề thi] • [Khối lớp] • [Thời gian làm bài] • [Số lần làm bài] • [Cấu trúc đề] */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-start font-bold gap-2">
                <span className="text-slate-500 shrink-0">Đề thi:</span>
                <span className="text-slate-900 font-black text-right line-clamp-2">
                  [{exam.title}]
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 font-semibold pt-1 border-t border-slate-200/60 flex-wrap gap-2">
                <span>Khối lớp: <b className="text-indigo-700">Lớp {exam.grade}</b></span>
                <span>•</span>
                <span>Thời gian: <b className="text-emerald-700 font-bold">{durationMinutes} phút</b></span>
                <span>•</span>
                <span>
                  Lần thi: <b className="text-amber-700 font-black">Lần {currentAttemptNumber}{maxAllowedAttempts > 0 ? ` / ${maxAllowedAttempts}` : ' (Không giới hạn)'}</b>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-0.5">
                Cấu trúc: <b>{exam.multipleChoice.length} TN + {exam.trueFalseQuestions.length} Đ/S + {exam.essays.length} {part3Mode === 'short_answer' ? 'TL ngắn' : 'Tự luận'}</b>
              </div>

              {/* Progress restoration notice if saved in localStorage */}
              {progressStorageKey && typeof window !== 'undefined' && localStorage.getItem(progressStorageKey) && (
                <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Hệ thống đã tự động bảo lưu tiến trình làm bài dở của em trước đó!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.removeItem(progressStorageKey);
                        setMcAnswers({});
                        setTfAnswers({});
                        setShortAnswers({});
                        setEssayGradingData({});
                        setTimeLeft(durationMinutes * 60);
                      } catch (e) {}
                    }}
                    className="text-[10px] text-rose-600 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    Làm lại từ đầu
                  </button>
                </div>
              )}

              {/* Attempt limit exceeded warning */}
              {isAttemptsExceeded && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2 mt-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Em đã hoàn thành đủ số lần thi quy định ({maxAllowedAttempts} lần). Vui lòng xem điểm và lời giải chi tiết bên dưới.</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {entryError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{entryError}</span>
              </div>
            )}

            {/* Form Inputs: Đúng 2 ô [Họ và tên học sinh] và [Lớp] */}
            <form onSubmit={handleStartExam} className="space-y-4">
              
              {/* Ô 1: HỌ VÀ TÊN HỌC SINH (Bắt buộc + Autocomplete thông minh) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Họ và Tên Học Sinh <span className="text-rose-500">*</span>
                  </label>
                  {roster.length > 0 && (
                    <span className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      Gợi ý từ DS ({roster.length} HS)
                    </span>
                  )}
                </div>

                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={studentName}
                    onFocus={() => setIsNameInputFocused(true)}
                    onChange={(e) => {
                      setStudentName(e.target.value);
                      if (entryError) setEntryError(null);
                    }}
                    placeholder="Gõ tên để tìm nhanh hoặc nhập họ tên bạn..."
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                  />
                </div>

                {/* Floating Autocomplete Dropdown */}
                {isNameInputFocused && studentName.trim().length >= 1 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-indigo-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {validRoster
                      .filter((st) =>
                        st.fullName.toLowerCase().includes(studentName.toLowerCase()) ||
                        st.sbd.toLowerCase().includes(studentName.toLowerCase())
                      )
                      .slice(0, 6)
                      .map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setStudentName(st.fullName);
                            setStudentClass(st.className);
                            setStudentId(st.sbd);
                            setIsNameInputFocused(false);
                            if (entryError) setEntryError(null);
                          }}
                          className="w-full p-2.5 hover:bg-indigo-50 text-left text-xs flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900">{st.fullName}</span>
                            <span className="text-[11px] text-indigo-700 ml-2 font-mono">
                              ({st.className} {st.sbd ? `• ${st.sbd}` : ''})
                            </span>
                          </div>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                            Chọn
                          </span>
                        </button>
                      ))}
                    {validRoster.filter((st) =>
                      st.fullName.toLowerCase().includes(studentName.toLowerCase())
                    ).length === 0 && (
                      <div className="p-2.5 text-xs text-slate-500 italic">
                        Không có trong danh sách mẫu, sẽ dùng tên: <b>"{studentName}"</b>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ô 2: LỚP (Bắt buộc) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Lớp <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Ví dụ: 10A1, 10A2, 12A8</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={studentClass}
                    onChange={(e) => {
                      setStudentClass(e.target.value.toUpperCase());
                      if (entryError) setEntryError(null);
                    }}
                    placeholder="Ví dụ: 10A1, 10A2, 12A8"
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 uppercase shadow-2xs"
                  />

                  {/* Quick Select Pills for Class */}
                  {Array.from(new Set(roster.map((r) => r.className).filter(Boolean))).length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold">Chọn nhanh lớp:</span>
                      {Array.from(new Set(roster.map((r) => r.className).filter(Boolean)))
                        .slice(0, 5)
                        .map((clsName) => (
                          <button
                            key={clsName}
                            type="button"
                            onClick={() => {
                              setStudentClass(clsName);
                              if (entryError) setEntryError(null);
                            }}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                              studentClass.toUpperCase() === clsName.toUpperCase()
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {clsName}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Nút bấm nổi bật: [ BẮT ĐẦU LÀM BÀI ➔ ] (Chỉ sáng lên khi đã điền/chọn đủ Họ tên và Lớp) */}
              <button
                type="submit"
                disabled={!studentName.trim() || !studentClass.trim()}
                className={`w-full mt-2 py-4 px-5 rounded-2xl font-black text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 ${
                  studentName.trim() && studentClass.trim()
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white shadow-xl shadow-indigo-600/30 active:scale-98 cursor-pointer ring-2 ring-emerald-400/50 animate-pulse'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                }`}
              >
                <span>BẮT ĐẦU LÀM BÀI ➔</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Navigation Bar: Chọn giữa Làm bài thi trực tiếp & Danh sách bài thi đã được giao */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStudentPortalTab('exam')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              studentPortalTab === 'exam'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Phòng Làm Bài Thi</span>
          </button>

          <button
            type="button"
            onClick={() => setStudentPortalTab('assigned_list')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              studentPortalTab === 'assigned_list'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FolderKanban className="w-4 h-4 text-emerald-600" />
            <span>Đề Thi Được Giao ({savedExams.length})</span>
          </button>
        </div>

        {/* Student personal info pill */}
        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span className="font-bold">Học sinh:</span>
          <span className="font-extrabold text-indigo-700">{studentName || 'Chưa đăng nhập'}</span>
          {studentClass && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-800">
              Lớp {studentClass}
            </span>
          )}
        </div>
      </div>

      {/* VIEW DANH SÁCH BÀI KIỂM TRA GIÁO VIÊN ĐÃ GIAO (CÁCH 2) */}
      {studentPortalTab === 'assigned_list' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Danh Sách Bài Thi Giáo Viên Đã Giao Cho Em
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bấm vào bài thi để bắt đầu làm bài. Tiến trình làm bài và số lần nộp bài được ghi nhận tự động.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedExams.map((ex) => {
              const mySubs = submissions.filter(
                (s) =>
                  (s.examId === ex.id || s.examCode === ex.examCode) &&
                  ((studentName && s.studentName.trim().toLowerCase() === studentName.trim().toLowerCase()) ||
                    (studentId && s.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()))
              );
              const isDone = mySubs.length > 0;
              const hasDraft =
                typeof window !== 'undefined' &&
                !!localStorage.getItem(`edumath_progress_${ex.id || ex.examCode}_${studentId || studentName || 'guest'}`);
              const maxAtt = ex.maxAttempts !== undefined ? ex.maxAttempts : 1;
              const isOver = maxAtt > 0 && mySubs.length >= maxAtt;

              return (
                <div
                  key={ex.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold">
                        {ex.examCode}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : hasDraft
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {isDone
                          ? `Đã nộp (${mySubs.length} lần)`
                          : hasDraft
                          ? 'Đang làm dở'
                          : 'Chưa làm'}
                      </span>
                    </div>

                    <h4 className="font-black text-slate-900 text-sm line-clamp-2">{ex.title}</h4>

                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>Khối lớp: <b className="text-slate-700">Lớp {ex.grade}</b></div>
                      <div>Thời gian: <b className="text-emerald-700">{ex.durationMinutes || 45} phút</b></div>
                      <div>
                        Quy định: <b className="text-slate-700">{maxAtt === 0 ? 'Không giới hạn lần thi' : `Tối đa ${maxAtt} lần làm`}</b>
                      </div>
                      {isDone && (
                        <div className="text-amber-800 font-bold pt-1">
                          Điểm cao nhất: {Math.max(...mySubs.map((s) => s.totalScore)).toFixed(2)}đ
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectExam) onSelectExam(ex);
                        setStudentPortalTab('exam');
                        setIsExamStarted(false);
                        setIsSubmitted(false);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isOver
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : hasDraft
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <span>
                        {isOver ? 'Xem Điểm & Đề Bài' : hasDraft ? 'Tiếp Tục Làm Bài Dở ➔' : 'Vào Làm Bài Này ➔'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Header Card: Exam Metadata & Student Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <GraduationCap className="w-3.5 h-3.5" /> Khảo Thí Trực Tuyến GDPT 2018
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                MÃ ĐỀ: {exam.examCode}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                • Thời gian: <b className="text-slate-800">{durationMinutes} phút</b>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">{exam.title}</h2>
          </div>

          {/* Quick timer for test demonstration if needed */}
          {!isSubmitted && (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs self-start md:self-auto">
              <span className="text-slate-400 text-[11px] font-semibold px-1">Thử nhanh:</span>
              <button
                type="button"
                onClick={() => setTimeLeft(10)}
                className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold transition-colors cursor-pointer text-[11px]"
                title="Đặt 10s để thử tính năng tự động thu bài"
              >
                10s
              </button>
              <button
                type="button"
                onClick={() => setTimeLeft(60)}
                className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold transition-colors cursor-pointer text-[11px]"
              >
                1m
              </button>
              <button
                type="button"
                onClick={() => setTimeLeft(durationMinutes * 60)}
                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer text-[11px]"
              >
                {durationMinutes}m
              </button>
            </div>
          )}
        </div>

        {/* Official Student Identification Display */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Thí Sinh Dự Thi
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                {studentName || 'Chưa nhập họ tên'}
                <span className="text-slate-300 font-normal mx-2">•</span>
                Lớp: <span className="text-indigo-700 font-extrabold">{studentClass || '12'}</span>
                <span className="text-slate-300 font-normal mx-2">•</span>
                SBD: <span className="text-emerald-700 font-mono font-bold">{studentId || 'Chưa có'}</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 text-xs font-mono font-bold text-indigo-900">
              <span>MÃ ĐỀ:</span>
              <span className="text-indigo-700">{exam.examCode}</span>
            </div>

            {!isExamLocked && (
              <button
                type="button"
                onClick={() => setIsEditInfoOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200"
              >
                Sửa thông tin
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submission Success Banner */}
      {isSubmitted && calculatedScore && (
        <div
          className={`p-6 rounded-2xl text-white shadow-lg animate-in slide-in-from-top-4 duration-300 ${
            isTimeUp
              ? 'bg-gradient-to-r from-amber-700 via-rose-700 to-indigo-800'
              : 'bg-gradient-to-r from-emerald-600 to-teal-700'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {isTimeUp ? <Clock className="w-6 h-6 text-amber-300" /> : <Trophy className="w-6 h-6 text-yellow-300" />}
              </div>
              <div>
                <span className="text-xs text-emerald-100 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  {isTimeUp ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-300" /> Đã Hết Giờ - Tự Động Khóa & Thu Bài Thành Công
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Nộp Bài Thi Thành Công!
                    </>
                  )}
                </span>
                <h3 className="text-xl font-bold">
                  Thí sinh: {studentName} - Lớp {studentClass} (SBD: {studentId})
                </h3>
                {submissionTime && (
                  <p className="text-[11px] text-white/80 mt-0.5">
                    Thời điểm nộp bài: <span className="font-semibold">{submissionTime}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center border border-white/20">
                <span className="text-[10px] text-emerald-100 block">Phần I (TN)</span>
                <span className="text-base font-bold">{calculatedScore.mc.toFixed(2)}đ</span>
              </div>

              <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center border border-white/20">
                <span className="text-[10px] text-emerald-100 block">Phần II (Đ/S)</span>
                <span className="text-base font-bold">{calculatedScore.tf.toFixed(2)}đ</span>
              </div>

              <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center border border-white/20">
                <span className="text-[10px] text-emerald-100 block">
                  Phần III ({part3Mode === 'short_answer' ? 'TL Ngắn' : 'Tự Luận'})
                </span>
                <span className="text-base font-bold">{calculatedScore.essay.toFixed(2)}đ</span>
              </div>

              <div className="bg-yellow-400 text-slate-900 px-5 py-2 rounded-xl text-center shadow-md">
                <span className="text-[10px] font-bold block uppercase tracking-wide">Tổng Điểm</span>
                <span className="text-2xl font-black">{calculatedScore.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-white/80">
              🔒 Kết quả bài làm đã được lưu và đồng bộ lên cơ sở dữ liệu Cloud Firestore.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDetailedSolutions(!showDetailedSolutions)}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                {showDetailedSolutions ? 'Ẩn Lời Giải Chi Tiết' : 'Xem Điểm & Lời Giải Chi Tiết'}
              </button>

              {/* Nút Khiếu Nại Điểm Cho Học Sinh */}
              <button
                type="button"
                onClick={() => {
                  setAppealSuccessMsg(null);
                  setAppealReason('');
                  setAppealQuestionRef('Điểm toàn bài');
                  setIsAppealModalOpen(true);
                }}
                className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5"
                title="Gửi khiếu nại nếu em thấy ứng dụng chấm chưa đúng"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-white" />
                <span>Khiếu Nại Chấm Điểm</span>
              </button>

              {/* Nút Làm Lại Đề Thi (Nếu giáo viên cho phép làm nhiều lần) */}
              {!isAttemptsExceeded && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setIsExamStarted(false);
                    setIsTimeUp(false);
                    setCalculatedScore(null);
                    setMcAnswers({});
                    setTfAnswers({});
                    setShortAnswers({});
                    setEssayGradingData({});
                    setTimeLeft(durationMinutes * 60);
                  }}
                  className="px-3.5 py-2 bg-indigo-500/80 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Làm lại đề thi (Tính lần thi tiếp theo)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Làm Lại Đề (Lần {currentAttemptNumber + 1})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> In Kết Quả
              </button>
              <button
                type="button"
                onClick={onViewGradebook}
                className="px-3.5 py-2 bg-white text-emerald-800 font-bold text-xs rounded-xl shadow hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                Xem Bảng Điểm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2-COLUMN PROFESSIONAL ONLINE TESTING LAYOUT                    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================ */}
        {/* LEFT / MAIN COLUMN: Questions Content (col-span-8 or 9)      */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6 pb-28 lg:pb-8">
          {/* Quick Section Anchors */}
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => scrollToQuestion('section-part1')}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0"
            >
              Phần I: TN 4 Lựa chọn ({exam.multipleChoice.length} câu)
            </button>
            {exam.trueFalseQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToQuestion('section-part2')}
                className="px-3.5 py-1.5 rounded-xl font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
              >
                Phần II: Đúng / Sai ({exam.trueFalseQuestions.length} câu)
              </button>
            )}
            {exam.essays.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToQuestion('section-part3')}
                className="px-3.5 py-1.5 rounded-xl font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
              >
                Phần III: {part3Mode === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'} ({exam.essays.length} câu)
              </button>
            )}
          </div>

          {/* ==================== PHẦN I: TRẮC NGHIỆM ==================== */}
          <div id="section-part1" className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  PHẦN I
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1.5">
                  CÂU HỎI TRẮC NGHIỆM NHIỀU LỰA CHỌN (4 PHƯƠNG ÁN A, B, C, D)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thí sinh chọn 1 phương án đúng duy nhất cho mỗi câu hỏi.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {exam.multipleChoice.map((mc, idx) => {
                const qNum = idx + 1;
                const questionElementId = `question-${qNum}`;
                const isSelectedAny = isMcAnswered(mc.id);

                return (
                  <div
                    key={mc.id}
                    id={questionElementId}
                    className={`p-5 rounded-2xl border transition-all duration-300 ${
                      activeQuestionId === questionElementId
                        ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/20'
                        : isSelectedAny
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200/90 bg-slate-50/50'
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="font-bold text-slate-900 text-base sm:text-lg leading-relaxed flex-1">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-black mr-2 shadow-2xs">
                          Câu {qNum}
                        </span>
                        <MathRenderer
                          content={mc.question.replace(/^(?:Câu|Bài)\s*\d+\s*[:.]*\s*/i, '')}
                          className="text-base sm:text-lg font-bold leading-relaxed text-slate-900"
                        />
                      </div>
                      <span className="text-indigo-600 font-extrabold text-xs px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 shrink-0">
                        {mc.points}đ
                      </span>
                    </div>

                    {/* Question visual diagram (if needed) */}
                    <QuestionVisual
                      visualType={mc.visualType}
                      caption={mc.visualCaption}
                      questionText={mc.question}
                    />

                    {/* Custom Snipped Image if teacher clipped from real paper */}
                    {mc.customImageUrl && (
                      <div className="my-3 p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <img
                          src={mc.customImageUrl}
                          alt={`Hình vẽ câu ${qNum}`}
                          className="max-h-60 object-contain mx-auto rounded-lg"
                        />
                      </div>
                    )}

                    {/* Options Grid (A, B, C, D) - Online Exam Styling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {mc.options.map((opt, oIdx) => {
                        const letter = opt.trim().substring(0, 1).toUpperCase();
                        const isSelected = mcAnswers[mc.id] === letter;
                        const isCorrect = isExamLocked && mc.correctAnswer === letter;
                        const isWrong = isExamLocked && isSelected && mc.correctAnswer !== letter;

                        return (
                          <button
                            type="button"
                            key={oIdx}
                            onClick={() => handleMcSelect(mc.id, letter)}
                            disabled={isExamLocked}
                            className={`min-h-[50px] sm:min-h-[54px] p-3.5 sm:p-4 rounded-2xl border text-left font-medium transition-all flex items-center gap-3 cursor-pointer touch-manipulation select-none active:scale-[0.99] disabled:cursor-not-allowed ${
                              isSelected && !isExamLocked
                                ? 'bg-indigo-50/95 border-indigo-600 text-indigo-950 font-bold shadow-xs ring-2 ring-indigo-500/30'
                                : isCorrect
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-400/40'
                                : isWrong
                                ? 'bg-rose-50 border-rose-400 text-rose-950 line-through'
                                : isExamLocked
                                ? 'bg-white border-slate-200 text-slate-500 opacity-80'
                                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            {/* Circular Letter Badge */}
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                                isSelected && !isExamLocked
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : isCorrect
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : isWrong
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              {letter}
                            </span>

                            {/* Option content */}
                            <div className="flex-1 text-sm sm:text-base leading-relaxed text-slate-800 font-medium break-words overflow-x-auto max-w-full">
                              <MathRenderer
                                content={opt.replace(/^[A-D]\.\s*/, '')}
                                className="text-sm sm:text-base leading-relaxed"
                              />
                            </div>

                            {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Detailed Solutions upon submission or when requested */}
                    {(isExamLocked || showDetailedSolutions) && (
                      <div className="mt-3.5 p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-200 text-xs text-indigo-950 space-y-1">
                        <div className="flex items-center gap-2 font-black text-indigo-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Đáp án đúng: {mc.correctAnswer}</span>
                          {mcAnswers[mc.id] && (
                            <span className="font-semibold text-slate-600 text-[11px]">
                              (Lựa chọn của bạn: {mcAnswers[mc.id]})
                            </span>
                          )}
                        </div>
                        {mc.explanation && (
                          <div className="text-slate-800 leading-relaxed pt-1 border-t border-indigo-100">
                            <b>Lời giải chi tiết: </b>
                            <MathRenderer content={mc.explanation} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== PHẦN II: ĐÚNG / SAI ==================== */}
          {exam.trueFalseQuestions?.length > 0 && (
            <div id="section-part2" className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">
                    PHẦN II
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-1.5">
                    CÂU TRẮC NGHIỆM ĐÚNG / SAI (MỖI CÂU 4 Ý A, B, C, D)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn ĐÚNG hoặc SAI.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {exam.trueFalseQuestions.map((tf, idx) => {
                  const qNum = exam.multipleChoice.length + idx + 1;
                  const questionElementId = `question-${qNum}`;
                  const isSelectedAny = isTfAnswered(tf.id);

                  return (
                    <div
                      key={tf.id}
                      id={questionElementId}
                      className={`p-5 rounded-2xl border transition-all duration-300 ${
                        activeQuestionId === questionElementId
                          ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/20'
                          : isSelectedAny
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-200/90 bg-slate-50/50'
                      }`}
                    >
                      <div className="font-bold text-slate-900 text-base sm:text-lg leading-relaxed mb-3">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-amber-600 text-white text-xs font-black mr-2 shadow-2xs">
                          Câu {qNum}
                        </span>
                        <MathRenderer
                          content={tf.prompt.replace(/^(?:Câu|Bài)\s*\d+\s*[:.]*\s*/i, '')}
                          className="text-base sm:text-lg font-bold leading-relaxed text-slate-900"
                        />
                      </div>

                      <QuestionVisual
                        visualType={tf.visualType}
                        caption={tf.visualCaption}
                        questionText={tf.prompt}
                      />

                      {tf.customImageUrl && (
                        <div className="my-3 p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                          <img
                            src={tf.customImageUrl}
                            alt={`Hình vẽ câu ${qNum}`}
                            className="max-h-60 object-contain mx-auto rounded-lg"
                          />
                        </div>
                      )}

                      {/* Sub-items (a, b, c, d) */}
                      <div className="space-y-2.5 pt-1">
                        {tf.items.map((item) => {
                          const currentVal = tfAnswers[tf.id]?.[item.key];
                          return (
                            <div
                              key={item.key}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 gap-3"
                            >
                              <div className="text-slate-800 text-base sm:text-lg font-medium pr-2 flex-1 leading-relaxed">
                                <b className="text-amber-700 font-extrabold mr-1.5">{item.key})</b>
                                <MathRenderer
                                  content={item.statement}
                                  className="text-base sm:text-lg leading-relaxed"
                                />
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => handleTfSelect(tf.id, item.key, true)}
                                  disabled={isExamLocked}
                                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer disabled:cursor-not-allowed ${
                                    currentVal === true
                                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                                      : isExamLocked
                                      ? 'bg-slate-100 text-slate-400 opacity-60'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700'
                                  }`}
                                >
                                  ĐÚNG
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleTfSelect(tf.id, item.key, false)}
                                  disabled={isExamLocked}
                                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer disabled:cursor-not-allowed ${
                                    currentVal === false
                                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                                      : isExamLocked
                                      ? 'bg-slate-100 text-slate-400 opacity-60'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:border-rose-500 hover:text-rose-700'
                                  }`}
                                >
                                  SAI
                                </button>

                                {isExamLocked && (
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                      currentVal === item.isCorrect
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    }`}
                                  >
                                    {currentVal === item.isCorrect ? '+0.25đ' : '0đ'} (Đáp án: {item.isCorrect ? 'Đ' : 'S'})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PHẦN III: PHÂN ĐỊNH BẮT BUỘC THEO CẤU TRÚC ĐỀ CƯƠNG                        */}
          {/* Trường hợp 1: "TRẢ LỜI NGẮN"                                             */}
          {/*   - Giao diện CHỈ hiển thị: Nội dung câu hỏi và 1 ô Input duy nhất để      */}
          {/*     nhập đáp số (placeholder: "Nhập kết quả...").                         */}
          {/*   - TUYỆT ĐỐI KHÔNG hiển thị barem chấm điểm, không hiển thị nút tải ảnh   */}
          {/*     hay camera, không có khung chấm AI.                                   */}
          {/* Trường hợp 2: "TỰ LUẬN"                                                   */}
          {/*   - Hiển thị nội dung câu hỏi và thang điểm.                              */}
          {/*   - Cho phép học sinh tải lên NHIỀU ẢNH (Trang 1, Trang 2...) từ thư viện  */}
          {/*     hoặc camera điện thoại, có thumbnail xem trước & nút xóa nếu chụp mờ. */}
          {/* ========================================================================= */}
          {exam.essays?.length > 0 && (
            <div id="section-part3" className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                      PHẦN III
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                      {part3Mode === 'short_answer'
                        ? 'CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN'
                        : 'TỰ LUẬN GIẢI CHI TIẾT (CHẤM ĐIỂM BẰNG AI GEMINI VISION)'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {part3Mode === 'short_answer'
                        ? 'Thí sinh tính toán và nhập đáp số chính xác vào ô trống.'
                        : 'Thí sinh làm bài ra giấy thi, chụp ảnh bài làm và gửi bài để AI chấm theo barem điểm từng bước.'}
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setPart3Mode('short_answer')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        part3Mode === 'short_answer'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📝 Trả lời ngắn
                    </button>
                    <button
                      type="button"
                      onClick={() => setPart3Mode('essay')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        part3Mode === 'essay'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ✍️ Tự luận viết tay
                    </button>
                  </div>
                </div>
              </div>

              {part3Mode === 'short_answer' ? (
                /* ========================================================================= */
                /* TRƯỜNG HỢP 1: TRẢ LỜI NGẮN                                                */
                /* CHỈ hiển thị: Nội dung câu hỏi và 1 ô Input duy nhất để học sinh nhập     */
                /* đáp số (placeholder: "Nhập kết quả...").                                   */
                /* TUYỆT ĐỐI KHÔNG hiển thị barem chấm điểm, không hiển thị nút tải ảnh     */
                /* hay camera, không có khung chấm AI.                                       */
                /* ========================================================================= */
                <div className="space-y-6">
                  {exam.essays.map((essay, eIdx) => {
                    const qNum = exam.multipleChoice.length + exam.trueFalseQuestions.length + eIdx + 1;
                    const questionElementId = `question-${qNum}`;
                    const isDone = !!shortAnswers[essay.id]?.trim();

                    return (
                      <div
                        key={essay.id}
                        id={questionElementId}
                        className={`p-6 rounded-2xl border transition-all duration-300 bg-white ${
                          activeQuestionId === questionElementId
                            ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/20'
                            : isDone
                            ? 'border-emerald-300 bg-emerald-50/10'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Question Header: Chỉ hiển thị nội dung câu hỏi */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="font-bold text-slate-900 text-base sm:text-lg leading-relaxed flex-1">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-black mr-2.5 shadow-2xs">
                              Câu {qNum}
                            </span>
                            <MathRenderer
                              content={essay.question.replace(/^Câu\s*\d+\s*(\(Tự luận\))?\s*:\s*/i, '')}
                              className="text-base sm:text-lg font-bold leading-relaxed text-slate-900"
                            />
                          </div>
                          <span className="text-indigo-700 font-extrabold text-xs px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 shrink-0">
                            {essay.maxPoints || 0.5}đ
                          </span>
                        </div>

                        {/* Diagram if available */}
                        <QuestionVisual
                          visualType={essay.visualType}
                          caption={essay.visualCaption}
                          questionText={essay.question}
                        />

                        {essay.customImageUrl && (
                          <div className="my-3 p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                            <img
                              src={essay.customImageUrl}
                              alt={`Hình vẽ câu ${qNum}`}
                              className="max-h-60 object-contain mx-auto rounded-lg"
                            />
                          </div>
                        )}

                        {/* Ô NHẬP ĐÁP SỐ TOÁN HỌC TRỰC QUAN WYSIWYG VỚI MATHLIVE & BÀN PHÍM ẢO */}
                        <div className="mt-5 pt-4 border-t border-slate-200">
                          <MathLiveField
                            mode="short_answer"
                            value={shortAnswers[essay.id] || ''}
                            onChange={(latex) =>
                              setShortAnswers((prev) => ({ ...prev, [essay.id]: latex }))
                            }
                            disabled={isExamLocked}
                            label="Đáp số của thí sinh (Ô nhập MathLive chuẩn SGK):"
                            placeholder="Chạm vào đây để nhập đáp số toán học..."
                          />

                          {/* Lời giải chi tiết sau khi kết thúc làm bài (Chỉ khi đã nộp bài và bật xem giải) */}
                          {isSubmitted && showDetailedSolutions && essay.shortAnswerKey && (() => {
                            const isCorrectAns = isMathShortAnswerCorrect(shortAnswers[essay.id] || '', essay.shortAnswerKey);
                            const displayKey = essay.shortAnswerKey.trim().startsWith('$') ? essay.shortAnswerKey : `$${essay.shortAnswerKey}$`;
                            const studentAnsLatex = shortAnswers[essay.id]?.trim();
                            const displayStudent = studentAnsLatex
                              ? (studentAnsLatex.startsWith('$') ? studentAnsLatex : `$${studentAnsLatex}$`)
                              : '';

                            return (
                              <div className={`mt-3.5 p-3.5 rounded-xl border text-xs space-y-2 ${
                                isCorrectAns
                                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                                  : 'bg-rose-50/70 border-rose-300 text-rose-950'
                              }`}>
                                <div className="flex items-center justify-between font-black text-sm">
                                  <div className="flex items-center gap-1.5">
                                    {isCorrectAns ? (
                                      <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="text-emerald-800">Kết quả: Đúng (+{essay.maxPoints || 0.5}đ)</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span className="text-rose-800">Kết quả: Chưa chính xác (0đ)</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                                  <div className="p-2 rounded-lg bg-white/80 border border-slate-200">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Đáp số chuẩn SGK:</div>
                                    <div className="font-bold text-indigo-700 text-sm">
                                      <MathRenderer content={displayKey} />
                                    </div>
                                  </div>
                                  <div className="p-2 rounded-lg bg-white/80 border border-slate-200">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Đáp số em đã nhập:</div>
                                    {displayStudent ? (
                                      <div className={`font-bold text-sm ${isCorrectAns ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        <MathRenderer content={displayStudent} />
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">Chưa trả lời</span>
                                    )}
                                  </div>
                                </div>

                                {essay.sampleSolution && (
                                  <div className="pt-2 border-t border-slate-200/60 text-xs">
                                    <div className="font-bold text-slate-700 mb-1">💡 Hướng dẫn giải chi tiết:</div>
                                    <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200 text-slate-800">
                                      <MathRenderer content={essay.sampleSolution} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ========================================================================= */
                /* TRƯỜNG HỢP 2: TỰ LUẬN                                                     */
                /* Hiển thị nội dung câu hỏi và thang điểm.                                  */
                /* Khu vực nộp bài: Cho phép học sinh lựa chọn 2 phương thức song song:      */
                /* Cách 1: Gõ bài giải trực tiếp bằng công cụ MathType (chuẩn SGK)          */
                /* Cách 2: Viết ra giấy thi và chụp ảnh tải lên (nhiều trang)               */
                /* ========================================================================= */
                <div className="space-y-6">
                  {exam.essays.map((essay, eIdx) => {
                    const qNum = exam.multipleChoice.length + exam.trueFalseQuestions.length + eIdx + 1;
                    return (
                      <div key={essay.id} id={`question-${qNum}`}>
                        <StudentEssayUpload
                          essay={essay}
                          studentName={studentName}
                          studentClass={studentClass}
                          backendUrl={backendUrl}
                          disabled={isExamLocked}
                          isStudentExamView={true}
                          existingImageUrl={essayGradingData[essay.id]?.imageUrl}
                          existingImageUrls={essayGradingData[essay.id]?.imageUrls}
                          existingTypedSolution={essayGradingData[essay.id]?.typedSolution}
                          existingResult={essayGradingData[essay.id]?.grading}
                          onSolutionChange={(typedSolution, imageUrls) =>
                            handleEssayGraded(essay.id, null, imageUrls?.[0] || '', imageUrls, typedSolution)
                          }
                          onGraded={(result, imageUrl, imageUrls, typedSolution) =>
                            handleEssayGraded(essay.id, result, imageUrl, imageUrls, typedSolution)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Sidebar (Navigation Grid, Timer, Submit Action) */}
        {/* ============================================================ */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 lg:sticky lg:top-20 space-y-4">
          {/* Digital Timer Card */}
          <div
            className={`p-5 rounded-2xl border transition-all shadow-xs ${
              isExamLocked
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : timeLeft <= 60
                ? 'bg-rose-50 border-rose-300 text-rose-950 ring-2 ring-rose-400/40 animate-pulse'
                : timeLeft <= 300
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" /> Thời gian làm bài
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                Quy định: {durationMinutes}p
              </span>
            </div>

            <div className="text-center py-2">
              <div
                className={`text-4xl font-black font-mono tracking-tight ${
                  isExamLocked && isTimeUp
                    ? 'text-rose-600'
                    : timeLeft <= 60
                    ? 'text-rose-600 animate-pulse'
                    : timeLeft <= 300
                    ? 'text-amber-600'
                    : 'text-indigo-900'
                }`}
              >
                {isExamLocked && isTimeUp ? '00:00' : formatTime(timeLeft)}
              </div>
              <span className="text-[11px] font-semibold text-slate-500 block mt-1">
                {isExamLocked
                  ? isTimeUp
                    ? '🔒 Đã tự động thu bài do hết giờ'
                    : '✅ Đã hoàn tất bài nộp'
                  : timeLeft <= 60
                  ? '🚨 Hết giờ hệ thống sẽ tự động nộp bài!'
                  : 'Thời gian đang đếm ngược'}
              </span>
            </div>

            {/* Time progress bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-1000 ${
                  isExamLocked
                    ? 'bg-slate-400'
                    : timeLeft <= 60
                    ? 'bg-rose-500'
                    : timeLeft <= 300
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, (timeLeft / initialSeconds) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Tiến độ hoàn thành:</span>
              <span className="font-extrabold text-indigo-600">
                {totalAnsweredCount}/{totalQuestions} câu ({completionPercentage}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Question Grid Navigation Card (Bảng Danh Sách Câu Hỏi) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-indigo-600" /> Bảng Số Thứ Tự Câu Hỏi
              </h4>
              <span className="text-[10px] text-slate-400 font-semibold">Click để chuyển đến câu</span>
            </div>

            {/* Section 1: Multiple Choice numbers */}
            {exam.multipleChoice.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Phần I: Trắc nghiệm ({exam.multipleChoice.length} câu)
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {exam.multipleChoice.map((mc, idx) => {
                    const qNum = idx + 1;
                    const questionId = `question-${qNum}`;
                    const isDone = isMcAnswered(mc.id);

                    return (
                      <button
                        type="button"
                        key={mc.id}
                        onClick={() => scrollToQuestion(questionId)}
                        className={`h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                          isDone
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'bg-white text-slate-800 border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20'
                        }`}
                        title={`Câu ${qNum}: ${isDone ? 'Đã chọn (' + mcAnswers[mc.id] + ')' : 'Chưa chọn'}`}
                      >
                        {qNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: True/False numbers */}
            {exam.trueFalseQuestions.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Phần II: Đúng / Sai ({exam.trueFalseQuestions.length} câu)
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {exam.trueFalseQuestions.map((tf, idx) => {
                    const qNum = exam.multipleChoice.length + idx + 1;
                    const questionId = `question-${qNum}`;
                    const isDone = isTfAnswered(tf.id);

                    return (
                      <button
                        type="button"
                        key={tf.id}
                        onClick={() => scrollToQuestion(questionId)}
                        className={`h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                          isDone
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'bg-white text-slate-800 border-2 border-slate-300 hover:border-amber-500 hover:bg-amber-50/20'
                        }`}
                        title={`Câu ${qNum}: ${isDone ? 'Đã trả lời' : 'Chưa trả lời'}`}
                      >
                        {qNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Essay numbers */}
            {exam.essays.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Phần III: {part3Mode === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'} ({exam.essays.length} câu)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {exam.essays.map((essay, idx) => {
                    const qNum = exam.multipleChoice.length + exam.trueFalseQuestions.length + idx + 1;
                    const questionId = `question-${qNum}`;
                    const isDone = isEssayAnswered(essay.id);

                    return (
                      <button
                        type="button"
                        key={essay.id}
                        onClick={() => scrollToQuestion(questionId)}
                        className={`h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                          isDone
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'bg-white text-slate-800 border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20'
                        }`}
                        title={`Câu ${qNum}: ${isDone ? 'Đã làm' : 'Chưa làm'}`}
                      >
                        {qNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 inline-block shadow-2xs" />
                <span>Xanh: Đã chọn</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-white border-2 border-slate-300 inline-block" />
                <span>Trắng: Chưa làm</span>
              </span>
            </div>

            {/* Big Action Submit Button */}
            {!isSubmitted && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmitModal(true)}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" /> NỘP BÀI THI NGAY
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE FLOATING BOTTOM BAR (Tối ưu trải nghiệm làm bài trên điện thoại)     */}
      {/* ========================================================================= */}
      {isExamStarted && !isSubmitted && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-2 lg:hidden">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border ${
                timeLeft <= 60
                  ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                  : timeLeft <= 300
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}
            >
              {formatTime(timeLeft)}
            </span>
            <span className="text-xs font-bold text-slate-700">
              Đã làm: <b className="text-emerald-700">{totalAnsweredCount}/{totalQuestions}</b>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMobileQuestionGridOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Bảng câu</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmSubmitModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE QUESTION GRID DRAWER / MODAL */}
      {isMobileQuestionGridOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl max-h-[82vh] flex flex-col shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ListChecks className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Bảng Số Thứ Tự Câu Hỏi</h4>
                  <p className="text-[11px] text-slate-500">Chạm vào câu để cuộn đến làm bài</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileQuestionGridOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Questions Grid List */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 py-1.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block shadow-2xs" />
                  <span>Xanh: Đã làm</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-white border-2 border-slate-300 inline-block" />
                  <span>Trắng: Chưa làm</span>
                </span>
              </div>

              {/* Part 1 */}
              {exam.multipleChoice.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Phần I: Trắc nghiệm ({exam.multipleChoice.length} câu)
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {exam.multipleChoice.map((mc, idx) => {
                      const qNum = idx + 1;
                      const isDone = isMcAnswered(mc.id);
                      return (
                        <button
                          key={mc.id}
                          type="button"
                          onClick={() => {
                            scrollToQuestion(`question-${qNum}`);
                            setIsMobileQuestionGridOpen(false);
                          }}
                          className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                            isDone
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-slate-800 border-2 border-slate-300'
                          }`}
                        >
                          {qNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part 2 */}
              {exam.trueFalseQuestions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Phần II: Đúng / Sai ({exam.trueFalseQuestions.length} câu)
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {exam.trueFalseQuestions.map((tf, idx) => {
                      const qNum = exam.multipleChoice.length + idx + 1;
                      const isDone = isTfAnswered(tf.id);
                      return (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={() => {
                            scrollToQuestion(`question-${qNum}`);
                            setIsMobileQuestionGridOpen(false);
                          }}
                          className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                            isDone
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-slate-800 border-2 border-slate-300'
                          }`}
                        >
                          {qNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part 3 */}
              {exam.essays.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Phần III: {part3Mode === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'} ({exam.essays.length} câu)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {exam.essays.map((essay, idx) => {
                      const qNum = exam.multipleChoice.length + exam.trueFalseQuestions.length + idx + 1;
                      const isDone = isEssayAnswered(essay.id);
                      return (
                        <button
                          key={essay.id}
                          type="button"
                          onClick={() => {
                            scrollToQuestion(`question-${qNum}`);
                            setIsMobileQuestionGridOpen(false);
                          }}
                          className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                            isDone
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-slate-800 border-2 border-slate-300'
                          }`}
                        >
                          {qNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setIsMobileQuestionGridOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileQuestionGridOpen(false);
                  setShowConfirmSubmitModal(true);
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-extrabold text-xs text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" /> Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Submission */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
              <HelpCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Xác Nhận Nộp Bài Thi?</h3>
              <p className="text-xs text-slate-500">
                Thí sinh: <b className="text-slate-800">{studentName}</b> - Lớp <b className="text-slate-800">{studentClass}</b> (SBD: {studentId})
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">Số câu đã trả lời:</span>
                <span className="text-emerald-700 font-extrabold">{totalAnsweredCount} / {totalQuestions} câu</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">Thời gian còn lại:</span>
                <span className="text-indigo-700 font-mono font-black">{formatTime(timeLeft)}</span>
              </div>

              {totalAnsweredCount < totalQuestions && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold text-left">
                  ⚠️ Lưu ý: Bạn vẫn còn <b>{totalQuestions - totalAnsweredCount} câu</b> chưa trả lời. Bạn có muốn rà soát lại trước khi nộp không?
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmitModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                onClick={() => handleSubmitExam(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Đồng ý nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Info Modal */}
      {isEditInfoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Sửa Thông Tin Thí Sinh</h3>
              <button
                type="button"
                onClick={() => setIsEditInfoOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Họ và Tên</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Lớp</label>
                  <input
                    type="text"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">SBD / Mã HS</label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-800"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditInfoOpen(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Lưu Thay Đổi
            </button>
          </div>
        </div>
      )}

      {/* Time-up Auto-Submitted Notification Modal */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner ring-8 ring-rose-50 animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Hết Giờ Làm Bài Thi
              </span>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ĐÃ HẾT GIỜ LÀM BÀI!
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Thời gian làm bài thi quy định <span className="font-bold text-slate-800">{durationMinutes} phút</span> đã kết thúc.
                Hệ thống đã <span className="font-bold text-rose-600">tự động khóa đề thi</span> và thu nộp toàn bộ kết quả làm bài của thí sinh <span className="font-bold text-indigo-700">{studentName || 'Học sinh'}</span>.
              </p>
            </div>

            {calculatedScore && (
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">Trắc nghiệm</span>
                  <span className="text-base font-black text-indigo-600">{(calculatedScore.mc + calculatedScore.tf).toFixed(2)}đ</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">Phần III</span>
                  <span className="text-base font-black text-emerald-600">{calculatedScore.essay.toFixed(2)}đ</span>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 rounded-xl shadow-xs">
                  <span className="text-[10px] font-bold uppercase block tracking-wider">Tổng điểm</span>
                  <span className="text-lg font-black">{calculatedScore.total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowTimeoutModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Xem Lại Bài Đã Khóa
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTimeoutModal(false);
                  onViewGradebook();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trophy className="w-4 h-4 text-amber-300" /> Bảng Điểm Toàn Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KHIẾU NẠI / PHÚC KHẢO ĐIỂM DÀNH CHO HỌC SINH */}
      {isAppealModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Khiếu Nại & Phúc Khảo Bài Thi</h3>
                  <p className="text-xs text-slate-500">Gửi trực tiếp đến Thầy/Cô để thẩm định lại điểm bài làm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAppealModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {appealSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                <div className="font-black text-sm">{appealSuccessMsg}</div>
                <p className="text-xs text-emerald-800">
                  Thầy/Cô sẽ nhận được yêu cầu phúc khảo của em trong Bảng Điểm Điện Tử và phản hồi kèm điểm cập nhật nếu được duyệt.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(false)}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer hover:bg-emerald-700"
                >
                  Đóng Hộp Thoại
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!appealReason.trim()) return;
                  setIsSubmittingAppeal(true);
                  try {
                    const subId =
                      activeSubmission?.id ||
                      myPastSubmissionsForExam[0]?.id ||
                      `${assignedExamCode || exam.examCode}_${studentClass}_${studentName}_${Date.now()}`;
                    await submitStudentAppeal({
                      submissionId: subId,
                      examCode: assignedExamCode || exam.examCode,
                      studentId: studentId || 'HS',
                      studentName: studentName || 'Học sinh',
                      studentClass: studentClass || 'Lớp',
                      questionRef: appealQuestionRef,
                      reason: appealReason.trim(),
                    });
                    setAppealSuccessMsg('Đã gửi đơn khiếu nại thành công đến Giáo viên!');
                  } catch (err: any) {
                    alert('Lỗi gửi khiếu nại: ' + (err.message || 'Vui lòng thử lại'));
                  } finally {
                    setIsSubmittingAppeal(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Học sinh:</span>
                    <span className="font-bold text-slate-900">{studentName} (Lớp {studentClass})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã đề:</span>
                    <span className="font-mono font-bold text-indigo-700">{assignedExamCode || exam.examCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Điểm hiện tại:</span>
                    <span className="font-black text-amber-700">
                      {calculatedScore ? calculatedScore.total.toFixed(2) : (myPastSubmissionsForExam[0]?.totalScore?.toFixed(2) || '—')}đ
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Chọn câu hoặc mục cần khiếu nại:
                  </label>
                  <select
                    value={appealQuestionRef}
                    onChange={(e) => setAppealQuestionRef(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="Điểm toàn bài">Điểm toàn bộ bài thi</option>
                    <option value="Phần I: Trắc nghiệm 4 lựa chọn">Phần I: Trắc nghiệm 4 lựa chọn</option>
                    <option value="Phần II: Câu hỏi Đúng/Sai">Phần II: Câu hỏi Đúng/Sai</option>
                    <option value="Phần III: Trả lời ngắn / Tự luận">Phần III: Trả lời ngắn / Tự luận</option>
                    {exam.essays.map((es, idx) => {
                      const qN = exam.multipleChoice.length + exam.trueFalseQuestions.length + idx + 1;
                      return (
                        <option key={es.id} value={`Câu ${qN} (Phần III)`}>
                          Câu {qN}: {es.question.slice(0, 40)}...
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Lý do khiếu nại & dẫn chứng của em: <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="Ví dụ: Em tính ra kết quả là 1/2 và đã biến đổi đúng theo công thức SGK, nhưng hệ thống báo sai; hoặc bài làm tự luận của em viết đủ các bước lập luận..."
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                  />
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAppealModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAppeal || !appealReason.trim()}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingAppeal ? 'Đang gửi...' : 'Gửi Đơn Khiếu Nại'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
