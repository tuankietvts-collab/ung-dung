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
  X,
  GraduationCap
} from 'lucide-react';
import { TeacherProfile } from '../types/exam';
import { registerTeacherAccount, loginTeacherAccount } from '../services/firebase';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAuthSuccess: (teacher: TeacherProfile) => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // Default Admin Credentials: admin / 123456
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>('admin');
  const [password, setPassword] = useState<string>('123456');
  const [fullName, setFullName] = useState<string>('Thầy Trịnh Tuấn Kiệt');
  const [school, setSchool] = useState<string>('Bộ môn Toán THPT - GDPT 2018');
  const [subject, setSubject] = useState<string>('Toán Học THPT');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!fullName.trim() || !usernameOrEmail.trim() || !password.trim()) {
          throw new Error('Vui lòng điền đầy đủ Họ tên, Tài khoản/Email và Mật khẩu.');
        }
        if (password.length < 6) {
          throw new Error('Mật khẩu tối thiểu 6 ký tự.');
        }
        const profile = await registerTeacherAccount(
          usernameOrEmail.trim(),
          password.trim(),
          fullName.trim(),
          school.trim(),
          subject.trim()
        );
        onAuthSuccess(profile);
      } else {
        if (!usernameOrEmail.trim() || !password.trim()) {
          throw new Error('Vui lòng nhập Tài khoản và Mật khẩu.');
        }
        const profile = await loginTeacherAccount(usernameOrEmail.trim(), password.trim());
        onAuthSuccess(profile);
      }
    } catch (err: any) {
      console.error('Teacher Auth Error:', err);
      setErrorMessage(err.message || 'Lỗi xác thực quản trị viên / giáo viên.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminQuickFill = () => {
    setUsernameOrEmail('admin');
    setPassword('123456');
    setMode('login');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200 relative">
        {/* Optional Close Button if onClose provided */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Đăng Nhập Quản Trị & Giáo Viên' : 'Đăng Ký Tài Khoản Giáo Viên'}
            </h3>
            {/* Solemn Branding */}
            <p className="text-xs font-bold text-indigo-700 bg-indigo-50 py-1 px-3 rounded-full border border-indigo-200 inline-block shadow-2xs">
              Được phát triển bởi Thầy Trịnh Tuấn Kiệt
            </p>
          </div>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto pt-1">
            Hệ thống tạo đề chuẩn ma trận GDPT 2018 & chấm tự luận bằng Gemini AI
          </p>
        </div>

        {/* Default Admin Notice Card */}
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-blue-50 border border-indigo-200/80 text-xs text-indigo-950 flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="font-extrabold text-indigo-900 block text-[11px] uppercase tracking-wider">
              Tài Khoản Admin Mặc Định:
            </span>
            <div className="font-mono text-slate-700 font-bold text-xs mt-0.5">
              Tài khoản: <span className="text-indigo-700">admin</span> • Mật khẩu: <span className="text-indigo-700">123456</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdminQuickFill}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all shrink-0 cursor-pointer"
          >
            Điền Sẵn
          </button>
        </div>

        {/* Tab Toggle: [ĐĂNG NHẬP] / [ĐĂNG KÝ GIÁO VIÊN MỚI] */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl mb-4 text-xs font-extrabold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>ĐĂNG NHẬP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>ĐĂNG KÝ GIÁO VIÊN MỚI</span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Họ và Tên Giáo Viên
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Thầy Trịnh Tuấn Kiệt"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tài Khoản / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="admin"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mật Khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="123456"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Trường THPT
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="THPT Chuyên"
                    className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bộ Môn
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Toán Học"
                    className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý thông tin...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Đăng Nhập Ngay</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Đăng Ký Tài Khoản</span>
              </>
            )}
          </button>
        </form>

        {/* Solemn Branding Footer inside modal */}
        <div className="mt-5 pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] font-bold text-slate-500">
            Hệ Thống Khảo Thí & Chấm Tự Luận AI EduMath
          </p>
          <p className="text-[11px] font-black text-indigo-700 mt-0.5">
            Được phát triển bởi Thầy Trịnh Tuấn Kiệt
          </p>
        </div>
      </div>
    </div>
  );
};
