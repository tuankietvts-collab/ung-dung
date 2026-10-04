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
  ExternalLink,
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
  Mail
} from 'lucide-react';
import { AppUser, Exam, StudentSubmission, StudentRosterItem, ClassGroup, TeacherProfile } from './types/exam';
import {
  generate45ExamVariants,
  generateFullClassSubmissions,
  AnswerMatrixRow,
  Generated45Package
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
  logoutAppUser
} from './services/firebase';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentExamRoom } from './components/StudentExamRoom';
import { GradebookReport } from './components/GradebookReport';
import { BackendCodeViewer } from './components/BackendCodeViewer';
import { AuthPortal } from './components/AuthPortal';
import { AuthModal } from './components/AuthModal';
import { ClassManagementModal } from './components/ClassManagementModal';

export default function App() {
  // Navigation State: Teacher is first tab by default
  const [activeTab, setActiveTab] = useState<'teacher' | 'student' | 'gradebook' | 'code'>('teacher');

  // Multi-role AppUser Authentication State (Bắt buộc đăng nhập / đăng ký trước khi vào hệ thống)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());

  // Cloud State from Firebase Firestore
  const [savedExams, setSavedExams] = useState<Exam[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [variantPackage, setVariantPackage] = useState<Generated45Package | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentRosterItem[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  // Direct exam link session check (?exam=... or ?mode=student)
  const [isDirectExamSession, setIsDirectExamSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return !!(p.get('exam') || p.get('examId') || p.get('code') || p.get('mode') === 'student');
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const [isCloudSaving, setIsCloudSaving] = useState<boolean>(false);
  const [backendUrl, setBackendUrl] = useState<string>('');

  // Toast notifications (avoiding window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Inspect URL parameters for Direct Link Access (Gửi link vào thi trực tiếp ?exam=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const examId = params.get('examId');
      const code = params.get('code') || params.get('exam');

      if (mode === 'student' || examId || code) {
        setIsDirectExamSession(true);
        setActiveTab('student');
        if (code || examId) {
          const matched = savedExams.find(
            (e) => (examId && e.id === examId) || (code && (e.examCode.toLowerCase() === code.toLowerCase() || e.id === code))
          );
          if (matched) {
            setCurrentExam(matched);
          }
        }
      }
    }
  }, [savedExams]);

  // Subscribe to real-time Cloud Firebase collections
  useEffect(() => {
    // 1. Subscribe to teacher-created exams
    const unsubExams = subscribeExamsFromFirestore(
      (exams) => {
        setSavedExams(exams);
        // Automatically sync current exam with latest or active
        setCurrentExam((prev) => {
          if (!prev) {
            return exams.length > 0 ? exams[0] : null;
          }
          const stillExists = exams.find((e) => e.id === prev.id);
          return stillExists || (exams.length > 0 ? exams[0] : null);
        });
      },
      (err) => {
        console.warn('Exams subscription note:', err);
      }
    );

    // 2. Subscribe to student submissions
    const unsubSubs = subscribeSubmissionsFromFirestore(
      (cloudSubs) => {
        setSubmissions(cloudSubs);
      },
      (err) => {
        console.warn('Submissions subscription note:', err);
      }
    );

    // 3. Subscribe to student roster (imported from Excel)
    const unsubRoster = subscribeStudentRosterFromFirestore(
      (rosterList) => {
        setStudentRoster(rosterList);
      },
      (err) => {
        console.warn('Roster subscription note:', err);
      }
    );

    // 4. Subscribe to class groups
    const unsubClasses = subscribeClassGroupsFromFirestore(
      (classList) => {
        setClasses(classList);
      },
      (err) => {
        console.warn('Classes subscription note:', err);
      }
    );

    return () => {
      unsubExams();
      unsubSubs();
      unsubRoster();
      unsubClasses();
    };
  }, []);

  // Whenever currentExam changes, calculate variants if exam exists
  useEffect(() => {
    if (currentExam) {
      const pkg = generate45ExamVariants(currentExam);
      setVariantPackage(pkg);
    } else {
      setVariantPackage(null);
    }
  }, [currentExam?.id]);

  // Handle user logout
  const handleUserLogout = async () => {
    await logoutAppUser();
    setCurrentUser(null);
    showToast('Đã đăng xuất khỏi tài khoản.');
  };

  // Handle successful login or registration from AuthPortal
  const handleAuthSuccess = (user: AppUser) => {
    setCurrentUser(user);
    if (user.role === 'student') {
      setActiveTab('student');
    } else {
      setActiveTab('teacher');
    }
    showToast(`Chào mừng ${user.role === 'admin' ? 'Quản Trị Viên' : user.role === 'teacher' ? 'Thầy/Cô' : 'Em'} ${user.fullName} đã đăng nhập!`);
  };

  // Convert AppUser to TeacherProfile for components requiring it
  const teacherProfile: TeacherProfile | null = currentUser ? {
    uid: currentUser.uid,
    email: currentUser.email || `${currentUser.username}@edumath.ai`,
    fullName: currentUser.fullName,
    school: currentUser.school,
    subject: currentUser.subject
  } : null;

  // Handle new student submission with Cloud Firebase persistence
  const handleNewSubmission = async (newSub: StudentSubmission) => {
    setSubmissions((prev) => [newSub, ...prev.filter((s) => s.id !== newSub.id)]);
    try {
      await saveSubmissionToFirestore(newSub);
      showToast('Đã nộp bài thi thành công và đồng bộ lên Cloud Firebase!');
    } catch (e: any) {
      console.error('Error saving submission to Firebase:', e);
      showToast('Đã lưu bài làm cục bộ. Vui lòng kiểm tra kết nối Cloud.', 'info');
    }
  };

  // Save exam to Cloud Firebase
  const handleSaveExamToCloud = async (exam: Exam) => {
    setIsCloudSaving(true);
    try {
      await saveExamToFirestore(exam);
      showToast(`Đã lưu đề thi "${exam.title}" (${exam.examCode}) lên Cloud Firebase thành công!`);
    } catch (e: any) {
      console.error('Error saving exam to Firebase:', e);
      showToast('Lỗi khi lưu đề thi lên Firebase: ' + (e.message || String(e)), 'error');
    } finally {
      setIsCloudSaving(false);
    }
  };

  // Delete exam from Cloud Firebase
  const handleDeleteExamFromCloud = async (examId: string) => {
    try {
      await deleteExamFromFirestore(examId);
      showToast('Đã xóa đề thi khỏi Cloud Firebase.');
      if (currentExam?.id === examId) {
        const remaining = savedExams.filter((e) => e.id !== examId);
        setCurrentExam(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (e: any) {
      console.error('Error deleting exam from Firebase:', e);
      showToast('Lỗi khi xóa đề thi: ' + (e.message || String(e)), 'error');
    }
  };

  // Handle new exam created by teacher (auto saves to Firestore and sets as current)
  const handleExamCreated = async (newExam: Exam) => {
    setCurrentExam(newExam);
    setIsCloudSaving(true);
    try {
      await saveExamToFirestore(newExam);
      showToast(`Đã tạo và đồng bộ đề thi "${newExam.title}" lên Cloud Firebase!`);
    } catch (e: any) {
      console.error('Auto save error:', e);
      showToast('Đã tạo đề thi. Bạn có thể bấm "Lưu Lên Cloud Firebase" để thử lại.', 'info');
    } finally {
      setIsCloudSaving(false);
    }
  };

  // Class and Roster management handlers
  const handleSaveClass = async (cls: ClassGroup) => {
    await saveClassGroupToFirestore(cls);
    setClasses((prev) => [cls, ...prev.filter((c) => c.name !== cls.name && c.id !== cls.id)]);
  };

  const handleDeleteClass = async (classId: string) => {
    await deleteClassGroupFromFirestore(classId);
    setClasses((prev) => prev.filter((c) => c.id !== classId && c.name !== classId));
  };

  const handleSaveRoster = async (newStudents: StudentRosterItem[]) => {
    await saveStudentRosterToFirestore(newStudents);
    setStudentRoster((prev) => {
      const ids = new Set(newStudents.map((s) => s.id));
      return [...newStudents, ...prev.filter((s) => !ids.has(s.id))];
    });
  };

  const handleDeleteStudent = async (studentId: string) => {
    await deleteStudentFromFirestore(studentId);
    setStudentRoster((prev) => prev.filter((s) => s.id !== studentId));
  };

  // If not authenticated and NOT opening via direct exam link (?exam=...), require login portal first
  if (!currentUser && !isDirectExamSession) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all animate-in slide-in-from-bottom duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-600 shadow-emerald-900/20'
                : toast.type === 'error'
                ? 'bg-rose-800 text-white border-rose-600 shadow-rose-900/20'
                : 'bg-slate-800 text-white border-slate-700 shadow-slate-900/20'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
        <AuthPortal onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Toast Notification Bar */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all animate-in slide-in-from-bottom duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-800 text-white border-emerald-600 shadow-emerald-900/20'
              : toast.type === 'error'
              ? 'bg-rose-800 text-white border-rose-600 shadow-rose-900/20'
              : 'bg-slate-800 text-white border-slate-700 shadow-slate-900/20'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand: Clickable to return to main workspace */}
            <button
              type="button"
              onClick={() => setActiveTab(currentUser?.role === 'student' ? 'student' : 'teacher')}
              className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0"
              title="EduMath AI - Nền Tảng Thi Trực Tuyến & Chấm Tự Luận Bằng Gemini AI"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Sigma className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 bg-clip-text text-transparent">
                  EduMath AI
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  GDPT 2018
                </span>
              </div>
            </button>

            {/* Cloud Status & Multi-Role User Profile Bar */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/90">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Cloud className="w-3.5 h-3.5 text-sky-600" />
                <span className="font-semibold text-slate-700">Cloud Firebase:</span>
                <span className="font-bold text-indigo-700">{savedExams.length} đề thi</span>
                {classes.length > 0 && (
                  <span className="text-slate-400 font-semibold">• {classes.length} lớp ({studentRoster.length} HS)</span>
                )}
              </div>

              {/* Authenticated User Account Badge or Guest Login Button */}
              {currentUser ? (
                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium shadow-2xs ${
                  currentUser.role === 'admin'
                    ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                    : currentUser.role === 'teacher'
                    ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                    : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                }`}>
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : currentUser.role === 'teacher' ? (
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  ) : (
                    <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="font-black">
                    {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'teacher' ? 'GV' : 'HS'}:
                  </span>
                  <span className="font-bold truncate max-w-[140px]">{currentUser.fullName}</span>
                  {(currentUser.school || currentUser.className) && (
                    <span className="text-slate-400 font-medium hidden xl:inline text-[11px]">
                      • {currentUser.school || currentUser.className}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleUserLogout}
                    title="Đăng xuất khỏi hệ thống"
                    className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer ml-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Đăng Nhập Thầy/Cô</span>
                </button>
              )}
            </div>

            {/* Navigation Tabs (Tailored for Role) */}
            <nav className="flex items-center gap-1 sm:gap-1.5">
              {!currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('student')}
                    className="px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white shadow-sm flex items-center gap-1.5"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Phòng Thi Trực Tuyến</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 cursor-pointer ml-1"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Thầy/Cô Đăng Nhập</span>
                  </button>
                </>
              ) : currentUser.role === 'student' ? (
                <>
                  {/* Student View Tabs */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('student')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'student'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Phòng Thi Trực Tuyến</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('gradebook')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'gradebook'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Bảng Điểm & Kết Quả</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Admin & Teacher Navigation Tabs */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('teacher')}
                    className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'teacher'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Giáo Viên & Lớp Học</span>
                    <span className="sm:hidden">Tạo Đề</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('student')}
                    className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'student'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span className="hidden sm:inline">Phòng Thi Trực Tuyến</span>
                    <span className="sm:hidden">Thi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('gradebook')}
                    className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'gradebook'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Bảng Điểm & Thống Kê</span>
                    <span className="sm:hidden">Bảng Điểm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'code'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Code2 className="w-4 h-4" />
                    <span className="hidden md:inline">Mã Nguồn Python</span>
                    <span className="md:hidden">Python</span>
                  </button>
                </>
              )}

              {/* Mobile Logout Button */}
              {currentUser && (
                <button
                  type="button"
                  onClick={handleUserLogout}
                  className="lg:hidden p-2 text-slate-500 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeTab === 'teacher' && (
          <TeacherDashboard
            currentExam={currentExam}
            savedExams={savedExams}
            submissions={submissions}
            roster={studentRoster}
            classes={classes}
            teacherProfile={teacherProfile}
            onExamCreated={handleExamCreated}
            onSelectSavedExam={(exam) => setCurrentExam(exam)}
            onDeleteSubmission={async (subId) => {
              await deleteSubmissionFromFirestore(subId);
              setSubmissions((prev) => prev.filter((s) => s.id !== subId));
              showToast('Đã xóa bài nộp khỏi hệ thống.');
            }}
            onSaveClass={handleSaveClass}
            onDeleteClass={handleDeleteClass}
            onSaveRoster={handleSaveRoster}
            onDeleteStudent={handleDeleteStudent}
            onSaveExamToCloud={handleSaveExamToCloud}
            onDeleteExamFromCloud={handleDeleteExamFromCloud}
            onGenerate45Variants={() => {
              if (currentExam) {
                setVariantPackage(generate45ExamVariants(currentExam, studentRoster));
              }
            }}
            variants={variantPackage?.variants || []}
            answerMatrix={variantPackage?.answerMatrix || []}
            isCloudSaving={isCloudSaving}
            showToast={showToast}
            onSwitchToStudentView={() => setActiveTab('student')}
          />
        )}

        {activeTab === 'student' && (
          <StudentExamRoom
            exam={currentExam}
            variants={variantPackage?.variants || []}
            roster={studentRoster}
            onSelectVariant={(variant) => setCurrentExam(variant)}
            onSubmit={handleNewSubmission}
            onViewGradebook={() => setActiveTab('gradebook')}
            onGoToTeacher={() => setActiveTab('teacher')}
            backendUrl={backendUrl}
          />
        )}

        {activeTab === 'gradebook' && (
          <GradebookReport
            exam={currentExam}
            submissions={submissions}
            className={currentExam?.className || submissions[0]?.studentClass || (studentRoster[0]?.className) || 'Toàn Khối'}
            variants={variantPackage?.variants || []}
            answerMatrix={variantPackage?.answerMatrix || []}
            onDeleteSubmission={async (subId) => {
              await deleteSubmissionFromFirestore(subId);
              setSubmissions((prev) => prev.filter((s) => s.id !== subId));
              showToast('Đã xóa bài thi thành công.');
            }}
          />
        )}

        {activeTab === 'code' && (
          <BackendCodeViewer
            backendUrl={backendUrl}
            onBackendUrlChange={setBackendUrl}
          />
        )}
      </main>

      {/* Auth Modal for Teacher Login/Register when accessed via link */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        showToast={showToast}
      />

      {/* Footer with Solemn Branding */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="font-bold text-slate-800">
            EduMath AI - Nền Tảng Thi Trực Tuyến & Chấm Tự Luận Bằng Gemini AI • Được phát triển bởi Thầy Trịnh Tuấn Kiệt
          </div>
          <div className="flex items-center justify-center gap-4 text-slate-400 text-[11px] flex-wrap">
            <span>Đồng bộ Cloud Firestore đa nền tảng</span>
            <span>•</span>
            <span>Link vào thi trực tiếp không cần mật khẩu</span>
            <span>•</span>
            <span>Quản lý thí sinh qua Excel</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
