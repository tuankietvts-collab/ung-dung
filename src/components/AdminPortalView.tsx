import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Search,
  Building2,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  KeyRound,
  Edit2,
  Trash2,
  Copy,
  Check,
  School,
  BookOpen,
  GraduationCap,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  LogOut,
  ExternalLink,
  Lock,
  Unlock,
  Eye,
  BarChart3,
  Settings,
  Sparkles,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Download,
  Filter
} from 'lucide-react';
import { AppUser, Exam, StudentSubmission, StudentRosterItem, ClassGroup } from '../types/exam';
import {
  db,
  getRegisteredTeachers,
  subscribeTeachersFromFirestore,
  approveTeacherUser,
  updateTeacherAccount,
  deleteTeacherAccount,
  createTeacherAccountByAdmin,
  saveStudentRosterToFirestore,
  deleteStudentFromFirestore,
  saveRegisteredUserLocally,
  getStoredRegisteredUsers,
  saveRegisteredUsersListLocally
} from '../services/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { encodeSchoolName, encodeSubjectName } from '../services/schoolEncoder';

interface AdminPortalViewProps {
  currentUser: AppUser;
  savedExams: Exam[];
  submissions: StudentSubmission[];
  studentRoster: StudentRosterItem[];
  classes: ClassGroup[];
  onImpersonateTeacher?: (teacher: AppUser) => void;
  onSwitchToTeacherView?: () => void;
  onSwitchToStudentView?: () => void;
  onDeleteExam?: (examId: string) => void;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'teachers' | 'students' | 'exams' | 'analytics' | 'settings';

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  currentUser,
  savedExams,
  submissions,
  studentRoster,
  classes,
  onImpersonateTeacher,
  onSwitchToTeacherView,
  onSwitchToStudentView,
  onDeleteExam,
  onLogout,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teachers');
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Student search & filter
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentClassFilter, setStudentClassFilter] = useState<string>('all');

  // Exam search & filter
  const [examSearch, setExamSearch] = useState<string>('');
  const [examGradeFilter, setExamGradeFilter] = useState<string>('all');

  // Modal states for Teacher Actions
  const [isCreateTeacherOpen, setIsCreateTeacherOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('123456');
  const [newSchool, setNewSchool] = useState<string>('Trường THPT Chuyên / THPT Chuẩn Quốc Gia');
  const [newSubject, setNewSubject] = useState<string>('Toán Học THPT (GDPT 2018)');

  // Reset Password Modal
  const [resetTargetTeacher, setResetTargetTeacher] = useState<AppUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState<string>('123456');

  // Edit Teacher Modal
  const [editTargetTeacher, setEditTargetTeacher] = useState<AppUser | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editSchool, setEditSchool] = useState<string>('');
  const [editSubject, setEditSubject] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');

  // Delete Confirmation Modal
  const [deleteTargetTeacher, setDeleteTargetTeacher] = useState<AppUser | null>(null);

  // View Teacher Detail & Exams
  const [viewDetailTeacher, setViewDetailTeacher] = useState<AppUser | null>(null);

  // Student Edit / Reset Pin
  const [editTargetStudent, setEditTargetStudent] = useState<StudentRosterItem | null>(null);
  const [resetStudentPinValue, setResetStudentPinValue] = useState<string>('123456');

  // Copied indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-approve configuration
  const [autoApproveNewTeachers, setAutoApproveNewTeachers] = useState<boolean>(() => {
    try {
      return localStorage.getItem('edumath_auto_approve_teachers') === 'true';
    } catch {
      return false;
    }
  });

  // Lấy toàn bộ danh sách giáo viên từ Cloud Firestore theo thời gian thực (onSnapshot)
  // Tuyệt đối không lấy localStorage đè làm mất danh sách từ Firestore.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teachers'),
      (snapshot) => {
        const firestoreList: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const id = docSnap.id;
          const isAppr = data.status === 'active' || (data.status !== 'pending' && data.isApproved === true);
          const createdAtStr =
            typeof data.createdAt === 'number'
              ? new Date(data.createdAt).toISOString()
              : data.createdAt || new Date().toISOString();

          firestoreList.push({
            uid: id,
            role: 'teacher',
            fullName: data.fullName || data.name || id,
            username: data.username || id,
            email: data.email || (data.username?.includes('@') ? data.username : `${data.username || id}@edumath.edu.vn`),
            school: data.school || data.schoolFullName || 'THPT Võ Thị Sáu',
            schoolCode: data.schoolCode || encodeSchoolName(data.school || 'THPT Võ Thị Sáu'),
            subject: data.subject || data.subjectFullName || 'Toán',
            subjectCode: data.subjectCode || encodeSubjectName(data.subject || 'Toán'),
            createdAt: createdAtStr,
            isApproved: isAppr,
            status: data.status || (isAppr ? 'active' : 'pending'),
            approvedAt: data.approvedAt,
            approvedBy: data.approvedBy,
          } as any);
        });

        firestoreList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setTeachers(firestoreList);
      },
      (error) => {
        console.warn('Real-time teachers snapshot error in AdminPortalView:', error);
      }
    );
    return () => unsub();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast(`Đã sao chép: "${text}"`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Khi Admin bấm Duyệt, cập nhật updateDoc(doc(db, 'teachers', id), { status: 'active' })
  const handleToggleApproval = async (teacher: AppUser, approve: boolean) => {
    setActionLoadingId(teacher.uid);
    try {
      const cleanId = teacher.uid.trim().toLowerCase().replace(/[\s]/g, '');
      const newStatus = approve ? 'active' : 'pending';

      await updateDoc(doc(db, 'teachers', cleanId), {
        status: newStatus,
        isApproved: approve,
        approvedAt: approve ? new Date().toISOString() : null,
        approvedBy: 'admin',
      }).catch(async () => {
        await updateDoc(doc(db, 'teachers', teacher.uid), {
          status: newStatus,
          isApproved: approve,
          approvedAt: approve ? new Date().toISOString() : null,
          approvedBy: 'admin',
        });
      });

      await approveTeacherUser(teacher.uid, approve).catch(() => {});

      showToast(
        approve
          ? `Đã phê duyệt tài khoản giáo viên "${teacher.fullName}". Giáo viên có thể đăng nhập ngay!`
          : `Đã thu hồi quyền kích hoạt của giáo viên "${teacher.fullName}".`,
        approve ? 'success' : 'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái phê duyệt', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reset teacher password
  const handleConfirmResetPassword = async () => {
    if (!resetTargetTeacher) return;
    if (!resetPasswordValue.trim()) {
      showToast('Vui lòng nhập mật khẩu mới!', 'error');
      return;
    }

    setActionLoadingId(resetTargetTeacher.uid);
    try {
      await updateTeacherAccount(resetTargetTeacher.uid, {
        newPassword: resetPasswordValue.trim(),
      });
      showToast(`Đã can thiệp đổi mật khẩu cho giáo viên "${resetTargetTeacher.fullName}" thành "${resetPasswordValue}" thành công!`);
      setResetTargetTeacher(null);
      setResetPasswordValue('123456');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi đổi mật khẩu', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Save edited teacher info
  const handleSaveEditTeacher = async () => {
    if (!editTargetTeacher) return;
    if (!editFullName.trim()) {
      showToast('Họ tên giáo viên không được để trống!', 'error');
      return;
    }

    setActionLoadingId(editTargetTeacher.uid);
    try {
      await updateTeacherAccount(editTargetTeacher.uid, {
        fullName: editFullName.trim(),
        school: editSchool.trim() || 'Trường THPT',
        subject: editSubject.trim() || 'Toán Học THPT',
        email: editEmail.trim() || editTargetTeacher.email,
      });

      setTeachers((prev) =>
        prev.map((t) =>
          t.uid === editTargetTeacher.uid
            ? {
                ...t,
                fullName: editFullName.trim(),
                school: editSchool.trim() || 'Trường THPT',
                subject: editSubject.trim() || 'Toán Học THPT',
                email: editEmail.trim() || editTargetTeacher.email,
              }
            : t
        )
      );

      showToast(`Đã cập nhật thông tin giáo viên "${editFullName}" thành công!`);
      setEditTargetTeacher(null);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật thông tin giáo viên', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete teacher account permanently
  const handleConfirmDeleteTeacher = async () => {
    if (!deleteTargetTeacher) return;
    setActionLoadingId(deleteTargetTeacher.uid);
    try {
      await deleteTeacherAccount(deleteTargetTeacher.uid);
      setTeachers((prev) => prev.filter((t) => t.uid !== deleteTargetTeacher.uid && t.username !== deleteTargetTeacher.username));
      showToast(`Đã xóa vĩnh viễn tài khoản giáo viên "${deleteTargetTeacher.fullName}" khỏi hệ thống!`);
      setDeleteTargetTeacher(null);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa tài khoản giáo viên', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create new teacher directly by Admin
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim() || !newPassword.trim()) {
      showToast('Vui lòng điền đầy đủ Họ tên, Tên đăng nhập và Mật khẩu!', 'error');
      return;
    }

    const cleanUsername = newUsername.trim().toLowerCase();
    const exists = teachers.some((t) => t.username.toLowerCase() === cleanUsername);
    if (exists) {
      showToast(`Tên đăng nhập "${cleanUsername}" đã tồn tại trên hệ thống! Vui lòng chọn tên khác.`, 'error');
      return;
    }

    try {
      const created = await createTeacherAccountByAdmin({
        fullName: newFullName.trim(),
        username: cleanUsername,
        password: newPassword.trim(),
        school: newSchool.trim(),
        subject: newSubject.trim(),
      });

      setTeachers((prev) => [created, ...prev.filter((t) => t.uid !== created.uid)]);
      showToast(`Đã tạo thành công tài khoản giáo viên "${created.fullName}" (Đã kích hoạt sẵn)!`);
      setIsCreateTeacherOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewPassword('123456');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tạo tài khoản giáo viên', 'error');
    }
  };

  // Reset student password
  const handleResetStudentPassword = async () => {
    if (!editTargetStudent) return;
    const cleanPass = resetStudentPinValue.trim() || '123456';
    const updatedRoster = studentRoster.map((s) =>
      s.id === editTargetStudent.id ? { ...s, password: cleanPass, isAccountCreated: true } : s
    );

    try {
      await saveStudentRosterToFirestore(updatedRoster);
      // Also update local registered user map
      if (editTargetStudent.username) {
        const studentUser: AppUser = {
          uid: `student_${editTargetStudent.id}`,
          role: 'student',
          fullName: editTargetStudent.fullName,
          username: editTargetStudent.username,
          school: 'Trường THPT',
          className: editTargetStudent.className,
          sbd: editTargetStudent.sbd,
          createdAt: new Date().toISOString(),
          isApproved: true,
        };
        saveRegisteredUserLocally(editTargetStudent.username, cleanPass, studentUser);
      }
      showToast(`Đã reset mật khẩu học sinh "${editTargetStudent.fullName}" về "${cleanPass}" thành công!`);
      setEditTargetStudent(null);
    } catch (e: any) {
      showToast('Lỗi khi cập nhật mật khẩu học sinh', 'error');
    }
  };

  // Delete student from system
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa học sinh "${studentName}" khỏi hệ thống?`)) return;
    try {
      await deleteStudentFromFirestore(studentId);
      showToast(`Đã xóa học sinh "${studentName}" khỏi hệ thống!`);
    } catch (e: any) {
      showToast('Lỗi khi xóa học sinh', 'error');
    }
  };

  // Stats calculation
  const totalTeachers = teachers.length;
  const pendingTeachers = teachers.filter((t) => !t.isApproved);
  const approvedTeachers = teachers.filter((t) => t.isApproved);
  const totalStudents = studentRoster.length;
  const totalClasses = classes.length;
  const totalExamsCount = savedExams.length;
  const totalSubmissionsCount = submissions.length;

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // Status filter
      if (teacherStatusFilter === 'pending' && t.isApproved) return false;
      if (teacherStatusFilter === 'approved' && !t.isApproved) return false;

      // Text search
      if (teacherSearch.trim()) {
        const q = teacherSearch.trim().toLowerCase();
        const matchName = t.fullName?.toLowerCase().includes(q);
        const matchUser = t.username?.toLowerCase().includes(q);
        const matchEmail = t.email?.toLowerCase().includes(q);
        const matchSchool = t.school?.toLowerCase().includes(q);
        const matchSubject = t.subject?.toLowerCase().includes(q);
        return matchName || matchUser || matchEmail || matchSchool || matchSubject;
      }
      return true;
    });
  }, [teachers, teacherStatusFilter, teacherSearch]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return studentRoster.filter((s) => {
      if (studentClassFilter !== 'all' && s.className !== studentClassFilter) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchSbd = s.sbd?.toLowerCase().includes(q);
        const matchUser = s.username?.toLowerCase().includes(q);
        return matchName || matchSbd || matchUser;
      }
      return true;
    });
  }, [studentRoster, studentClassFilter, studentSearch]);

  // Unique classes list
  const availableClassNames = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => set.add(c.name));
    studentRoster.forEach((s) => set.add(s.className));
    return Array.from(set).sort();
  }, [classes, studentRoster]);

  // Filtered exams
  const filteredExams = useMemo(() => {
    return savedExams.filter((e) => {
      if (examGradeFilter !== 'all' && e.grade !== examGradeFilter) return false;
      if (examSearch.trim()) {
        const q = examSearch.trim().toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.examCode.toLowerCase().includes(q) ||
          e.topic?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [savedExams, examGradeFilter, examSearch]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Admin Header Bar */}
      <header className="bg-slate-900 border-b border-rose-900/40 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center text-white shadow-lg shadow-rose-900/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-white tracking-tight">EduMath AI Admin</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">Trung Tâm Quản Trị Hệ Thống & Kiểm Soát Tài Khoản</p>
            </div>
          </div>

          {/* Quick links to Teacher / Student views */}
          <div className="flex items-center gap-2">
            {onSwitchToTeacherView && (
              <button
                type="button"
                onClick={onSwitchToTeacherView}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-950 hover:text-indigo-300 border border-slate-700 hover:border-indigo-500/50 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                title="Chuyển sang giao diện Soạn đề & Quản lý Lớp của Giáo viên để kiểm tra"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Xem Giao Diện GV</span>
              </button>
            )}

            {onSwitchToStudentView && (
              <button
                type="button"
                onClick={onSwitchToStudentView}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                title="Mở phòng thi học sinh"
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Xem Phòng Thi Học Sinh</span>
              </button>
            )}

            {/* Admin Profile & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden lg:block">
                <div className="text-xs font-bold text-slate-200">{currentUser.fullName}</div>
                <div className="text-[10px] text-rose-400 font-medium">Toàn quyền hệ thống</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 border border-slate-700/60 transition-all cursor-pointer"
                title="Đăng xuất khỏi tài khoản Quản trị viên"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'teachers'
                ? 'border-rose-500 text-white bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Users className="w-4 h-4 text-rose-400" />
            <span>Quản Lý Tài Khoản Giáo Viên</span>
            {pendingTeachers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                {pendingTeachers.length} chờ duyệt
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'students'
                ? 'border-rose-500 text-white bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <span>Học Sinh & Lớp Học</span>
            <span className="text-[10px] text-slate-500">({totalStudents})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'exams'
                ? 'border-rose-500 text-white bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            <span>Kho Đề Thi Toàn Hệ Thống</span>
            <span className="text-[10px] text-slate-500">({totalExamsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics'
                ? 'border-rose-500 text-white bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Báo Cáo & Thống Kê</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-rose-500 text-white bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Cấu Hình Phê Duyệt</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI / Overview Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Giáo Viên Chờ Duyệt</span>
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                pendingTeachers.length > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-400">{pendingTeachers.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">Cần phê duyệt để cho phép đăng nhập</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Giáo Viên Hoạt Động</span>
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{approvedTeachers.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">Tổng cộng {totalTeachers} tài khoản giáo viên</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Học Sinh Toàn Trường</span>
              <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-400">{totalStudents}</div>
            <p className="text-[11px] text-slate-500 mt-1">Phân bố trong {totalClasses} lớp học</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Đề Thi & Lượt Nộp</span>
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {totalExamsCount} <span className="text-base font-normal text-slate-400">/ {totalSubmissionsCount} bài</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Đã đồng bộ trên Cloud Firestore</p>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: QUẢN TRỊ TÀI KHOẢN GIÁO VIÊN & DUYỆT ĐĂNG KÝ (CORE REQUIREMENT)
           ========================================================================= */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1">
                  <Filter className="w-3.5 h-3.5 text-rose-400" /> Lọc trạng thái:
                </span>
                <button
                  type="button"
                  onClick={() => setTeacherStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    teacherStatusFilter === 'all'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả ({totalTeachers})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    teacherStatusFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Chờ Duyệt ({pendingTeachers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherStatusFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    teacherStatusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Đã Kích Hoạt ({approvedTeachers.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    placeholder="Tìm theo tên, email, trường..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateTeacherOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Giáo Viên Mới</span>
                </button>
              </div>
            </div>

            {/* Pending Teachers Alert Banner if any */}
            {pendingTeachers.length > 0 && teacherStatusFilter !== 'approved' && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border border-amber-600/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-200">
                      Có {pendingTeachers.length} giáo viên vừa đăng ký tài khoản đang chờ bạn phê duyệt!
                    </div>
                    <div className="text-[11px] text-amber-400/80">
                      Giáo viên sẽ không thể đăng nhập hoặc tạo đề thi cho đến khi bạn bấm "Duyệt".
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Approve all pending
                    if (window.confirm(`Bạn có chắc chắn muốn duyệt nhanh TẤT CẢ ${pendingTeachers.length} giáo viên này?`)) {
                      pendingTeachers.forEach((t) => handleToggleApproval(t, true));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer shrink-0"
                >
                  Duyệt Tất Cả
                </button>
              </div>
            )}

            {/* Teachers Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Giáo Viên / Đơn Vị</th>
                      <th className="px-4 py-3">Tài Khoản / Email</th>
                      <th className="px-4 py-3">Bộ Môn</th>
                      <th className="px-4 py-3">Trạng Thái</th>
                      <th className="px-4 py-3">Đề Thi / Lớp</th>
                      <th className="px-4 py-3 text-right">Can Thiệp & Thao Tác Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Không tìm thấy tài khoản giáo viên nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((t) => {
                        const isPending = !t.isApproved;
                        const teacherExams = savedExams.filter((e) => e.examCode?.includes(t.username) || true); // estimate
                        const teacherClasses = classes.filter((c) => c.teacherId === t.uid);
                        const isLoading = actionLoadingId === t.uid;

                        return (
                          <tr key={t.uid} className={`hover:bg-slate-800/40 transition-colors ${isPending ? 'bg-amber-950/10' : ''}`}>
                            {/* Teacher name & School */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                  t.role === 'admin'
                                    ? 'bg-rose-600 text-white'
                                    : isPending
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                                }`}>
                                  {t.fullName ? t.fullName.charAt(0).toUpperCase() : 'G'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>{t.fullName}</span>
                                    {t.role === 'admin' && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                                    <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{t.school || 'Trường THPT'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Username / Email */}
                            <td className="px-4 py-3.5">
                              <div className="font-mono text-[11px] text-indigo-300 flex items-center gap-1">
                                <span>@{t.username}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(t.username, `user_${t.uid}`)}
                                  className="text-slate-500 hover:text-white"
                                  title="Sao chép tên đăng nhập"
                                >
                                  {copiedKey === `user_${t.uid}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{t.email || `${t.username}@edumath.edu.vn`}</div>
                            </td>

                            {/* Subject */}
                            <td className="px-4 py-3.5">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60">
                                {t.subject || 'Toán Học THPT'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <Clock className="w-3 h-3 animate-spin" />
                                  Chờ Phê Duyệt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Đã Kích Hoạt
                                </span>
                              )}
                            </td>

                            {/* Stats */}
                            <td className="px-4 py-3.5">
                              <div className="text-[11px] text-slate-300">
                                <span className="font-bold text-white">{teacherClasses.length}</span> lớp học
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Đăng ký: {t.createdAt ? t.createdAt.split('T')[0] : 'Gần đây'}
                              </div>
                            </td>

                            {/* Direct Actions: Intervene, Approve, Reset Password, Delete */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* Approve / Revoke button */}
                                {isPending ? (
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleToggleApproval(t, true)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                    title="Duyệt tài khoản để giáo viên có thể đăng nhập"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Duyệt Ngay</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isLoading || t.role === 'admin'}
                                    onClick={() => handleToggleApproval(t, false)}
                                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-950 text-slate-400 hover:text-amber-300 text-[11px] font-medium border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
                                    title="Tạm khóa / thu hồi quyền phê duyệt"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Khóa</span>
                                  </button>
                                )}

                                {/* Reset Password Modal trigger */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetTargetTeacher(t);
                                    setResetPasswordValue('123456');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[11px] font-medium border border-slate-700 transition-all cursor-pointer"
                                  title="Can thiệp đổi mật khẩu cho giáo viên"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span className="hidden md:inline">Đổi MK</span>
                                </button>

                                {/* Edit Teacher Profile */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditTargetTeacher(t);
                                    setEditFullName(t.fullName);
                                    setEditSchool(t.school || 'Trường THPT');
                                    setEditSubject(t.subject || 'Toán Học THPT');
                                    setEditEmail(t.email || '');
                                  }}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                                  title="Chỉnh sửa thông tin giáo viên"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Impersonate / Can thiệp trực tiếp vào tài khoản giáo viên */}
                                {onImpersonateTeacher && (
                                  <button
                                    type="button"
                                    onClick={() => onImpersonateTeacher(t)}
                                    className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-indigo-100 text-[11px] font-bold border border-indigo-700/60 transition-all cursor-pointer flex items-center gap-1"
                                    title="Đăng nhập với tư cách giáo viên này để can thiệp hỗ trợ soạn đề / quản lý lớp"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span className="hidden xl:inline">Can Thiệp</span>
                                  </button>
                                )}

                                {/* Delete Teacher Account Permanently */}
                                {t.role !== 'admin' && (
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => setDeleteTargetTeacher(t)}
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 transition-all cursor-pointer disabled:opacity-40"
                                    title="XÓA VĨNH VIỄN tài khoản giáo viên này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: QUẢN TRỊ TÀI KHOẢN HỌC SINH & LỚP HỌC TOÀN TRƯỜNG
           ========================================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Lớp học:</span>
                <select
                  value={studentClassFilter}
                  onChange={(e) => setStudentClassFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="all">Tất cả các lớp ({availableClassNames.length} lớp)</option>
                  {availableClassNames.map((c) => (
                    <option key={c} value={c}>
                      Lớp {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm theo tên học sinh, SBD..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">STT</th>
                      <th className="px-4 py-3">Họ Và Tên Học Sinh</th>
                      <th className="px-4 py-3">Lớp</th>
                      <th className="px-4 py-3">Số Báo Danh (SBD)</th>
                      <th className="px-4 py-3">Tài Khoản & Mật Khẩu</th>
                      <th className="px-4 py-3 text-right">Thao Tác Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Chưa có học sinh nào phù hợp trong danh sách.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{s.stt || idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-white">{s.fullName}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold text-[11px]">
                              {s.className}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400">{s.sbd || 'Chưa cấp'}</td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-[11px] text-slate-300">
                              User: <span className="text-white">{s.username || s.sbd || 'Chưa tạo'}</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              Pass: <span className="text-amber-300">{s.password || '123456'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditTargetStudent(s);
                                  setResetStudentPinValue('123456');
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium border border-slate-700 cursor-pointer"
                                title="Reset mật khẩu học sinh về 123456"
                              >
                                <KeyRound className="w-3 h-3 inline mr-1" />
                                Reset MK
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(s.id, s.fullName)}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 cursor-pointer"
                                title="Xóa học sinh khỏi hệ thống"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: KHO ĐỀ THI TOÀN HỆ THỐNG
           ========================================================================= */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Khối lớp:</span>
                <button
                  type="button"
                  onClick={() => setExamGradeFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    examGradeFilter === 'all' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Tất cả khối
                </button>
                <button
                  type="button"
                  onClick={() => setExamGradeFilter('10')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    examGradeFilter === '10' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Khối 10
                </button>
                <button
                  type="button"
                  onClick={() => setExamGradeFilter('11')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    examGradeFilter === '11' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Khối 11
                </button>
                <button
                  type="button"
                  onClick={() => setExamGradeFilter('12')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    examGradeFilter === '12' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Khối 12
                </button>
              </div>

              <div className="relative sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  placeholder="Tìm đề thi theo tiêu đề, mã đề..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExams.map((exam) => {
                const subsForExam = submissions.filter((s) => s.examId === exam.id || s.examCode === exam.examCode);
                return (
                  <div key={exam.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 font-mono text-[11px] font-bold border border-indigo-800/60">
                          {exam.examCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Lớp {exam.grade || '11'}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white line-clamp-2">{exam.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{exam.topic || 'GDPT 2018'}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <div>
                        <span className="font-bold text-emerald-400">{subsForExam.length}</span> bài đã nộp
                      </div>
                      {onDeleteExam && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Admin: Bạn có chắc chắn muốn xóa đề thi [${exam.examCode}] - "${exam.title}"?`)) {
                              onDeleteExam(exam.id);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 text-[11px] font-semibold border border-slate-700 transition-all cursor-pointer"
                        >
                          Xóa Đề
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: BÁO CÁO & THỐNG KÊ HỆ THỐNG
           ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span>Báo Cáo Tình Hình Sử Dụng Toàn Hệ Thống EduMath AI</span>
              </h3>
              <p className="text-xs text-slate-400">
                Thống kê tổng hợp số liệu thời gian thực trên toàn bộ các lớp học và các giáo viên trong trường.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500">Tỷ Lệ Duyệt Giáo Viên</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {totalTeachers > 0 ? Math.round((approvedTeachers.length / totalTeachers) * 100) : 100}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500">Trung Bình Đề / GV</div>
                  <div className="text-2xl font-black text-indigo-400 mt-1">
                    {approvedTeachers.length > 0 ? (totalExamsCount / approvedTeachers.length).toFixed(1) : '0'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500">Điểm Trung Bình Toàn Trường</div>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    {submissions.length > 0
                      ? (submissions.reduce((acc, s) => acc + (s.totalScore || 0), 0) / submissions.length).toFixed(1)
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500">Trạng Thái Kết Nối</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                    Online
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: CẤU HÌNH HỆ THỐNG & PHÊ DUYỆT
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-400" />
                <span>Cấu Hình Phê Duyệt Tài Khoản Giáo Viên</span>
              </h3>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-sm text-white">Chế Độ Duyệt Thủ Công Bởi Quản Trị Viên (Khuyến Nghị)</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Khi giáo viên mới đăng ký tài khoản, tài khoản sẽ ở trạng thái "Chờ duyệt". Giáo viên chỉ có thể đăng nhập sau khi Admin phê duyệt.
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!autoApproveNewTeachers}
                    onChange={(e) => {
                      const manual = e.target.checked;
                      setAutoApproveNewTeachers(!manual);
                      localStorage.setItem('edumath_auto_approve_teachers', String(!manual));
                      showToast(
                        manual
                          ? 'Đã bật chế độ: Bắt buộc Admin duyệt thủ công trước khi giáo viên được đăng nhập.'
                          : 'Đã bật chế độ: Tự động phê duyệt ngay khi giáo viên đăng ký.',
                        'info'
                      );
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-sm text-white">Thông Tin Tài Khoản Quản Trị Viên Tối Cao</div>
                <div className="text-xs text-slate-400">
                  Tài khoản: <span className="font-mono text-rose-300 font-bold">admin</span> (hoặc <span className="font-mono text-rose-300">admin@edumath.edu.vn</span>)
                </div>
                <div className="text-xs text-slate-400">
                  Mật khẩu mặc định: <span className="font-mono text-amber-300 font-bold">123456</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODALS: Create Teacher, Reset Password, Edit Teacher, Delete Confirmation
         ========================================================================= */}

      {/* 1. Create Teacher Modal */}
      {isCreateTeacherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-rose-400" />
              <span>Tạo Tài Khoản Giáo Viên Mới</span>
            </h3>
            <p className="text-xs text-slate-400">
              Tài khoản tạo bởi Quản trị viên sẽ được kích hoạt sẵn để giáo viên có thể đăng nhập ngay.
            </p>

            <form onSubmit={handleCreateTeacher} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Họ Và Tên Giáo Viên *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ví dụ: Thầy Nguyễn Văn A"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tên Đăng Nhập (Username) *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())}
                  placeholder="Ví dụ: gv_toan_nguyenvana"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Mật Khẩu Ban Đầu *</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Trường THPT Công Tác</label>
                <input
                  type="text"
                  value={newSchool}
                  onChange={(e) => setNewSchool(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Bộ Môn Giảng Dạy</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTeacherOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Tạo & Kích Hoạt Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Reset Password Modal */}
      {resetTargetTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <span>Đổi Mật Khẩu Giáo Viên</span>
            </h3>
            <p className="text-xs text-slate-400">
              Can thiệp đặt lại mật khẩu mới cho tài khoản: <strong className="text-white">{resetTargetTeacher.fullName}</strong> (@{resetTargetTeacher.username})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Mật khẩu mới</label>
              <input
                type="text"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordValue('123456')}
                  className="px-2 py-1 rounded-md bg-slate-800 text-[10px] text-slate-400 hover:text-white"
                >
                  Mặc định: 123456
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTargetTeacher(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Lưu Mật Khẩu Mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit Teacher Modal */}
      {editTargetTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-400" />
              <span>Chỉnh Sửa Thông Tin Giáo Viên</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Họ Và Tên</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Trường Công Tác</label>
                <input
                  type="text"
                  value={editSchool}
                  onChange={(e) => setEditSchool(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Bộ Môn</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTargetTeacher(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditTeacher}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Cập Nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {deleteTargetTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-rose-900/60 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-white">Xác Nhận Xóa Vĩnh Viễn Giáo Viên</h3>
              <p className="text-xs text-slate-400">
                Hành động này sẽ xóa vĩnh viễn tài khoản của <strong className="text-rose-400">{deleteTargetTeacher.fullName}</strong> (@{deleteTargetTeacher.username}) khỏi hệ thống.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>- Giáo viên sẽ không thể đăng nhập vào nền tảng.</div>
              <div>- Tài khoản được dọn dẹp sạch trên cơ sở dữ liệu Cloud Firestore.</div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetTeacher(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeacher}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reset Student Password Modal */}
      {editTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <span>Reset Mật Khẩu Học Sinh</span>
            </h3>
            <p className="text-xs text-slate-400">
              Đặt lại mật khẩu cho học sinh: <strong className="text-white">{editTargetStudent.fullName}</strong> (Lớp {editTargetStudent.className})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Mật khẩu mới</label>
              <input
                type="text"
                value={resetStudentPinValue}
                onChange={(e) => setResetStudentPinValue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTargetStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleResetStudentPassword}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Lưu Mật Khẩu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
