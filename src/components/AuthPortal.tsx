import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Mail,
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
  X,
  ExternalLink
} from 'lucide-react';
import { AppUser, UserRole } from '../types/exam';
import { registerAppUser, loginAppUser } from '../services/firebase';

interface AuthPortalProps {
  onAuthSuccess: (user: AppUser) => void;
  onClose?: () => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthSuccess, onClose }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Register form state
  const [regRole, setRegRole] = useState<UserRole>('teacher');
  const [regFullName, setRegFullName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regSchool, setRegSchool] = useState<string>('Trường THPT Chuyên');
  const [regClass, setRegClass] = useState<string>('12A1');
  const [regSubject, setRegSubject] = useState<string>('Toán Học THPT');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginAppUser(loginUsername.trim(), loginPassword.trim());
      onAuthSuccess(user);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regFullName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Họ và tên, Email/Tên đăng nhập và Mật khẩu.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await registerAppUser({
        role: regRole,
        fullName: regFullName.trim(),
        username: regUsername.trim(),
        password: regPassword.trim(),
        school: regSchool.trim(),
        className: regRole === 'student' ? regClass.trim() : undefined,
        subject: regRole === 'teacher' ? regSubject.trim() : 'Toán',
      });
      onAuthSuccess(user);
    } catch (err: any) {
      console.error('Register error:', err);
      setErrorMessage(err?.message || 'Lỗi khi đăng ký tài khoản mới.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Banner / Logo */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sigma className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 bg-clip-text text-transparent">
                EduMath AI
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                GDPT 2018
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Nền Tảng Thi Trực Tuyến & Chấm Tự Luận Bằng Gemini AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hệ thống trực tuyến sẵn sàng</span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-300 transition-all cursor-pointer shadow-xs hover:border-slate-400"
              title="Đóng để về trang Giáo viên"
            >
              <X className="w-4 h-4 text-rose-500" />
              <span>Về Trang Giáo Viên</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Auth Box */}
      <main className="max-w-xl mx-auto w-full my-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/90 relative overflow-hidden">
          {/* Decorative accent top bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />

          {/* Close button 'X' on top-right of dialog */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-slate-200 shadow-2xs group"
              title="Đóng cửa sổ để trở về trang Giáo viên"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          )}

          {/* Heading */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
              {activeTab === 'login' ? <KeyRound className="w-8 h-8" /> : <GraduationCap className="w-8 h-8" />}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'login' ? 'Cổng Xác Thực Hệ Thống' : 'Đăng Ký Tài Khoản Mới'}
            </h1>
            <div className="inline-block">
              <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 py-1.5 px-4 rounded-full border border-indigo-200 shadow-2xs">
                Được phát triển bởi Thầy Trịnh Tuấn Kiệt
              </span>
            </div>
            <p className="text-xs text-slate-500 pt-1 max-w-md mx-auto">
              {activeTab === 'login'
                ? 'Đăng nhập phân quyền Giáo viên / Quản trị viên để soạn đề, hoặc Học sinh để vào phòng thi.'
                : 'Tạo tài khoản Giáo viên hoặc Học sinh để lưu trữ kết quả và đề thi trên Cloud Firestore.'}
            </p>
          </div>

          {/* Student & Direct link guidance card */}
          <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
            <GraduationCap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-extrabold text-amber-900 block text-xs">
                💡 Hướng Dẫn Dành Cho Học Sinh:
              </span>
              <span>
                • <b>Nếu có tài khoản:</b> Đăng nhập bằng tên đăng nhập do Thầy/Cô cấp (ví dụ: <code className="bg-amber-100 text-amber-900 font-mono font-bold px-1 rounded">12a1_01</code>, mật khẩu: <code className="bg-amber-100 text-amber-900 font-mono font-bold px-1 rounded">123456</code>).
              </span>
              <br />
              <span className="text-slate-600">
                • <b>Nếu thi qua Link:</b> Em chỉ cần bấm vào Link đề thi do Thầy/Cô gửi, điền Họ tên và Lớp là vào thi ngay mà không cần mật khẩu!
              </span>
            </div>
          </div>

          {/* 2 Clear Tabs: [ĐĂNG NHẬP] & [ĐĂNG KÝ TÀI KHOẢN] */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl mb-6 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>ĐĂNG NHẬP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
              }}
              className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'register'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>ĐĂNG KÝ TÀI KHOẢN</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: FORM ĐĂNG NHẬP */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tài khoản / Email (Giáo viên hoặc Học sinh)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Tên đăng nhập hoặc email..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-extrabold text-base rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Xác Thực...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>Đăng Nhập Vào Hệ Thống</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: FORM ĐĂNG KÝ TÀI KHOẢN */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Lựa chọn đối tượng đăng ký: [Giáo Viên] hoặc [Học Sinh] */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Đối tượng đăng ký <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRegRole('teacher')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      regRole === 'teacher'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>👨‍🏫 Giáo Viên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      regRole === 'student'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>🎓 Học Sinh</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ và tên {regRole === 'teacher' ? 'Thầy/Cô' : 'Học sinh'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder={regRole === 'teacher' ? 'VD: Thầy Nguyễn Văn A' : 'VD: Nguyễn Minh Quân'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email / Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder={regRole === 'teacher' ? 'gv_toan@gmail.com' : 'hs_quan@gmail.com'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu (Tối thiểu 6 ký tự) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Dynamic fields based on role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {regRole === 'teacher' ? 'Trường THPT / Đơn vị' : 'Trường THPT'}
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={regSchool}
                      onChange={(e) => setRegSchool(e.target.value)}
                      placeholder="THPT Chuyên"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {regRole === 'teacher' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Bộ Môn Giảng Dạy
                    </label>
                    <div className="relative">
                      <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={regSubject}
                        onChange={(e) => setRegSubject(e.target.value)}
                        placeholder="Toán Học THPT"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Lớp Học Của Em <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={regClass}
                        onChange={(e) => setRegClass(e.target.value)}
                        placeholder="12A1 hoặc 10A8"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-extrabold text-base rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang Tạo Tài Khoản...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Đăng Ký {regRole === 'teacher' ? 'Tài Khoản Giáo Viên' : 'Tài Khoản Học Sinh'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick return to teacher page if teacher just wants to compose or explore */}
          {onClose && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium">
                Thầy/Cô muốn vào thẳng trang quản trị soạn đề?
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200"
              >
                <span>✕ Đóng & Về Trang Giáo Viên</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Solemn Footer Branding */}
      <footer className="max-w-7xl mx-auto w-full pt-4 text-center">
        <p className="text-xs font-bold text-slate-700">
          EduMath AI - Nền Tảng Thi Trực Tuyến & Chấm Tự Luận Bằng Gemini AI • Được phát triển bởi Thầy Trịnh Tuấn Kiệt
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Hệ thống khảo thí môn Toán THPT chuẩn chương trình GDPT 2018 (Kết Nối Tri Thức / Cánh Diều / Chân Trời Sáng Tạo)
        </p>
      </footer>
    </div>
  );
};
