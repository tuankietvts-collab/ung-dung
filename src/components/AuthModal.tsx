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
import { AppUser, UserRole } from '../types/exam';
import { loginAppUser, registerAppUser } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AppUser) => void;
  defaultRole?: UserRole;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultRole = 'teacher',
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>(defaultRole);

  // Form states
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('123456');
  const [fullName, setFullName] = useState<string>('Thầy Trịnh Tuấn Kiệt');
  const [school, setSchool] = useState<string>('Bộ môn Toán THPT - GDPT 2018');
  const [className, setClassName] = useState<string>('10A1');
  const [subject, setSubject] = useState<string>('Toán Học THPT');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Quick auto-fill default admin credentials
  const handleQuickAdmin = () => {
    setActiveTab('login');
    setUsername('admin');
    setPassword('123456');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        if (!username.trim() || !password.trim()) {
          throw new Error('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
        }
        const user = await loginAppUser(username.trim(), password.trim());
        if (showToast) {
          showToast(`Đăng nhập thành công! Chào mừng ${user.fullName}`);
        }
        onAuthSuccess(user);
        onClose();
      } else {
        if (!fullName.trim() || !username.trim() || !password.trim()) {
          throw new Error('Vui lòng điền đầy đủ Họ và tên, Tên đăng nhập và Mật khẩu.');
        }
        if (password.length < 6) {
          throw new Error('Mật khẩu tối thiểu 6 ký tự.');
        }
        const user = await registerAppUser({
          role,
          fullName: fullName.trim(),
          username: username.trim(),
          password: password.trim(),
          school: school.trim(),
          className: role === 'student' ? className.trim() : undefined,
          subject: role === 'teacher' ? subject.trim() : undefined,
        });
        if (showToast) {
          showToast(`Đăng ký tài khoản thành công!`);
        }
        onAuthSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi xác thực người dùng.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                Xác Thực Hệ Thống
              </span>
              <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                Cổng Quản Trị & Giáo Viên
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-black transition-all cursor-pointer border-b-2 ${
              activeTab === 'login'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-black transition-all cursor-pointer border-b-2 ${
              activeTab === 'register'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng Ký Tài Khoản
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">

          {/* Quick Admin Auto-fill Button */}
          {activeTab === 'login' && (
            <>
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-indigo-950 block">Tài khoản Admin Quản Trị:</span>
                  <span className="text-[11px] text-indigo-700 font-mono">admin / 123456</span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickAdmin}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Điền Nhanh</span>
                </button>
              </div>

              {/* Student Login Guide */}
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2">
                <GraduationCap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Dành cho Học Sinh:</span> Đăng nhập bằng tên tài khoản do Thầy/Cô cấp (ví dụ: <code className="bg-amber-100 px-1 rounded font-bold">12a1_01</code>, mật khẩu: <code className="bg-amber-100 px-1 rounded font-bold">123456</code>). Hoặc mở Link thi trực tiếp để làm bài ngay!
                </div>
              </div>
            </>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeTab === 'register' && (
              <>
                {/* Role selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Vai Trò <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        role === 'teacher'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Giáo Viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        role === 'student'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Học Sinh</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ví dụ: Thầy Trịnh Tuấn Kiệt"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {role === 'student' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Lớp Học <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="10A1, 12A8..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Trường / Đơn Vị Công Tác
                    </label>
                    <input
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="THPT Chuyên / Chuẩn Quốc Gia"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Tài Khoản / Tên Đăng Nhập <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin hoặc email..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Mật Khẩu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{activeTab === 'login' ? 'Đăng Nhập Vào Hệ Thống' : 'Hoàn Tất Đăng Ký'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <X className="w-3.5 h-3.5" />
              <span>Đóng Cửa Sổ & Về Trang Giáo Viên</span>
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 font-medium">
          Hệ thống khảo thí Toán học EduMath AI • Thầy Trịnh Tuấn Kiệt
        </div>

      </div>
    </div>
  );
};
