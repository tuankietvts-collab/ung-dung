import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Building2,
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GraduationCap,
  KeyRound,
  School,
  Sigma,
  Calendar,
  Eye,
  EyeOff,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { AppUser, ClassGroup } from '../types/exam';
import {
  registerAppUser,
  loginAppUser,
  loginStudentWithClassContext,
  getStoredClasses,
  subscribeClassGroupsFromFirestore,
} from '../services/firebase';
import {
  encodeSchoolName,
  encodeSubjectName,
  encodeSchoolYear,
  generateClassId,
  generateStudentDocId,
} from '../services/schoolEncoder';

interface AuthPortalProps {
  onAuthSuccess: (user: AppUser) => void;
}

const STUDENT_LOGIN_PREFS_KEY = 'edumath_student_login_prefs';

export const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthSuccess }) => {
  // Main Tab: 'student' or 'teacher'
  const [portalMode, setPortalMode] = useState<'student' | 'teacher'>('student');

  // Teacher Tab: 'login' or 'register'
  const [teacherSubTab, setTeacherSubTab] = useState<'login' | 'register'>('login');

  // Classes list for dynamic dropdowns
  const [classesList, setClassesList] = useState<ClassGroup[]>(() => getStoredClasses());

  useEffect(() => {
    const unsub = subscribeClassGroupsFromFirestore(
      (list) => {
        if (list && list.length > 0) {
          setClassesList(list);
        }
      },
      undefined,
      true
    );
    return () => unsub();
  }, []);

  // ==========================================
  // TAB 1: STUDENT LOGIN STATE & PERSISTENCE
  // ==========================================
  const [studentSchool, setStudentSchool] = useState<string>('THPT Võ Thị Sáu');
  const [studentYear, setStudentYear] = useState<string>('2026-2027');
  const [studentSubject, setStudentSubject] = useState<string>('Toán');
  const [studentClass, setStudentClass] = useState<string>('12A8');
  const [studentAccount, setStudentAccount] = useState<string>('');
  const [studentPassword, setStudentPassword] = useState<string>('123456');
  const [showStudentPassword, setShowStudentPassword] = useState<boolean>(false);

  // Restore saved preferences from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STUDENT_LOGIN_PREFS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.school) setStudentSchool(saved.school);
        if (saved.year) setStudentYear(saved.year);
        if (saved.subject) setStudentSubject(saved.subject);
        if (saved.className) setStudentClass(saved.className);
      }
    } catch {}
  }, []);

  // Save student preferences whenever changed
  const saveStudentPrefs = (
    school: string,
    year: string,
    subject: string,
    className: string
  ) => {
    try {
      localStorage.setItem(
        STUDENT_LOGIN_PREFS_KEY,
        JSON.stringify({ school, year, subject, className })
      );
    } catch {}
  };

  // Derive unique dropdown options from created classes
  const uniqueSchools = useMemo(() => {
    const set = new Set<string>();
    set.add('THPT Võ Thị Sáu');
    classesList.forEach((c) => {
      if (c.schoolFullName?.trim()) set.add(c.schoolFullName.trim());
    });
    return Array.from(set);
  }, [classesList]);

  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    set.add('2026-2027');
    set.add('2025-2026');
    classesList.forEach((c) => {
      if (c.schoolYear?.trim()) set.add(c.schoolYear.trim());
    });
    return Array.from(set);
  }, [classesList]);

  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    set.add('Toán');
    set.add('Vật Lý');
    set.add('Hóa Học');
    set.add('Sinh Học');
    set.add('Ngữ Văn');
    set.add('Tiếng Anh');
    set.add('Giáo dục kinh tế và pháp luật');
    classesList.forEach((c) => {
      if (c.subjectFullName?.trim()) set.add(c.subjectFullName.trim());
    });
    return Array.from(set);
  }, [classesList]);

  const availableClassNames = useMemo(() => {
    const matching = classesList
      .filter((c) => {
        const matchSchool =
          !c.schoolFullName ||
          c.schoolFullName.toLowerCase() === studentSchool.toLowerCase();
        const matchYear =
          !c.schoolYear ||
          c.schoolYear.toLowerCase() === studentYear.toLowerCase();
        const matchSubject =
          !c.subjectFullName ||
          c.subjectFullName.toLowerCase() === studentSubject.toLowerCase();
        return matchSchool || matchYear || matchSubject;
      })
      .map((c) => c.name);

    const all = Array.from(new Set([...matching, '12A8', '11A1', '10A1']));
    return all.sort();
  }, [classesList, studentSchool, studentYear, studentSubject]);

  // Compute live underlying codes and preview Document ID
  const activeSchoolCode = encodeSchoolName(studentSchool);
  const activeSubjectCode = encodeSubjectName(studentSubject);
  const activeYearCode = encodeSchoolYear(studentYear);

  const previewTargetDocId = useMemo(() => {
    const numMatch = studentAccount.trim().match(/(\d{1,2})$/);
    const stt2 = numMatch ? String(numMatch[1]).padStart(2, '0') : '01';
    const clsClean = (studentClass || '12A8').trim().toUpperCase().replace(/^LỚP\s+/i, '');
    const classId = generateClassId(studentSchool, studentSubject, studentYear, clsClean);
    return generateStudentDocId(classId, parseInt(stt2, 10));
  }, [studentSchool, studentSubject, studentYear, studentClass, studentAccount]);

  // ==========================================
  // TAB 2: TEACHER LOGIN & REGISTER STATE
  // ==========================================
  const [teacherLoginUsername, setTeacherLoginUsername] = useState<string>('');
  const [teacherLoginPassword, setTeacherLoginPassword] = useState<string>('');

  const [regFullName, setRegFullName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regSchool, setRegSchool] = useState<string>('THPT Võ Thị Sáu');
  const [regSubject, setRegSubject] = useState<string>('Toán');
  const [regSchoolYear, setRegSchoolYear] = useState<string>('2026-2027');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Student Login
  const handleStudentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanInput = studentAccount.trim();
    if (!cleanInput) {
      setErrorMessage('Vui lòng nhập Mã tài khoản học sinh (ví dụ: 12a805 hoặc 05).');
      return;
    }

    setIsLoading(true);
    try {
      saveStudentPrefs(studentSchool, studentYear, studentSubject, studentClass);

      const studentUser = await loginStudentWithClassContext({
        schoolCode: activeSchoolCode,
        subjectCode: activeSubjectCode,
        yearCode: activeYearCode,
        className: studentClass,
        inputAccount: cleanInput,
        password: studentPassword.trim() || '123456',
        schoolFullName: studentSchool,
        subjectFullName: studentSubject,
        schoolYear: studentYear,
      });

      onAuthSuccess(studentUser);
    } catch (err: any) {
      console.error('Student login error:', err);
      setErrorMessage(
        err?.message ||
          'Đăng nhập không thành công. Vui lòng kiểm tra lại Trường, Môn, Lớp và Số thứ tự học sinh.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Teacher Login
  const handleTeacherLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!teacherLoginUsername.trim() || !teacherLoginPassword.trim()) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginAppUser(
        teacherLoginUsername.trim(),
        teacherLoginPassword.trim()
      );
      onAuthSuccess(user);
    } catch (err: any) {
      console.error('Teacher login error:', err);
      setErrorMessage(
        err?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Teacher Register
  const handleTeacherRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regFullName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Họ và tên, Tên đăng nhập và Mật khẩu.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await registerAppUser({
        role: 'teacher',
        fullName: regFullName.trim(),
        username: regUsername.trim(),
        password: regPassword.trim(),
        school: regSchool.trim(),
        subject: regSubject.trim(),
      });

      if (!user.isApproved) {
        setTeacherSubTab('login');
        setTeacherLoginUsername(user.username);
        setSuccessMessage(
          `Đăng ký tài khoản Giáo viên "${user.username}" thành công! Tài khoản của Thầy/Cô đang chờ Quản trị viên (Admin) phê duyệt trước khi có thể đăng nhập.`
        );
        return;
      }
      onAuthSuccess(user);
    } catch (err: any) {
      console.error('Teacher register error:', err);
      setErrorMessage(err?.message || 'Lỗi khi đăng ký tài khoản giáo viên mới.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8 text-slate-100 font-sans">
      {/* Top Banner / Logo */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-2 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Sigma className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
                EduMath AI
              </span>
              <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                GDPT 2018
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Cổng Thi Trực Tuyến & Quản Lý Khảo Thí GDPT 2018
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Máy chủ trực tuyến sẵn sàng</span>
            <span className="sm:hidden">Online</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-xl mx-auto w-full my-6">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />

          {/* Heading */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
              {portalMode === 'student' ? (
                <GraduationCap className="w-7 h-7" />
              ) : (
                <ShieldCheck className="w-7 h-7" />
              )}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Cổng Xác Thực Hệ Thống
            </h1>
            <div className="inline-block">
              <span className="text-[11px] font-extrabold text-indigo-300 bg-indigo-950/80 py-1 px-3.5 rounded-full border border-indigo-700/60 shadow-xs">
                Được phát triển bởi Thầy Trịnh Tuấn Kiệt
              </span>
            </div>
          </div>

          {/* 2 MAIN ROLE TABS */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-2xl mb-6 text-xs font-black border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setPortalMode('student');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                portalMode === 'student'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>🎓 HỌC SINH ĐĂNG NHẬP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode('teacher');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                portalMode === 'teacher'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>👨‍🏫 GIÁO VIÊN / QUẢN TRỊ</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-200 flex items-start gap-2.5 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: 🎓 HỌC SINH ĐĂNG NHẬP (4 DROPDOWNS + [LỚP+STT]) */}
          {/* ======================================================== */}
          {portalMode === 'student' && (
            <form onSubmit={handleStudentLoginSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/60 text-xs text-indigo-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Học sinh chọn <b>Trường, Năm học, Môn học, Lớp</b> bên dưới và gõ nhanh <b>Mã STT</b> (VD: <code className="bg-indigo-900 text-amber-300 font-mono font-bold px-1 rounded">12a805</code> hoặc <code className="bg-indigo-900 text-amber-300 font-mono font-bold px-1 rounded">05</code>) để vào đúng phòng thi.
                </span>
              </div>

              {/* 4 DROPDOWNS: Trường, Năm học, Môn học, Lớp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
                {/* 1. Chọn Trường */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-indigo-400" /> Chọn Trường
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300">
                      Mã: {activeSchoolCode}
                    </span>
                  </label>
                  <select
                    value={studentSchool}
                    onChange={(e) => {
                      setStudentSchool(e.target.value);
                      saveStudentPrefs(e.target.value, studentYear, studentSubject, studentClass);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                  >
                    {uniqueSchools.map((sch) => (
                      <option key={sch} value={sch}>
                        {sch}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Chọn Năm Học */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Năm Học
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300">
                      Niên khóa: {activeYearCode}
                    </span>
                  </label>
                  <select
                    value={studentYear}
                    onChange={(e) => {
                      setStudentYear(e.target.value);
                      saveStudentPrefs(studentSchool, e.target.value, studentSubject, studentClass);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer font-mono"
                  >
                    {uniqueYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Chọn Môn Học */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Môn Học
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300">
                      Mã: {activeSubjectCode}
                    </span>
                  </label>
                  <select
                    value={studentSubject}
                    onChange={(e) => {
                      setStudentSubject(e.target.value);
                      saveStudentPrefs(studentSchool, studentYear, e.target.value, studentClass);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                  >
                    {uniqueSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Chọn Lớp */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" /> Chọn Lớp
                    </span>
                    <span className="text-[10px] font-mono text-amber-400">
                      {studentClass}
                    </span>
                  </label>
                  <select
                    value={studentClass}
                    onChange={(e) => {
                      setStudentClass(e.target.value);
                      saveStudentPrefs(studentSchool, studentYear, studentSubject, e.target.value);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer uppercase"
                  >
                    {availableClassNames.map((cls) => (
                      <option key={cls} value={cls}>
                        Lớp {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ô TÀI KHOẢN: HỌC SINH GÕ [LỚP + STT] (VD: 12a805 hoặc 05) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Mã Tài Khoản Học Sinh [Lớp + STT] <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    VD: <b>12a805</b> hoặc <b>05</b>
                  </span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={studentAccount}
                    onChange={(e) => setStudentAccount(e.target.value)}
                    placeholder="Nhập 12a805 hoặc 05..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Mật khẩu học sinh (mặc định 123456) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Mật Khẩu Khởi Tạo</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Mặc định: <code className="text-amber-300 font-mono font-bold">123456</code>
                  </span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword((p) => !p)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Live Document ID Indicator */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Document ID truy vấn:</span>
                <code className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-mono font-bold text-[10px]">
                  {previewTargetDocId}
                </code>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-black text-base rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang Xác Thực Học Sinh...</span>
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-5 h-5" />
                    <span>Đăng Nhập Vào Phòng Thi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: 👨‍🏫 GIÁO VIÊN / QUẢN TRỊ (ĐĂNG NHẬP HOẶC ĐĂNG KÝ) */}
          {/* ======================================================== */}
          {portalMode === 'teacher' && (
            <div className="space-y-4">
              {/* Sub-tabs for Teacher: Login or Register */}
              <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('login');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                    teacherSubTab === 'login'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Đăng Nhập Giáo Viên / Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('register');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                    teacherSubTab === 'register'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Đăng Ký Tài Khoản Mới
                </button>
              </div>

              {/* TEACHER SUB-TAB 1: LOGIN */}
              {teacherSubTab === 'login' && (
                <form onSubmit={handleTeacherLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tên Đăng Nhập / Email Giáo Viên
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={teacherLoginUsername}
                        onChange={(e) => setTeacherLoginUsername(e.target.value)}
                        placeholder="admin hoặc username của giáo viên..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-base font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Mật Khẩu
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        value={teacherLoginPassword}
                        onChange={(e) => setTeacherLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-base font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  {/* Fast Admin Quick-fill Hint */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Tài khoản Quản trị viên mẫu:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherLoginUsername('admin');
                        setTeacherLoginPassword('123456');
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono font-bold text-xs cursor-pointer"
                    >
                      Điền admin / 123456
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-black text-base rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang Xác Thực...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        <span>Đăng Nhập Giáo Viên / Admin</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TEACHER SUB-TAB 2: REGISTER (TỰ DO ĐẶT USERNAME) */}
              {teacherSubTab === 'register' && (
                <form onSubmit={handleTeacherRegisterSubmit} className="space-y-3.5">
                  <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-200">
                    💡 Thầy/Cô có thể <b>tự do đặt Tên đăng nhập</b> theo ý muốn (miễn không trùng với tài khoản đã có trên hệ thống).
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Họ và Tên Thầy/Cô <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="VD: Thầy Nguyễn Văn A"
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Tên Đăng Nhập Tự Do <span className="text-rose-400">*</span></span>
                      <span className="text-[10px] text-slate-400">Không phân biệt hoa thường</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="VD: thaykiet, kietvts, giaovientoan..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Mật Khẩu Khởi Tạo <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Trường Công Tác
                      </label>
                      <input
                        type="text"
                        value={regSchool}
                        onChange={(e) => setRegSchool(e.target.value)}
                        placeholder="VD: THPT Võ Thị Sáu"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Môn Giảng Dạy
                      </label>
                      <input
                        type="text"
                        value={regSubject}
                        onChange={(e) => setRegSubject(e.target.value)}
                        placeholder="VD: Toán"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang Đăng Ký...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Đăng Ký Tài Khoản Giáo Viên</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 py-3 border-t border-slate-800/60">
        EduMath AI • Nền tảng khảo thí chuẩn Bộ GD&ĐT GDPT 2018 • Phát triển bởi Thầy Trịnh Tuấn Kiệt
      </footer>
    </div>
  );
};
