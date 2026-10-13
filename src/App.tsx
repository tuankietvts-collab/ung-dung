import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  FileSpreadsheet,
  Code2,
  BookOpen,
  CheckCircle2,
  Layers,
  ChevronRight,
  Sigma,
  Shuffle,
  Cloud,
  Check,
  AlertCircle,
  User,
  LogOut,
  ShieldCheck,
  Share2,
  Lock,
  ArrowRight,
  Home,
  Building2,
  Mail,
  PlusCircle,
  Users,
  LayoutDashboard,
  Menu,
  X,
  FileText,
  Send,
  HelpCircle,
  FolderOpen,
  Settings,
  SlidersHorizontal,
  PenTool,
  ArrowLeft,
  Calendar,
  Upload,
  Play,
  Download,
  Clock,
  Trash2,
  Award,
  Trophy,
  Filter,
  Search,
  Copy
} from 'lucide-react';
import { AppUser, Exam, StudentSubmission, StudentRosterItem, ClassGroup, TeacherProfile } from './types/exam';
import {
  generate45ExamVariants,
  AnswerMatrixRow,
  Generated45Package,
  VariantGenerationConfig,
  sanitizeExamQuestions
} from './services/examPermuter';
import {
  saveExamToFirestore,
  deleteExamFromFirestore,
  subscribeExamsFromFirestore,
  saveSubmissionToFirestore,
  deleteSubmissionFromFirestore,
  subscribeSubmissionsFromFirestore,
  subscribeStudentRosterFromFirestore,
  saveStudentRosterToFirestore,
  deleteStudentFromFirestore,
  subscribeClassGroupsFromFirestore,
  saveClassGroupToFirestore,
  deleteClassGroupFromFirestore,
  getStoredUser,
  setStoredUser,
  logoutAppUser,
  getStoredExams,
  getStoredClasses,
  subscribeTeachersFromFirestore
} from './services/firebase';
import { isInvalidStudentName } from './services/studentRosterParser';

// Dedicated views
import { OverviewDashboard } from './components/OverviewDashboard';
import { ExamBankView } from './components/ExamBankView';
import { ExamVariantsView } from './components/ExamVariantsView';
import { TeacherExamStudio } from './components/TeacherExamStudio';
import { DocumentExamStudio } from './components/DocumentExamStudio';
import { StudentExamRoom } from './components/StudentExamRoom';
import { GradebookReport } from './components/GradebookReport';
import { BackendCodeViewer } from './components/BackendCodeViewer';
import { ClassManagementModal } from './components/ClassManagementModal';
import { TeacherEssayGradingModal } from './components/TeacherEssayGradingModal';
import { AssignExamModal } from './components/AssignExamModal';
import { AuthPortal } from './components/AuthPortal';
import { AuthModal } from './components/AuthModal';
import { AdminTeacherApprovalModal } from './components/AdminTeacherApprovalModal';

// High-level vertical sidebar navigation tabs (Tham khảo Ezthi Style & khoa học dễ nhìn)
export type MainNavSection =
  | 'overview'        // 1. Tổng quan
  | 'exams'           // 2. Quản lý Đề thi (Gom: Ngân hàng đề, Soạn đề AI, Đọc file, Trộn mã đề)
  | 'student_room'    // 3. Phòng thi trực tuyến
  | 'classes_grading' // 4. Lớp học & Chấm thi (Gom: Bảng điểm, Quản lý lớp, Chấm tự luận AI)
  | 'tools';          // 5. Tiện ích & Hệ thống (Gom: Mã Python, Duyệt GV, Chuẩn GDPT)

