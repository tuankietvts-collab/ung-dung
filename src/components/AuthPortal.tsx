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
  db,
} from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  encodeSchoolName,
  encodeSubjectName,
  encodeSchoolYear,
  generateClassId,
  generateStudentDocId,
} from '../services/schoolEncoder';

export const SUBJECTS: { name: string; code: string }[] = [
  { name: 'Toán', code: 'TO' },
  { name: 'Vật lí', code: 'VL' },
  { name: 'Hóa học', code: 'HH' },
  { name: 'Sinh học', code: 'SH' },
  { name: 'Tin học', code: 'TH' },
  { name: 'Ngữ văn', code: 'NV' },
  { name: 'Lịch sử', code: 'LS' },
  { name: 'Địa lí', code: 'DL' },
  { name: 'Tiếng Anh', code: 'TA' },
  { name: 'Giáo dục kinh tế và pháp luật', code: 'KTPL' },
  { name: 'Công nghệ', code: 'CN' },
  { name: 'Giáo dục công dân', code: 'GDCD' },
  { name: 'Khoa học tự nhiên', code: 'KHTN' },
  { name: 'Lịch sử và Địa lí', code: 'LSDL' },
];

export const GRADES = ['6', '7', '8', '9', '10', '11', '12'];

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
  const [studentGrade, setStudentGrade] = useState<string>('12');
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
        if (saved.grade) setStudentGrade(saved.grade);
        if (saved.className) setStudentClass(saved.className);
      }
    } catch {}
  }, []);

  // Save student preferences whenever changed
  const saveStudentPrefs = (
    school: string,
    year: string,
    subject: string,
    grade: string,
    className: string
  ) => {
    try {
      localStorage.setItem(
        STUDENT_LOGIN_PREFS_KEY,
        JSON.stringify({ school, year, subject, grade, className })
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

  // Cập nhật mảng SUBJECTS đủ các môn chuẩn GDPT 2018
  const uniqueSubjects = useMemo(() => {
    return SUBJECTS;
  }, []);

  // Khi chọn Khối grade (6-12), tự động sinh danh sách ô CHỌN LỚP từ ${grade}A1 đến ${grade}A12
  const availableClassNames = useMemo(() => {
    const generated = Array.from({ length: 12 }, (_, i) => `${studentGrade}A${i + 1}`);
    const customClasses = classesList
      .map((c) => c.name.trim().toUpperCase().replace(/^LỚP\s+/i, ''))
      .filter((name) => name.startsWith(studentGrade));
    const all = Array.from(new Set([...generated, ...customClasses]));
    return all.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB || a.localeCompare(b);
    });
  }, [studentGrade, classesList]);

  const handleGradeChange = (newGrade: string) => {
    setStudentGrade(newGrade);
    const newClass = `${newGrade}A1`;
    setStudentClass(newClass);
    saveStudentPrefs(studentSchool, studentYear, studentSubject, newGrade, newClass);
  };

  // Compute live underlying codes and preview Document ID
  const activeSchoolCode = encodeSchoolName(studentSchool);
  const activeSubjectCode = encodeSubjectName(studentSubject);
  const activeYearCode = encodeSchoolYear(studentYear);

  const previewTargetDocId = useMemo(() => {
    const numMatch = studentAccount.trim().match(/(\d{1,2})$/);
    const stt2 = numMatch ? String(numMatch[1]).padStart(2, '0') : '01';
    const clsClean = (studentClass || `${studentGrade}A1`).trim().toUpperCase().replace(/^LỚP\s+/i, '');
    const classId = generateClassId(studentSchool, studentSubject, studentYear, clsClean);
    return generateStudentDocId(classId, parseInt(stt2, 10));
  }, [studentSchool, studentSubject, studentYear, studentClass, studentGrade, studentAccount]);

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
      saveStudentPrefs(studentSchool, studentYear, studentSubject, studentGrade, studentClass);

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
          'Đăng nhập không thành công. Vui lòng kiểm tra lại Trường, Môn, Khối, Lớp và Số thứ tự học sinh.'
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

  // Handle Teacher Register (Bắt buộc dùng setDoc trên collection 'teachers' theo cleanUsername)
  const handleTeacherRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = regFullName.trim();
    const rawUsername = regUsername.trim();
    const cleanUsername = rawUsername.toLowerCase().replace(/\s+/g, '');
    const cleanPassword = regPassword.trim();
    const cleanSchool = regSchool.trim() || 'THPT Võ Thị Sáu';
    const cleanSubject = regSubject.trim() || 'Toán';

    if (!cleanName || !rawUsername || !cleanPassword) {
      setErrorMessage('Vui lòng điền đầy đủ Họ và tên, Tên đăng nhập và Mật khẩu.');
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const teacherData = {
        uid: cleanUsername,
        role: 'teacher',
        status: 'pending',
        fullName: cleanName,
        username: rawUsername,
        cleanUsername,
        email: rawUsername.includes('@') ? rawUsername : `${cleanUsername}@edumath.edu.vn`,
        school: cleanSchool,
        schoolCode: encodeSchoolName(cleanSchool),
        subject: cleanSubject,
        subjectCode: encodeSubjectName(cleanSubject),
        isApproved: false,
        passHash: cleanPassword,
        createdAt: Date.now(),
        updatedAt: new Date().toISOString(),
      };

      // Bắt buộc dùng setDoc(doc(db, 'teachers', cleanUsername), { ...teacherData, role: 'teacher', status: 'pending', createdAt: Date.now() }, { merge: true })
      await setDoc(
        doc(db, 'teachers', cleanUsername),
        {
          ...teacherData,
          role: 'teacher',
          status: 'pending',
          createdAt: Date.now(),
        },
        { merge: true }
      );

      // Đăng ký bổ sung qua AppUser service để lưu đồng bộ vào USERS_COLLECTION và local storage
      const user = await registerAppUser({
        role: 'teacher',
        fullName: cleanName,
        username: rawUsername,
        password: cleanPassword,
        school: cleanSchool,
        subject: cleanSubject,
      });

      if (!user.isApproved) {
        setTeacherSubTab('login');
        setTeacherLoginUsername(user.username);
        setSuccessMessage(
          `Đăng ký tài khoản Giáo viên "${user.username}" thành công! Tài khoản của Thầy/Cô đang chờ Quản trị viên (Admin) phê duyệt trên hệ thống trước khi có thể đăng nhập.`
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 text-slate-800 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Banner / Logo */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-2 border-b border-sky-200/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
            <Sigma className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 bg-clip-text text-transparent">
                EduMath AI
              </span>
              <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                GDPT 2018
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Cổng Thi Trực Tuyến & Quản Lý Khảo Thí GDPT 2018
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white/90 px-3 py-1.5 rounded-full border border-sky-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Máy chủ trực tuyến sẵn sàng</span>
            <span className="sm:hidden">Online</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-xl mx-auto w-full my-6">
        <div className="bg-white border border-sky-100 shadow-xl shadow-sky-100/60 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

          {/* Heading */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-sky-500/25">
              {portalMode === 'student' ? (
                <GraduationCap className="w-7 h-7" />
              ) : (
                <ShieldCheck className="w-7 h-7" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Cổng Xác Thực Hệ Thống
            </h1>
            <div className="inline-block">
              <span className="text-[11px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200 py-1 px-3.5 rounded-full shadow-xs">
                Được phát triển bởi Thầy Trịnh Tuấn Kiệt
              </span>
            </div>
          </div>

          {/* 2 MAIN ROLE TABS */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 rounded-2xl mb-6 text-xs font-black border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setPortalMode('student');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                portalMode === 'student'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-sky-600'
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
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-sky-600'
              }`}
            >
              <User className="w-4 h-4" />
              <span>👨‍🏫 GIÁO VIÊN / QUẢN TRỊ</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: 🎓 HỌC SINH ĐĂNG NHẬP (4 DROPDOWNS + [LỚP+STT]) */}
          {/* ======================================================== */}
          {portalMode === 'student' && (
            <form onSubmit={handleStudentLoginSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-sky-50/90 border border-sky-200 text-xs text-slate-700 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Học sinh chọn <b>Trường, Năm học, Môn học, Lớp</b> bên dưới và gõ nhanh <b>Mã STT</b> (VD: <code className="bg-sky-100 text-sky-800 font-semibold font-mono px-1.5 py-0.5 rounded">12a805</code> hoặc <code className="bg-sky-100 text-sky-800 font-semibold font-mono px-1.5 py-0.5 rounded">05</code>) để vào đúng phòng thi.
                </span>
              </div>

              {/* 5 DROPDOWNS: Trường, Năm học, Môn học, Khối, Lớp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                {/* 1. Chọn Trường */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-sky-600" /> Chọn Trường
                    </span>
                    <span className="text-[10px] font-mono text-sky-600 font-semibold">
                      MÃ: {activeSchoolCode}
                    </span>
                  </label>
                  <select
                    value={studentSchool}
                    onChange={(e) => {
                      setStudentSchool(e.target.value);
                      saveStudentPrefs(e.target.value, studentYear, studentSubject, studentGrade, studentClass);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold cursor-pointer transition-all"
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
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" /> Năm Học
                    </span>
                    <span className="text-[10px] font-mono text-sky-600 font-semibold">
                      NIÊN KHÓA: {activeYearCode}
                    </span>
                  </label>
                  <select
                    value={studentYear}
                    onChange={(e) => {
                      setStudentYear(e.target.value);
                      saveStudentPrefs(studentSchool, e.target.value, studentSubject, studentGrade, studentClass);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold cursor-pointer font-mono transition-all"
                  >
                    {uniqueYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Chọn Môn Học (Chuẩn GDPT 2018) */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-sky-600" /> Môn Học Chuẩn GDPT 2018
                    </span>
                    <span className="text-[10px] font-mono text-sky-600 font-semibold">
                      MÃ MÔN: {activeSubjectCode}
                    </span>
                  </label>
                  <select
                    value={studentSubject}
                    onChange={(e) => {
                      setStudentSubject(e.target.value);
                      saveStudentPrefs(studentSchool, studentYear, e.target.value, studentGrade, studentClass);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    {uniqueSubjects.map((sub) => (
                      <option key={sub.code} value={sub.name}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. CHỌN KHỐI (Từ Khối 6 đến Khối 12) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-600" /> Chọn Khối
                    </span>
                    <span className="text-[10px] font-mono text-sky-600 font-semibold">
                      KHỐI {studentGrade}
                    </span>
                  </label>
                  <select
                    value={studentGrade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Khối {g} (Lớp {g}A1 - {g}A12)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. CHỌN LỚP (Tự động sinh từ ${grade}A1 đến ${grade}A12) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-sky-600" /> Chọn Lớp
                    </span>
                    <span className="text-[10px] font-mono text-sky-600 font-semibold">
                      {studentClass}
                    </span>
                  </label>
                  <select
                    value={studentClass}
                    onChange={(e) => {
                      setStudentClass(e.target.value);
                      saveStudentPrefs(studentSchool, studentYear, studentSubject, studentGrade, e.target.value);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold cursor-pointer uppercase transition-all"
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
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Mã Tài Khoản Học Sinh [Lớp + STT] <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    VD: <b className="text-sky-700">12a805</b> hoặc <b className="text-sky-700">05</b>
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-base font-mono font-bold transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Mật khẩu học sinh (mặc định 123456) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Mật Khẩu Khởi Tạo</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Mặc định: <code className="text-sky-700 font-mono font-bold">123456</code>
                  </span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-base font-mono font-bold transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword((p) => !p)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Live Document ID Indicator */}
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Document ID truy vấn:</span>
                <code className="px-2 py-0.5 bg-white text-sky-700 border border-sky-300 rounded font-mono font-bold text-[10px]">
                  {previewTargetDocId}
                </code>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-base rounded-xl shadow-lg shadow-sky-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
              <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('login');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                    teacherSubTab === 'login'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-sky-700'
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
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-sky-700'
                  }`}
                >
                  Đăng Ký Tài Khoản Mới
                </button>
              </div>

              {/* TEACHER SUB-TAB 1: LOGIN */}
              {teacherSubTab === 'login' && (
                <form onSubmit={handleTeacherLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Tên Đăng Nhập / Email Giáo Viên
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={teacherLoginUsername}
                        onChange={(e) => setTeacherLoginUsername(e.target.value)}
                        placeholder="Nhập tên đăng nhập hoặc email..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-base font-bold transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
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
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-base font-bold transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-base rounded-xl shadow-lg shadow-sky-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                    💡 Thầy/Cô có thể <b>tự do đặt Tên đăng nhập</b> theo ý muốn (miễn không trùng với tài khoản đã có trên hệ thống).
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Họ và Tên Thầy/Cô <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="VD: Thầy Nguyễn Văn A"
                      className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Tên Đăng Nhập Tự Do <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-slate-400">Không phân biệt hoa thường</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="VD: thaykiet, kietvts, giaovientoan..."
                      className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-mono font-bold transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Mật Khẩu Khởi Tạo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự..."
                      className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-mono font-bold transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Trường Công Tác
                      </label>
                      <input
                        type="text"
                        value={regSchool}
                        onChange={(e) => setRegSchool(e.target.value)}
                        placeholder="VD: THPT Võ Thị Sáu"
                        className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Môn Giảng Dạy
                      </label>
                      <select
                        value={regSubject}
                        onChange={(e) => setRegSubject(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        {SUBJECTS.map((sub) => (
                          <option key={sub.code} value={sub.name}>
                            {sub.name} ({sub.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-sm rounded-xl shadow-lg shadow-sky-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 py-3 border-t border-sky-200/60">
        EduMath AI • Nền tảng khảo thí chuẩn Bộ GD&ĐT GDPT 2018 • Phát triển bởi Thầy Trịnh Tuấn Kiệt
      </footer>
    </div>
  );
};