export default function App() {
  // Multi-role AppUser Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());

  // Direct exam link session check (?exam=... or ?mode=student)
  const [isDirectExamSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return !!(p.get('exam') || p.get('examId') || p.get('code') || p.get('mode') === 'student');
  });

  // Vertical Navigation State (Clean 5 parent categories)
  const [currentNav, setCurrentNav] = useState<MainNavSection>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('exam') || p.get('mode') === 'student') return 'student_room';
    }
    const user = getStoredUser();
    if (user && user.role === 'student') return 'student_room';
    return 'overview';
  });

  // Sub-tab selectors for grouped categories
  const [subExamTab, setSubExamTab] = useState<'bank' | 'create_ai' | 'create_file' | 'variants'>('bank');
  const [subGradingTab, setSubGradingTab] = useState<'gradebook' | 'classes' | 'essay_grading'>('classes');
  const [subToolsTab, setSubToolsTab] = useState<'python_code' | 'admin_approval' | 'guide'>('python_code');

  // Mobile drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Cloud State from Firebase Firestore with instant local defaults
  const [savedExams, setSavedExams] = useState<Exam[]>(() => getStoredExams());
  const [currentExam, setCurrentExam] = useState<Exam | null>(() => {
    const list = getStoredExams();
    return list.length > 0 ? sanitizeExamQuestions(list[0]) : null;
  });
  const [variantPackage, setVariantPackage] = useState<Generated45Package | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentRosterItem[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>(() => getStoredClasses());

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAdminTeacherModalOpen, setIsAdminTeacherModalOpen] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState<boolean>(false);
  const [isEssayGradingModalOpen, setIsEssayGradingModalOpen] = useState<boolean>(false);
  const [pendingTeacherCount, setPendingTeacherCount] = useState<number>(0);

  // Drill-down navigation for classes & grading (User Request 3: Lớp học -> Bài kiểm tra -> Bảng điểm)
  const [selectedClassForGrading, setSelectedClassForGrading] = useState<string | null>(null);
  const [selectedExamForGrading, setSelectedExamForGrading] = useState<Exam | null>(null);
  const [classModalSelectedClass, setClassModalSelectedClass] = useState<string>('12A1');
  const [classModalActiveTab, setClassModalActiveTab] = useState<'classes' | 'students' | 'quick_paste' | 'accounts' | 'assign_exam'>('classes');

  const [isCloudSaving, setIsCloudSaving] = useState<boolean>(false);
  const [backendUrl, setBackendUrl] = useState<string>('');

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Listen to teachers for admin
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      const unsub = subscribeTeachersFromFirestore((teacherList) => {
        const pending = teacherList.filter((t) => !t.isApproved).length;
        setPendingTeacherCount(pending);
      });
      return () => unsub();
    }
  }, [currentUser?.role]);

  // Inspect URL parameters for direct exam link access (?exam=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const examParam = params.get('exam') || params.get('examId') || params.get('code');
      if (examParam) {
        const found = savedExams.find(
          (e) => e.examCode?.toLowerCase() === examParam.toLowerCase() || e.id === examParam
        );
        if (found) {
          setCurrentExam(sanitizeExamQuestions(found));
          setCurrentNav('student_room');
        }
      }
    }
  }, [savedExams]);

  // Firebase Real-time listeners
  useEffect(() => {
    const unsubExams = subscribeExamsFromFirestore((firestoreExams) => {
      if (firestoreExams.length > 0) {
        const sanitized = firestoreExams.map(sanitizeExamQuestions);
        setSavedExams(sanitized);
        setCurrentExam((prev) => {
          if (!prev) return sanitized[0];
          const matched = sanitized.find((e) => e.id === prev.id);
          return matched ? matched : sanitized[0];
        });
      }
    });

    const unsubSubs = subscribeSubmissionsFromFirestore((firestoreSubs) => {
      setSubmissions(firestoreSubs);
    });

    const unsubRoster = subscribeStudentRosterFromFirestore((firestoreStudents) => {
      setStudentRoster(firestoreStudents);
    });

    const unsubClasses = subscribeClassGroupsFromFirestore((firestoreClasses) => {
      setClasses(firestoreClasses);
    });

    return () => {
      unsubExams();
      unsubSubs();
      unsubRoster();
      unsubClasses();
    };
  }, []);

  // Sync current user state
  const handleAuthSuccess = (user: AppUser) => {
    setStoredUser(user);
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    showToast(`Chào mừng ${user.fullName} (${user.role === 'teacher' ? 'Giáo viên' : user.role === 'admin' ? 'Quản trị viên' : 'Học sinh'}) đã đăng nhập thành công!`);
    if (user.role === 'student') {
      setCurrentNav('student_room');
    }
  };

  const handleUserLogout = () => {
    logoutAppUser();
    setCurrentUser(null);
    showToast('Đã đăng xuất tài khoản an toàn.');
  };

  // Exam Created handler
  const handleExamCreated = (newExam: Exam) => {
    const sanitized = sanitizeExamQuestions(newExam);
    setCurrentExam(sanitized);
    setSavedExams((prev) => {
      const exists = prev.some((e) => e.id === sanitized.id);
      if (exists) {
        return prev.map((e) => (e.id === sanitized.id ? sanitized : e));
      }
      return [sanitized, ...prev];
    });
    // Chuyển sang Ngân hàng đề thi để xem đề vừa tạo
    setCurrentNav('exams');
    setSubExamTab('bank');
    showToast(`Đã lưu và kích hoạt đề thi [${sanitized.examCode}] thành công!`);
  };

  // Save Exam to Cloud Firestore
  const handleSaveExamToCloud = async (examToSave: Exam) => {
    setIsCloudSaving(true);
    try {
      const sanitized = sanitizeExamQuestions(examToSave);
      await saveExamToFirestore(sanitized);
      showToast(`Đã đồng bộ đề thi [${sanitized.examCode}] lên Cloud Firestore thành công!`);
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi lưu lên Cloud', 'error');
    } finally {
      setIsCloudSaving(false);
    }
  };

  // Delete Exam from Cloud
  const handleDeleteExamFromCloud = async (examId: string) => {
    try {
      await deleteExamFromFirestore(examId);
      setSavedExams((prev) => prev.filter((e) => e.id !== examId));
      if (currentExam?.id === examId) {
        const remaining = savedExams.filter((e) => e.id !== examId);
        setCurrentExam(remaining.length > 0 ? remaining[0] : null);
      }
      showToast('Đã xóa đề thi khỏi ngân hàng thành công.');
    } catch (e: any) {
      showToast(e.message || 'Lỗi xóa đề thi', 'error');
    }
  };

  // Generate 45 Exam Variants
  const handleGenerateVariants = (config?: VariantGenerationConfig) => {
    if (!currentExam) return;
    try {
      const pkg = generate45ExamVariants(currentExam, studentRoster, config || { mode: 'shuffle_only', numVariants: 24 });
      setVariantPackage(pkg);
      showToast(`Đã trộn thành công ${pkg.variants.length} mã đề thi chuẩn khảo thí!`);
    } catch (e: any) {
      showToast(e.message || 'Lỗi trộn đề thi', 'error');
    }
  };

  // Student submission handler
  const handleNewSubmission = async (newSub: StudentSubmission) => {
    setSubmissions((prev) => [newSub, ...prev.filter((s) => s.id !== newSub.id)]);
    try {
      await saveSubmissionToFirestore(newSub);
    } catch (e) {
      console.warn('Lưu bài nộp lên Firestore gặp lỗi:', e);
    }
  };

  // Class Management Handlers
  const handleSaveClass = async (cl: ClassGroup) => {
    await saveClassGroupToFirestore(cl);
    setClasses((prev) => {
      const exists = prev.some((c) => c.id === cl.id);
      return exists ? prev.map((c) => (c.id === cl.id ? cl : c)) : [cl, ...prev];
    });
    showToast(`Đã lưu thông tin lớp [${cl.name}] thành công!`);
  };

  const handleDeleteClass = async (classId: string) => {
    await deleteClassGroupFromFirestore(classId);
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    showToast('Đã xóa lớp học thành công.');
  };

  const handleSaveRoster = async (incomingStudents: StudentRosterItem[]) => {
    await saveStudentRosterToFirestore(incomingStudents);
    setStudentRoster((prev) => {
      const map = new Map<string, StudentRosterItem>();
      prev.forEach((s) => map.set(s.id, s));
      incomingStudents.forEach((s) => map.set(s.id, s));
      return Array.from(map.values());
    });
    showToast(`Đã cập nhật danh sách ${incomingStudents.length} học sinh thành công!`);
  };

  const handleDeleteStudent = async (studentId: string) => {
    await deleteStudentFromFirestore(studentId);
    setStudentRoster((prev) => prev.filter((s) => s.id !== studentId));
    showToast('Đã xóa học sinh khỏi danh sách.');
  };

  // Assign Exam to Classes/Students
  const handleAssignExam = async (
    assignedClasses: string[],
    assignedStudentIds: string[],
    note: string,
    options?: {
      variantCount?: number;
      durationMinutes?: number;
      maxAttempts?: number;
    }
  ) => {
    if (!currentExam) return;
    const variantCount = options?.variantCount || currentExam.variantCount || 4;
    const durationMinutes = options?.durationMinutes || currentExam.durationMinutes || 45;
    const maxAttempts = options?.maxAttempts !== undefined ? options.maxAttempts : (currentExam.maxAttempts ?? 1);

    // Auto-generate variants if requested
    let generatedVariants = variantPackage?.variants || [];
    if (variantCount > 1) {
      try {
        const pkg = generate45ExamVariants(currentExam, studentRoster, {
          mode: 'shuffle_only',
          numVariants: variantCount
        });
        setVariantPackage(pkg);
        generatedVariants = pkg.variants;
      } catch (err) {
        console.warn('Auto variant generation warning:', err);
      }
    }

    const updatedExam: Exam = {
      ...currentExam,
      variantCount,
      durationMinutes,
      maxAttempts,
      variants: generatedVariants,
      assignedClassNames: assignedClasses,
      assignedStudentIds: assignedStudentIds,
      assignedGroupDetails: note,
      className: assignedClasses.length > 0 ? assignedClasses[0] : currentExam.className,
    };
    handleExamCreated(updatedExam);
    await handleSaveExamToCloud(updatedExam);
    setIsAssignModalOpen(false);
    showToast(
      assignedClasses.length > 0
        ? `Đã giao đề [${updatedExam.examCode}] (${variantCount} mã đề, ${durationMinutes}p, tối đa ${maxAttempts === 0 ? '∞' : maxAttempts} lần làm) thành công cho lớp ${assignedClasses.join(', ')}!`
        : `Đã giao đề [${updatedExam.examCode}] cho ${assignedStudentIds.length} học sinh!`
    );
  };

  // Helper handler for Overview navigation clicks
  const handleLegacyNavigate = (target: string) => {
    if (target === 'create_exam') {
      setCurrentNav('exams');
      setSubExamTab('create_ai');
    } else if (target === 'exam_bank') {
      setCurrentNav('exams');
      setSubExamTab('bank');
    } else if (target === 'exam_variants') {
      setCurrentNav('exams');
      setSubExamTab('variants');
    } else if (target === 'student_room') {
      setCurrentNav('student_room');
    } else if (target === 'classes') {
      setCurrentNav('classes_grading');
      setSubGradingTab('classes');
      setIsClassModalOpen(true);
    } else if (target === 'gradebook') {
      setCurrentNav('classes_grading');
      setSubGradingTab('gradebook');
    } else if (target === 'essay_grading') {
      setCurrentNav('classes_grading');
      setSubGradingTab('essay_grading');
      setIsEssayGradingModalOpen(true);
    } else if (target === 'python_code') {
      setCurrentNav('tools');
      setSubToolsTab('python_code');
    } else {
      setCurrentNav('overview');
    }
  };

  // Nav Groups configuration mirroring Ezthi.com (Image 3)
  const isStudent = currentUser?.role === 'student';
  const isAdmin = currentUser?.role === 'admin';

  // SIDEBAR ITEMS: Focused, professional, organized
  const sidebarItems = isStudent ? [
    {
      id: 'student_room' as MainNavSection,
      label: 'Phòng thi trực tuyến',
      icon: GraduationCap,
      description: 'Làm bài thi trực tiếp với MathLive'
    },
    {
      id: 'classes_grading' as MainNavSection,
      label: 'Bảng điểm & Kết quả',
      icon: FileSpreadsheet,
      description: 'Xem điểm và lời giải chi tiết'
    }
  ] : [
    {
      id: 'overview' as MainNavSection,
      label: 'Tổng quan',
      icon: LayoutDashboard,
      description: 'Thống kê & Lối tắt'
    },
    {
      id: 'exams' as MainNavSection,
      label: 'Quản lý Đề thi',
      icon: BookOpen,
      badge: savedExams.length,
      description: 'Ngân hàng, Soạn AI, Nhập file, Trộn đề'
    },
    {
      id: 'student_room' as MainNavSection,
      label: 'Phòng thi trực tuyến',
      icon: GraduationCap,
      description: 'Làm bài thi WYSIWYG & Giám sát'
    },
    {
      id: 'classes_grading' as MainNavSection,
      label: 'Lớp học & Chấm điểm',
      icon: Users,
      badge: submissions.length > 0 ? submissions.length : classes.length,
      description: 'Bảng điểm, Danh sách lớp, Chấm AI'
    },
    {
      id: 'tools' as MainNavSection,
      label: 'Công cụ & Tiện ích',
      icon: SlidersHorizontal,
      badge: isAdmin && pendingTeacherCount > 0 ? pendingTeacherCount : undefined,
      description: 'Mã Python, Quản trị, Chuẩn GDPT'
    }
  ];

  // Title for top bar
  const getNavTitle = () => {
    switch (currentNav) {
      case 'overview':
        return 'Tổng quan hệ thống EduMath AI';
      case 'exams':
        if (subExamTab === 'bank') return 'Quản lý Đề thi / Ngân hàng đề thi';
        if (subExamTab === 'create_ai') return 'Quản lý Đề thi / Soạn đề AI theo Ma trận SGK';
        if (subExamTab === 'create_file') return 'Quản lý Đề thi / Số hóa đề từ File Word, PDF, Ảnh';
        if (subExamTab === 'variants') return 'Quản lý Đề thi / Trộn mã đề thi chống gian lận';
        return 'Quản lý Đề thi';
      case 'student_room':
        return 'Phòng thi trực tuyến / Làm bài thi chuẩn SGK';
      case 'classes_grading':
        if (subGradingTab === 'gradebook') return 'Lớp học & Chấm điểm / Bảng điểm & Thống kê';
        if (subGradingTab === 'classes') return 'Lớp học & Chấm điểm / Quản lý Lớp học & Học sinh';
        if (subGradingTab === 'essay_grading') return 'Lớp học & Chấm điểm / Chấm bài tự luận AI';
        return 'Lớp học & Chấm điểm';
      case 'tools':
        if (subToolsTab === 'python_code') return 'Công cụ & Tiện ích / Mã nguồn Python Toán học';
        if (subToolsTab === 'admin_approval') return 'Công cụ & Tiện ích / Duyệt tài khoản giáo viên';
        return 'Công cụ & Tiện ích / Chuẩn cấu trúc đề thi GDPT 2018';
      default:
        return 'EduMath AI';
    }
  };

  // If user is not logged in and not in direct exam session, show AuthPortal
  if (!currentUser && !isDirectExamSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-between">
        <AuthPortal
          onAuthSuccess={handleAuthSuccess}
        />
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-black transition-all animate-in fade-in slide-in-from-bottom-5 ${
              toast.type === 'error'
                ? 'bg-rose-600 text-white shadow-rose-900/40'
                : toast.type === 'info'
                ? 'bg-sky-600 text-white shadow-sky-900/40'
                : 'bg-emerald-600 text-white shadow-emerald-900/40'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row text-slate-900">
      {/* Toast Notification Container */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-black transition-all animate-in fade-in slide-in-from-bottom-5 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white shadow-rose-900/40'
              : toast.type === 'info'
              ? 'bg-sky-600 text-white shadow-sky-900/40'
              : 'bg-emerald-600 text-white shadow-emerald-900/40'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EZTHI-STYLE VERTICAL LEFT SIDEBAR (THANH MENU DỌC KHOA HỌC GỌN GÀNG)       */}
      {/* ========================================================================= */}
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden animate-in fade-in"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 transition-transform duration-300 border-r border-slate-800 shadow-xl lg:shadow-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo & Title */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-[#0f172a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Sigma className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-white">EduMath AI</span>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  GDPT
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Khảo thí & Chấm AI</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vertical Menu Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono mb-2">
            DANH MỤC TÍNH NĂNG
          </div>

          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentNav(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-black'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-bold'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-indigo-100 font-normal' : 'text-slate-500 font-normal'}`}>
                      {item.description}
                    </div>
                  </div>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Profile Card & Sign Out at bottom of sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0b1120] shrink-0">
          {currentUser ? (
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 font-black text-xs ${
                  currentUser.role === 'admin' ? 'bg-rose-600' : currentUser.role === 'teacher' ? 'bg-indigo-600' : 'bg-emerald-600'
                }`}>
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-white truncate">{currentUser.fullName}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentUser.role === 'admin' ? 'Quản trị viên' : currentUser.role === 'teacher' ? 'Giáo viên Toán' : 'Học sinh'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUserLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đăng Nhập Thầy/Cô</span>
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN VIEW AREA (GIAO DIỆN CHÍNH BÊN PHẢI)                                 */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Title */}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                {getNavTitle()}
              </h1>
              {currentExam && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 hidden sm:flex truncate">
                  <span>Đề đang kích hoạt:</span>
                  <span className="font-bold text-indigo-700 truncate max-w-xs">{currentExam.title}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700 shrink-0">
                    {currentExam.examCode}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Header Status */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Cloud className="w-3.5 h-3.5 text-sky-600 hidden sm:inline" />
              <span className="font-bold text-indigo-700">{savedExams.length} đề thi</span>
              {classes.length > 0 && (
                <span className="text-slate-400 font-medium hidden md:inline">• {classes.length} lớp</span>
              )}
            </div>

            {/* Direct Switch to Exam button if teacher */}
            {!isStudent && currentNav !== 'student_room' && (
              <button
                type="button"
                onClick={() => setCurrentNav('student_room')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <GraduationCap className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Phòng Thi Trực Tuyến</span>
                <span className="sm:hidden">Thi</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {currentNav === 'overview' && (
            <OverviewDashboard
              currentExam={currentExam}
              savedExams={savedExams}
              submissions={submissions}
              roster={studentRoster}
              classes={classes}
              currentUser={currentUser}
              onNavigate={handleLegacyNavigate}
              onSelectExam={(exam) => setCurrentExam(exam)}
              onOpenAssignModal={() => setIsAssignModalOpen(true)}
              showToast={showToast}
            />
          )}

          {/* TAB 2: QUẢN LÝ ĐỀ THI (DỒN TẤT CẢ CÁC TÍNH NĂNG VỀ ĐỀ VÀO 1 TAB DUY NHẤT) */}
          {currentNav === 'exams' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* SUB-NAVIGATION PILLS: Hiển thị các mục liên quan đến Đề thi */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSubExamTab('bank')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subExamTab === 'bank'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Ngân Hàng Đề Thi ({savedExams.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubExamTab('create_ai')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subExamTab === 'create_ai'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Soạn Đề AI Theo Ma Trận SGK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubExamTab('create_file')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subExamTab === 'create_file'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-sky-300" />
                    <span>Đọc File Đa Định Dạng (.docx, .pdf, ảnh)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubExamTab('variants')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subExamTab === 'variants'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Shuffle className="w-4 h-4 text-purple-200" />
                    <span>Trộn Mã Đề (24 - 45 Đề)</span>
                  </button>
                </div>

                {currentExam && (
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Giao Đề Cho Lớp</span>
                  </button>
                )}
              </div>

              {/* RENDER NỘI DUNG TƯƠNG ỨNG CỦA TAB ĐỀ THI */}
              {subExamTab === 'bank' && (
                <ExamBankView
                  savedExams={savedExams}
                  currentExam={currentExam}
                  classes={classes}
                  onSelectExam={(exam) => setCurrentExam(exam)}
                  onNavigate={(tab) => {
                    if (tab === 'create_exam') setSubExamTab('create_ai');
                    else if (tab === 'exam_variants') setSubExamTab('variants');
                    else handleLegacyNavigate(tab);
                  }}
                  onOpenAssignModal={() => setIsAssignModalOpen(true)}
                  onDeleteExam={handleDeleteExamFromCloud}
                  showToast={showToast}
                />
              )}

              {subExamTab === 'create_ai' && (
                <TeacherExamStudio
                  currentExam={currentExam}
                  onExamCreated={handleExamCreated}
                  onSaveExamToCloud={handleSaveExamToCloud}
                  showToast={showToast}
                />
              )}

              {subExamTab === 'create_file' && (
                <DocumentExamStudio
                  onExamCreated={handleExamCreated}
                  showToast={showToast}
                />
              )}

              {subExamTab === 'variants' && (
                <ExamVariantsView
                  currentExam={currentExam}
                  savedExams={savedExams}
                  roster={studentRoster}
                  variants={variantPackage?.variants || []}
                  answerMatrix={variantPackage?.answerMatrix || []}
                  onSelectVariant={(variant) => setCurrentExam(variant)}
                  onGenerateVariants={handleGenerateVariants}
                  onNavigate={handleLegacyNavigate}
                  showToast={showToast}
                />
              )}
            </div>
          )}

          {/* TAB 3: PHÒNG THI TRỰC TUYẾN (HỌC SINH LÀM BÀI VỚI MATHLIVE) */}
          {currentNav === 'student_room' && (
            <StudentExamRoom
              exam={currentExam}
              savedExams={savedExams}
              submissions={submissions}
              currentUser={currentUser}
              variants={variantPackage?.variants || []}
              roster={studentRoster}
              onSelectExam={(selectedExam) => setCurrentExam(selectedExam)}
              onSelectVariant={(variant) => setCurrentExam(variant)}
              onSubmit={handleNewSubmission}
              onViewGradebook={() => {
                setCurrentNav('classes_grading');
                setSubGradingTab('gradebook');
              }}
              onGoToTeacher={() => setCurrentNav('overview')}
              backendUrl={backendUrl}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {/* TAB 4: LỚP HỌC & CHẤM ĐIỂM (ĐIỀU HƯỚNG 3 CẤP: LỚP HỌC -> BÀI KIỂM TRA -> BẢNG ĐIỂM) */}
          {currentNav === 'classes_grading' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* SUB-NAVIGATION PILLS: Lớp học & Khảo thí, Bảng điểm tổng hợp, Chấm tự luận AI */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSubGradingTab('classes');
                      setSelectedClassForGrading(null);
                      setSelectedExamForGrading(null);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subGradingTab === 'classes'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Lớp Học & Khảo Thí ({classes.length} lớp)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubGradingTab('gradebook')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subGradingTab === 'gradebook'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Bảng Điểm Tổng Hợp ({submissions.length} bài)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubGradingTab('essay_grading');
                      setIsEssayGradingModalOpen(true);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subGradingTab === 'essay_grading'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Chấm Bài Tự Luận AI Viết Tay</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClassModalActiveTab('classes');
                      setIsClassModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Thêm Lớp Mới</span>
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* CHẾ ĐỘ 1: QUẢN LÝ THEO TỪNG LỚP HỌC (ĐIỀU HƯỚNG 3 CẤP KHOA HỌC)          */}
              {/* CẤP 1: DANH SÁCH LỚP -> CẤP 2: BÀI KIỂM TRA LỚP -> CẤP 3: BẢNG ĐIỂM     */}
              {/* ========================================================================= */}
              {subGradingTab === 'classes' && (
                <div className="space-y-6">
                  {/* CẤP 1: DANH SÁCH CÁC LỚP HỌC MÀ GIÁO VIÊN ĐÃ TẠO */}
                  {!selectedClassForGrading && (
                    <div className="space-y-6">
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Phân Hệ Quản Lý Lớp Học & Khảo Thí
                            </span>
                            <span className="text-xs text-slate-500 font-mono font-bold">
                              {classes.length} Lớp • {studentRoster.filter((s) => !isInvalidStudentName(s.fullName)).length} Học Sinh
                            </span>
                          </div>
                          <h2 className="text-xl font-black text-slate-900 mt-1">
                            Danh Sách Các Lớp Học Của Thầy/Cô
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Bấm vào lớp học để xem các bài kiểm tra học sinh đã làm và bảng điểm chi tiết, hoặc bấm &quot;Cập nhật danh sách học sinh&quot; để tải file Excel vnEdu / dán danh sách.
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setClassModalActiveTab('classes');
                              setIsClassModalOpen(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>Tạo Lớp Mới</span>
                          </button>
                        </div>
                      </div>

                      {/* LƯỚI THẺ CÁC LỚP HỌC (HIỂN THỊ CHUẨN SĨ SỐ THỰC TẾ, KHÔNG CÒN 0 HỌC SINH) */}
                      {classes.length === 0 ? (
                        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                          <h4 className="font-black text-base text-slate-700">Chưa có lớp học nào</h4>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Thầy/Cô hãy bấm &quot;Tạo Lớp Mới&quot; để thêm các lớp bộ môn (Ví dụ: 10A1, 11A2, 12A8) và nạp danh sách học sinh.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setClassModalActiveTab('classes');
                              setIsClassModalOpen(true);
                            }}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>Tạo Lớp Đầu Tiên Ngay</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {classes.map((cl) => {
                            const normCls = cl.name.trim().toUpperCase().replace(/^LỚP\s+/i, '');
                            // Đếm số lượng học sinh thực tế từ studentRoster chuẩn xác
                            const classStudents = studentRoster.filter(
                              (s) =>
                                (s.className || '').trim().toUpperCase().replace(/^LỚP\s+/i, '') === normCls &&
                                !isInvalidStudentName(s.fullName)
                            );
                            const realCount = classStudents.length;

                            // Đếm các bài nộp thuộc về lớp này
                            const classSubs = submissions.filter(
                              (s) =>
                                (s.studentClass || '').trim().toUpperCase().replace(/^LỚP\s+/i, '') === normCls
                            );

                            // Đếm số lượng bài kiểm tra khác nhau mà học sinh lớp này đã làm
                            const examKeySet = new Set(
                              classSubs.map((s) => s.examId || s.examCode).filter(Boolean)
                            );

                            // Điểm trung bình của lớp
                            const avgScore =
                              classSubs.length > 0
                                ? (
                                    classSubs.reduce((acc, cur) => acc + cur.totalScore, 0) /
                                    classSubs.length
                                  ).toFixed(2)
                                : null;

                            return (
                              <div
                                key={cl.id}
                                className="bg-white rounded-3xl border-2 border-slate-200/90 hover:border-indigo-500 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col group"
                              >
                                {/* Card Header */}
                                <div className="p-5 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white border-b border-slate-100 flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-indigo-600/20 shrink-0">
                                      {cl.name.substring(0, 3)}
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                                        Lớp {cl.name}
                                      </h3>
                                      <div className="text-xs text-slate-500 font-semibold mt-0.5">
                                        Khối {cl.grade} • Năm học {cl.schoolYear || '2024 - 2025'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sĩ số Badge */}
                                  <div>
                                    {realCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>{realCount} học sinh</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>0 học sinh</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Card Body: Thống kê khảo thí */}
                                <div className="p-5 flex-1 space-y-3.5">
                                  <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 text-xs">
                                    <div>
                                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                        Bài kiểm tra đã làm
                                      </div>
                                      <div className="text-base font-black text-indigo-700 mt-0.5">
                                        {examKeySet.size} bài thi
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {classSubs.length} lượt nộp bài
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                        Điểm trung bình lớp
                                      </div>
                                      <div className="text-base font-black text-slate-900 mt-0.5">
                                        {avgScore ? `${avgScore} đ` : 'Chưa có điểm'}
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {classSubs.length > 0 ? 'Thang điểm 10.0' : 'Chưa làm bài'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Lối tắt cập nhật danh sách học sinh (Giải quyết triệt để yêu cầu 1) */}
                                  <div className="flex items-center justify-between text-xs pt-1">
                                    <span className="text-slate-500 font-medium">Danh sách lớp:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setClassModalSelectedClass(cl.name);
                                        setClassModalActiveTab('students');
                                        setIsClassModalOpen(true);
                                      }}
                                      className="font-black text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      <span>Cập nhật danh sách học sinh →</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Card Actions */}
                                <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col gap-2">
                                  {/* NÚT CHÍNH: Xem bài kiểm tra và bảng điểm (Yêu cầu 3) */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClassForGrading(cl.name);
                                      setSelectedExamForGrading(null);
                                    }}
                                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                                  >
                                    <BookOpen className="w-4 h-4" />
                                    <span>Xem Các Bài Kiểm Tra & Bảng Điểm →</span>
                                  </button>

                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setClassModalSelectedClass(cl.name);
                                        setClassModalActiveTab('students');
                                        setIsClassModalOpen(true);
                                      }}
                                      className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                      title="Tải lên file Excel vnEdu hoặc dán danh sách học sinh"
                                    >
                                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Nạp DS Học Sinh</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                        const path = typeof window !== 'undefined' ? window.location.pathname : '';
                                        const code = currentExam?.examCode || 'TOAN12-GDPT';
                                        const id = currentExam?.id || '';
                                        const link = `${origin}${path}?exam=${encodeURIComponent(code)}&examId=${encodeURIComponent(id)}&class=${encodeURIComponent(cl.name)}`;
                                        navigator.clipboard.writeText(link);
                                        showToast(`Đã sao chép link phòng thi gắn lớp ${cl.name}!`);
                                      }}
                                      className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                      title="Sao chép link làm bài thi gắn riêng với lớp này"
                                    >
                                      <Share2 className="w-3.5 h-3.5 text-slate-600" />
                                      <span>Link Thi Lớp</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CẤP 2: HIỂN THỊ CÁC BÀI HỌC SINH LÀM KIỂM TRA CỦA LỚP ĐÃ CHỌN (YÊU CẦU 3) */}
                  {selectedClassForGrading && !selectedExamForGrading && (() => {
                    const normCls = selectedClassForGrading.trim().toUpperCase().replace(/^LỚP\s+/i, '');
                    const classStudents = studentRoster.filter(
                      (s) =>
                        (s.className || '').trim().toUpperCase().replace(/^LỚP\s+/i, '') === normCls &&
                        !isInvalidStudentName(s.fullName)
                    );
                    const classSubs = submissions.filter(
                      (s) => (s.studentClass || '').trim().toUpperCase().replace(/^LỚP\s+/i, '') === normCls
                    );

                    // Thu thập danh sách các bài kiểm tra của lớp
                    const examMap = new Map<
                      string,
                      {
                        id: string;
                        examCode: string;
                        title: string;
                        durationMinutes: number;
                        subs: StudentSubmission[];
                        examObj?: Exam;
                      }
                    >();

                    classSubs.forEach((sub) => {
                      const key = sub.examId || sub.examCode;
                      if (key) {
                        if (!examMap.has(key)) {
                          const found =
                            savedExams.find((e) => e.id === sub.examId || e.examCode === sub.examCode) ||
                            (currentExam && (currentExam.id === sub.examId || currentExam.examCode === sub.examCode)
                              ? currentExam
                              : undefined);
                          examMap.set(key, {
                            id: sub.examId || (found ? found.id : key),
                            examCode: sub.examCode || (found ? found.examCode : key),
                            title: found?.title || sub.examSnapshot?.title || `Bài kiểm tra ${sub.examCode}`,
                            durationMinutes: found?.durationMinutes || sub.examSnapshot?.durationMinutes || 45,
                            subs: [],
                            examObj: found,
                          });
                        }
                        examMap.get(key)!.subs.push(sub);
                      }
                    });

                    // Bổ sung đề thi đang kích hoạt hoặc đề đã giao nếu lớp chưa có bài nộp
                    if (currentExam && !examMap.has(currentExam.id) && !examMap.has(currentExam.examCode)) {
                      examMap.set(currentExam.id, {
                        id: currentExam.id,
                        examCode: currentExam.examCode,
                        title: currentExam.title,
                        durationMinutes: currentExam.durationMinutes || 45,
                        subs: [],
                        examObj: currentExam,
                      });
                    }

                    // Nếu vẫn ít đề, hiển thị thêm các đề từ ngân hàng đề thi
                    savedExams.forEach((e) => {
                      if (!examMap.has(e.id) && !examMap.has(e.examCode)) {
                        examMap.set(e.id, {
                          id: e.id,
                          examCode: e.examCode,
                          title: e.title,
                          durationMinutes: e.durationMinutes || 45,
                          subs: [],
                          examObj: e,
                        });
                      }
                    });

                    const examList = Array.from(examMap.values());

                    return (
                      <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Thanh Điều Hướng Cấp 2 */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedClassForGrading(null)}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <ArrowLeft className="w-4 h-4 text-indigo-600" />
                            <span>← Quay lại Danh Sách Lớp</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-semibold">Đang xem lớp:</span>
                            <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-2xs">
                              🏫 Lớp {selectedClassForGrading}
                            </span>
                          </div>
                        </div>

                        {/* Banner thông tin lớp và nút Cập nhật danh sách học sinh */}
                        <div className="bg-white p-5 rounded-3xl border-2 border-indigo-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-600/30 shrink-0">
                              {selectedClassForGrading.substring(0, 3)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Lớp {selectedClassForGrading}
                                </span>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                  {classStudents.length} Học Sinh Trong Danh Sách
                                </span>
                              </div>
                              <h2 className="text-xl font-black text-slate-900 mt-1">
                                Các Bài Học Sinh Làm Kiểm Tra (Lớp {selectedClassForGrading})
                              </h2>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Thầy/Cô bấm vào một bài kiểm tra bên dưới để xem bảng điểm chi tiết của toàn bộ học sinh lớp {selectedClassForGrading}.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* NÚT CẬP NHẬT DANH SÁCH HỌC SINH NẰM NGAY ĐÂY (YÊU CẦU 1) */}
                            <button
                              type="button"
                              onClick={() => {
                                setClassModalSelectedClass(selectedClassForGrading);
                                setClassModalActiveTab('students');
                                setIsClassModalOpen(true);
                              }}
                              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
                            >
                              <Upload className="w-4 h-4 text-emerald-200" />
                              <span>Cập Nhật Danh Sách Học Sinh Lớp {selectedClassForGrading}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setClassModalSelectedClass(selectedClassForGrading);
                                setClassModalActiveTab('accounts');
                                setIsClassModalOpen(true);
                              }}
                              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Users className="w-4 h-4 text-indigo-600" />
                              <span>Tài Khoản & Zalo</span>
                            </button>
                          </div>
                        </div>

                        {/* DANH SÁCH CÁC BÀI KIỂM TRA HỌC SINH ĐÃ LÀM HOẶC ĐƯỢC GIAO */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-indigo-600" />
                              <span>Danh Sách Các Bài Kiểm Tra Của Lớp ({examList.length} đề thi):</span>
                            </h3>
                            <span className="text-xs text-slate-500 font-semibold">
                              Bấm vào bài kiểm tra để xem bảng điểm toàn bộ học sinh
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {examList.map((exItem) => {
                              const submittedCount = exItem.subs.length;
                              const rosterCount = Math.max(1, classStudents.length);
                              const completionPercent = Math.min(100, Math.round((submittedCount / rosterCount) * 100));

                              const scores = exItem.subs.map((s) => s.totalScore);
                              const avg =
                                scores.length > 0
                                  ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
                                  : '—';
                              const max = scores.length > 0 ? Math.max(...scores).toFixed(2) : '—';
                              const min = scores.length > 0 ? Math.min(...scores).toFixed(2) : '—';
                              const passRate =
                                scores.length > 0
                                  ? Math.round(
                                      (scores.filter((sc) => sc >= 5.0).length / scores.length) * 100
                                    )
                                  : 0;

                              return (
                                <div
                                  key={exItem.id}
                                  className="bg-white rounded-3xl border-2 border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                        MÃ ĐỀ: {exItem.examCode}
                                      </span>
                                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{exItem.durationMinutes} phút</span>
                                      </span>
                                    </div>

                                    <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-700 transition-colors mt-2">
                                      {exItem.title}
                                    </h4>

                                    {/* Tiến độ nộp bài của lớp */}
                                    <div className="mt-3 space-y-1.5">
                                      <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-600">
                                          Đã nộp bài: <b className="text-indigo-700">{submittedCount}</b> / {classStudents.length} học sinh
                                        </span>
                                        <span className="text-indigo-600 font-mono font-black">
                                          {completionPercent}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                        <div
                                          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                                          style={{ width: `${Math.max(4, completionPercent)}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Tóm tắt điểm số */}
                                    <div className="grid grid-cols-4 gap-2 mt-4 text-center bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 text-xs">
                                      <div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Điểm TB</div>
                                        <div className="font-black text-indigo-700 text-sm mt-0.5">{avg}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Cao Nhất</div>
                                        <div className="font-extrabold text-emerald-700 text-sm mt-0.5">{max}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Thấp Nhất</div>
                                        <div className="font-extrabold text-rose-700 text-sm mt-0.5">{min}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Đạt (≥5đ)</div>
                                        <div className="font-black text-slate-800 text-sm mt-0.5">{passRate}%</div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* NÚT BẤM VÀO BÀI KIỂM TRA SẼ HIỂN THỊ BẢNG ĐIỂM (YÊU CẦU 3) */}
                                  <div className="pt-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const targetExam =
                                          exItem.examObj ||
                                          savedExams.find((e) => e.id === exItem.id || e.examCode === exItem.examCode) ||
                                          currentExam;
                                        if (targetExam) {
                                          setSelectedExamForGrading(targetExam);
                                        } else {
                                          // Tạo Exam giả định nếu chỉ có mã đề trong bài nộp
                                          const synthExam: Exam = {
                                            id: exItem.id,
                                            examCode: exItem.examCode,
                                            title: exItem.title,
                                            grade: '12',
                                            durationMinutes: exItem.durationMinutes,
                                            totalPoints: 10,
                                            multipleChoice: [],
                                            trueFalseQuestions: [],
                                            essays: [],
                                            createdAt: new Date().toISOString(),
                                          };
                                          setSelectedExamForGrading(synthExam);
                                        }
                                      }}
                                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                                    >
                                      <FileSpreadsheet className="w-4 h-4 text-amber-300" />
                                      <span>Bấm Vào Xem Bảng Điểm Toàn Bộ Học Sinh →</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CẤP 3: HIỂN THỊ BẢNG ĐIỂM CỦA TOÀN BỘ HỌC SINH LÀM BÀI KIỂM TRA ĐÓ (YÊU CẦU 3) */}
                  {selectedClassForGrading && selectedExamForGrading && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {/* BREADCRUMB ĐIỀU HƯỚNG CẤP 3 */}
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedClassForGrading(null)}
                            className="font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                          >
                            Tất cả lớp
                          </button>
                          <span className="text-slate-400">/</span>
                          <button
                            type="button"
                            onClick={() => setSelectedExamForGrading(null)}
                            className="font-bold text-slate-700 hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                          >
                            <span>Lớp {selectedClassForGrading}</span>
                          </button>
                          <span className="text-slate-400">/</span>
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            Đề thi: [{selectedExamForGrading.examCode}] {selectedExamForGrading.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedExamForGrading(null)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Quay lại danh sách đề thi lớp {selectedClassForGrading}</span>
                          </button>
                        </div>
                      </div>

                      {/* RENDER BẢNG ĐIỂM CHI TIẾT TỰ ĐỘNG LỌC ĐÚNG LỚP & ĐÚNG ĐỀ NÀY */}
                      <GradebookReport
                        exam={selectedExamForGrading}
                        exams={savedExams}
                        submissions={submissions}
                        className={selectedClassForGrading}
                        classes={classes}
                        roster={studentRoster}
                        initialClassFilter={selectedClassForGrading}
                        initialExamFilter={selectedExamForGrading.id || selectedExamForGrading.examCode}
                        onBackToExams={() => setSelectedExamForGrading(null)}
                        onBackToClasses={() => {
                          setSelectedClassForGrading(null);
                          setSelectedExamForGrading(null);
                        }}
                        variants={variantPackage?.variants || []}
                        answerMatrix={variantPackage?.answerMatrix || []}
                        onSelectExam={(ex) => setSelectedExamForGrading(ex)}
                        onUpdateSubmission={async (updated) => {
                          setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                          await saveSubmissionToFirestore(updated);
                          showToast('Đã lưu kết quả phúc khảo bài thi thành công!');
                        }}
                        onDeleteSubmission={async (subId) => {
                          await deleteSubmissionFromFirestore(subId);
                          setSubmissions((prev) => prev.filter((s) => s.id !== subId));
                          showToast('Đã xóa bài thi thành công.');
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CHẾ ĐỘ 2: BẢNG ĐIỂM TỔNG HỢP TOÀN KHỐI (TẤT CẢ CÁC LỚP) */}
              {subGradingTab === 'gradebook' && (
                <GradebookReport
                  exam={currentExam}
                  exams={savedExams}
                  submissions={submissions}
                  className={currentExam?.className || submissions[0]?.studentClass || (studentRoster[0]?.className) || 'Toàn Khối'}
                  classes={classes}
                  roster={studentRoster}
                  variants={variantPackage?.variants || []}
                  answerMatrix={variantPackage?.answerMatrix || []}
                  onSelectExam={(ex) => setCurrentExam(ex)}
                  onUpdateSubmission={async (updated) => {
                    setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                    await saveSubmissionToFirestore(updated);
                    showToast('Đã lưu kết quả phúc khảo bài thi thành công!');
                  }}
                  onDeleteSubmission={async (subId) => {
                    await deleteSubmissionFromFirestore(subId);
                    setSubmissions((prev) => prev.filter((s) => s.id !== subId));
                    showToast('Đã xóa bài thi thành công.');
                  }}
                />
              )}

              {/* CHẾ ĐỘ 3: CHẤM BÀI TỰ LUẬN AI */}
              {subGradingTab === 'essay_grading' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Chấm Bài Tự Luận Toán Viết Tay Bằng AI</h3>
                      <p className="text-xs text-slate-500">Hệ thống AI Gemini nhận diện chữ viết tay học sinh, đối chiếu barem SGK từng 0.25đ và nhận xét chuẩn mực.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEssayGradingModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Bắt Đầu Chấm Bài Tự Luận AI</span>
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                    <div className="font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Quy tắc thẩm định và chấm thi chuẩn GDPT 2018:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      <li>Bám sát từng bước nhỏ (0.25đ - 0.5đ) của barem SGK bộ môn Toán.</li>
                      <li>Tuyệt đối không sử dụng các phương pháp ngoài SGK như quy tắc L&apos;Hospital hoặc vi phân cấp cao.</li>
                      <li>Nhận diện nét viết tay, số mũ, căn thức và cho lời phê cụ thể cho học sinh.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CÔNG CỤ & TIỆN ÍCH */}
          {currentNav === 'tools' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSubToolsTab('python_code')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    subToolsTab === 'python_code'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  <span>Mã Nguồn Python Thuật Toán Trộn Đề</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubToolsTab('admin_approval');
                      setIsAdminTeacherModalOpen(true);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      subToolsTab === 'admin_approval'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-rose-300" />
                    <span>Duyệt Giáo Viên ({pendingTeacherCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSubToolsTab('guide')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    subToolsTab === 'guide'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Quy Chuẩn Đề Thi GDPT 2018</span>
                </button>
              </div>

              {subToolsTab === 'python_code' && (
                <BackendCodeViewer
                  backendUrl={backendUrl}
                  onBackendUrlChange={setBackendUrl}
                />
              )}

              {subToolsTab === 'guide' && (
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <h2 className="text-lg font-black text-slate-900">Quy Chuẩn Cấu Trúc Đề Thi Tốt Nghiệp THPT Từ Năm 2025</h2>
                    <p className="text-xs text-slate-500 mt-1">Ban hành theo Quyết định của Bộ Giáo dục và Đào tạo cho Chương trình GDPT 2018</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                      <div className="text-xs font-black uppercase text-indigo-700">Phần I: Trắc Nghiệm 4 Lựa Chọn</div>
                      <div className="text-2xl font-black text-indigo-950">12 Câu • 3.0 Điểm</div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Mỗi câu có 4 phương án A, B, C, D; chọn 1 phương án đúng duy nhất. Mỗi câu trả lời đúng được 0.25 điểm.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                      <div className="text-xs font-black uppercase text-sky-700">Phần II: Trắc Nghiệm Đúng / Sai</div>
                      <div className="text-2xl font-black text-sky-950">4 Câu • 4.0 Điểm</div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Mỗi câu gồm 4 ý a, b, c, d. Đúng 1 ý được 0.1đ; đúng 2 ý được 0.25đ; đúng 3 ý được 0.5đ; đúng cả 4 ý được 1.0 điểm.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                      <div className="text-xs font-black uppercase text-emerald-700">Phần III: Trả Lời Ngắn / Tự Luận</div>
                      <div className="text-2xl font-black text-emerald-950">6 Câu / 2 Bài • 3.0 Điểm</div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Học sinh tính toán và điền đáp số dạng số hoặc công thức toán học, hoặc trình bày lời giải chi tiết theo từng bước barem SGK.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODALS & WORKFLOW DRAWERS                                                 */}
      {/* ========================================================================= */}
      {/* Quản lý lớp học & Học sinh Modal */}
      <ClassManagementModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        classes={classes}
        roster={studentRoster}
        currentExam={currentExam}
        savedExams={savedExams}
        initialClassId={classModalSelectedClass}
        initialTab={classModalActiveTab}
        onSaveClass={handleSaveClass}
        onDeleteClass={handleDeleteClass}
        onSaveRoster={handleSaveRoster}
        onDeleteStudent={handleDeleteStudent}
        showToast={showToast}
      />

      {/* Chấm Tự Luận AI Modal */}
      <TeacherEssayGradingModal
        isOpen={isEssayGradingModalOpen}
        onClose={() => setIsEssayGradingModalOpen(false)}
        submissions={submissions}
        currentExam={currentExam}
        teacherName={currentUser?.fullName || 'Giáo viên bộ môn Toán'}
        showToast={showToast}
        onSubmissionUpdated={(updatedSub) => {
          setSubmissions((prev) => [updatedSub, ...prev.filter((s) => s.id !== updatedSub.id)]);
        }}
      />

      {/* Giao đề cho lớp học Modal */}
      <AssignExamModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        exam={currentExam}
        classes={classes}
        roster={studentRoster}
        onAssignExam={handleAssignExam}
        showToast={showToast}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        showToast={showToast}
      />

      {/* Admin Teacher Management Modal */}
      <AdminTeacherApprovalModal
        isOpen={isAdminTeacherModalOpen}
        onClose={() => setIsAdminTeacherModalOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}
