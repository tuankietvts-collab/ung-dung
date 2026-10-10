import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
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
  Users,
  Lock,
  Sparkles,
  School,
  BookOpen
} from 'lucide-react';
import { AppUser } from '../types/exam';
import {
  getRegisteredTeachers,
  subscribeTeachersFromFirestore,
  approveTeacherUser,
  updateTeacherAccount,
  deleteTeacherAccount,
  createTeacherAccountByAdmin
} from '../services/firebase';

interface AdminTeacherApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminTeacherApprovalModal: React.FC<AdminTeacherApprovalModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals con
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('123456');
  const [newSchool, setNewSchool] = useState<string>('Trường THPT');
  const [newSubject, setNewSubject] = useState<string>('Toán Học THPT');

  // Reset Password Modal
  const [resetTargetTeacher, setResetTargetTeacher] = useState<AppUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState<string>('123456');

  // Edit Teacher Modal
  const [editTargetTeacher, setEditTargetTeacher] = useState<AppUser | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editSchool, setEditSchool] = useState<string>('');
  const [editSubject, setEditSubject] = useState<string>('');

  // Delete Confirmation
  const [deleteTargetTeacher, setDeleteTargetTeacher] = useState<AppUser | null>(null);

  // Copied text state
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Initial load
    setTeachers(getRegisteredTeachers());

    // Subscribe real-time
    const unsubscribe = subscribeTeachersFromFirestore((updatedList) => {
      setTeachers(updatedList);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle approval
  const handleToggleApproval = async (teacher: AppUser, approve: boolean) => {
    setActionLoadingId(teacher.uid);
    try {
      await approveTeacherUser(teacher.uid, approve);
      setTeachers((prev) =>
        prev.map((t) =>
          t.uid === teacher.uid
            ? { ...t, isApproved: approve, approvedAt: approve ? new Date().toISOString() : undefined }
            : t
        )
      );
      if (showToast) {
        showToast(
          approve
            ? `Đã phê duyệt tài khoản giáo viên: ${teacher.fullName}`
            : `Đã thu hồi quyền truy cập của: ${teacher.fullName}`,
          approve ? 'success' : 'info'
        );
      }
    } catch (e: any) {
      console.error('Approval note:', e);
      if (showToast) showToast('Lỗi khi cập nhật trạng thái giáo viên.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Bulk approve all pending
  const handleApproveAllPending = async () => {
    const pendingList = teachers.filter((t) => !t.isApproved);
    if (pendingList.length === 0) return;

    setActionLoadingId('bulk_approve');
    try {
      for (const t of pendingList) {
        await approveTeacherUser(t.uid, true);
      }
      setTeachers((prev) =>
        prev.map((t) => (!t.isApproved ? { ...t, isApproved: true, approvedAt: new Date().toISOString() } : t))
      );
      if (showToast) {
        showToast(`Đã phê duyệt thành công toàn bộ ${pendingList.length} giáo viên đang chờ!`, 'success');
      }
    } catch (e) {
      if (showToast) showToast('Lỗi khi phê duyệt hàng loạt.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create new teacher by admin
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim() || !newPassword.trim()) {
      if (showToast) showToast('Vui lòng nhập đầy đủ thông tin bắt buộc.', 'error');
      return;
    }

    try {
      const created = await createTeacherAccountByAdmin({
        fullName: newFullName.trim(),
        username: newUsername.trim(),
        password: newPassword.trim(),
        school: newSchool.trim(),
        subject: newSubject.trim(),
      });
      setTeachers((prev) => [created, ...prev.filter((t) => t.uid !== created.uid)]);
      setIsCreateModalOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewPassword('123456');
      if (showToast) {
        showToast(`Đã tạo và kích hoạt tài khoản giáo viên: ${created.fullName} thành công!`, 'success');
      }
    } catch (e: any) {
      if (showToast) showToast('Lỗi khi tạo tài khoản giáo viên.', 'error');
    }
  };

  // Reset password
  const handleConfirmResetPassword = async () => {
    if (!resetTargetTeacher || !resetPasswordValue.trim()) return;

    try {
      await updateTeacherAccount(resetTargetTeacher.uid, {
        newPassword: resetPasswordValue.trim(),
      });
      if (showToast) {
        showToast(`Đã đặt lại mật khẩu cho giáo viên ${resetTargetTeacher.fullName} thành: ${resetPasswordValue.trim()}`, 'success');
      }
      setResetTargetTeacher(null);
      setResetPasswordValue('123456');
    } catch (e) {
      if (showToast) showToast('Lỗi khi đặt lại mật khẩu.', 'error');
    }
  };

  // Edit Teacher Info
  const handleConfirmEditTeacher = async () => {
    if (!editTargetTeacher || !editFullName.trim()) return;

    try {
      await updateTeacherAccount(editTargetTeacher.uid, {
        fullName: editFullName.trim(),
        school: editSchool.trim(),
        subject: editSubject.trim(),
      });
      setTeachers((prev) =>
        prev.map((t) =>
          t.uid === editTargetTeacher.uid
            ? { ...t, fullName: editFullName.trim(), school: editSchool.trim(), subject: editSubject.trim() }
            : t
        )
      );
      if (showToast) {
        showToast(`Đã cập nhật thông tin giáo viên: ${editFullName.trim()}`, 'success');
      }
      setEditTargetTeacher(null);
    } catch (e) {
      if (showToast) showToast('Lỗi khi cập nhật thông tin giáo viên.', 'error');
    }
  };

  // Delete Teacher
  const handleConfirmDeleteTeacher = async () => {
    if (!deleteTargetTeacher) return;

    try {
      await deleteTeacherAccount(deleteTargetTeacher.uid);
      setTeachers((prev) => prev.filter((t) => t.uid !== deleteTargetTeacher.uid));
      if (showToast) {
        showToast(`Đã xóa tài khoản giáo viên: ${deleteTargetTeacher.fullName}`, 'info');
      }
      setDeleteTargetTeacher(null);
    } catch (e) {
      if (showToast) showToast('Lỗi khi xóa tài khoản giáo viên.', 'error');
    }
  };

  // Copy teacher login info
  const handleCopyTeacherCredentials = (teacher: AppUser) => {
    const text = `Hệ thống thi EduMath AI\nTài khoản: ${teacher.username}\nMật khẩu mặc định: 123456\nĐăng nhập tại trang web của nhà trường.`;
    navigator.clipboard.writeText(text);
    setCopiedUid(teacher.uid);
    setTimeout(() => setCopiedUid(null), 2500);
    if (showToast) showToast(`Đã sao chép thông tin đăng nhập của ${teacher.fullName}!`);
  };

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.school && t.school.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.subject && t.subject.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterStatus === 'pending') return !t.isApproved;
    if (filterStatus === 'approved') return !!t.isApproved;
    return true;
  });

  const pendingCount = teachers.filter((t) => !t.isApproved).length;
  const approvedCount = teachers.filter((t) => !!t.isApproved).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Quản Trị Hệ Thống (Admin)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                Tổng số: {teachers.length} Giáo viên
              </span>
              {pendingCount > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse flex items-center gap-1 shadow-xs">
                  <Clock className="w-3 h-3" />
                  {pendingCount} Giáo viên đang chờ duyệt
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Tất cả tài khoản đã được kích hoạt
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight flex items-center gap-2">
              <span>Quản Trị Tài Khoản Giáo Viên & Duyệt Đăng Ký</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Quản lý danh sách các thầy cô giáo đăng ký vào hệ thống. Giáo viên đăng ký mới bắt buộc phải được Quản trị viên phê duyệt mới được cấp quyền đăng nhập soạn đề và quản lý học sinh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Thêm Giáo Viên Mới</span>
              <span className="sm:hidden">Thêm</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Filter & Quick Action */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo tên giáo viên, tài khoản, email, trường hoặc bộ môn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tất cả ({teachers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              {pendingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
              <span>Chờ duyệt ({pendingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'approved'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Đã duyệt ({approvedCount})
            </button>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleApproveAllPending}
                disabled={actionLoadingId === 'bulk_approve'}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                title="Phê duyệt cùng lúc toàn bộ giáo viên đang chờ"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Duyệt Tất Cả ({pendingCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTeachers(getRegisteredTeachers())}
              className="p-1.5 bg-white text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-xl cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Teachers Table / List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {filteredTeachers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Users className="w-8 h-8" />
              </div>
              <div className="text-sm font-bold text-slate-700">
                {filterStatus === 'pending'
                  ? 'Hiện không có giáo viên nào đang chờ phê duyệt!'
                  : 'Không tìm thấy tài khoản giáo viên nào theo từ khóa tìm kiếm.'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Khi giáo viên đăng ký từ cổng đăng nhập, danh sách sẽ tự động xuất hiện tại đây để Thầy/Cô duyệt ngay lập tức.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" /> Thêm Giáo Viên Đầu Tiên
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3 text-center w-12 border-r border-slate-800">STT</th>
                    <th className="py-3 px-4 border-r border-slate-800">Họ và Tên Giáo Viên</th>
                    <th className="py-3 px-3 border-r border-slate-800">Tài Khoản / Email</th>
                    <th className="py-3 px-3 border-r border-slate-800">Trường THPT</th>
                    <th className="py-3 px-3 border-r border-slate-800 text-center">Ngày Tạo</th>
                    <th className="py-3 px-3 text-center border-r border-slate-800">Trạng Thái Duyệt</th>
                    <th className="py-3 px-3 text-center w-52">Quản Trị Tài Khoản</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTeachers.map((t, idx) => {
                    const isApproved = !!t.isApproved;
                    const isLoading = actionLoadingId === t.uid;
                    const isCopied = copiedUid === t.uid;

                    return (
                      <tr key={t.uid} className={`transition-colors ${!isApproved ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/80'}`}>
                        <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200">
                          <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{t.fullName}</span>
                            {t.username.toLowerCase() === 'admin' && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                            <BookOpen className="w-3 h-3 text-indigo-500" />
                            <span>Môn: {t.subject || 'Toán THPT'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200">
                          <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{t.username}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyTeacherCredentials(t)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 cursor-pointer"
                              title="Sao chép thông tin đăng nhập"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {t.email && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px] font-medium">
                              {t.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 font-medium text-slate-700">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{t.school || 'Trường THPT'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 text-center text-slate-500 text-[11px]">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3 px-3 text-center border-r border-slate-200">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã Phê Duyệt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600" /> Chờ Phê Duyệt
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Nút Duyệt / Thu hồi */}
                            {isApproved ? (
                              <button
                                type="button"
                                onClick={() => handleToggleApproval(t, false)}
                                disabled={isLoading || t.username.toLowerCase() === 'admin'}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors cursor-pointer border border-rose-200 flex items-center gap-1 disabled:opacity-40"
                                title="Thu hồi quyền đăng nhập của giáo viên"
                              >
                                <UserX className="w-3 h-3" /> Thu hồi
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleApproval(t, true)}
                                disabled={isLoading}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Phê duyệt cho giáo viên truy cập hệ thống"
                              >
                                <UserCheck className="w-3 h-3" /> Phê Duyệt
                              </button>
                            )}

                            {/* Nút Đặt lại mật khẩu */}
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetTeacher(t);
                                setResetPasswordValue('123456');
                              }}
                              className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 transition-colors cursor-pointer"
                              title="Đặt lại mật khẩu cho giáo viên"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Nút Chỉnh sửa */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditTargetTeacher(t);
                                setEditFullName(t.fullName);
                                setEditSchool(t.school || '');
                                setEditSubject(t.subject || 'Toán Học THPT');
                              }}
                              className="p-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 transition-colors cursor-pointer"
                              title="Sửa thông tin giáo viên"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Nút Xóa */}
                            {t.username.toLowerCase() !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetTeacher(t)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                                title="Xóa tài khoản giáo viên"
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
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>EduMath AI • Quản trị viên: <b>Thầy Trịnh Tuấn Kiệt</b></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer"
            >
              + Thêm Giáo Viên
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Đóng Cửa Sổ
            </button>
          </div>
        </div>

      </div>

      {/* MODAL: TẠO TÀI KHOẢN GIÁO VIÊN MỚI TRỰC TIẾP TỪ ADMIN */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-300" />
                <h4 className="font-black text-base">Thêm Tài Khoản Giáo Viên Mới</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Họ và Tên Giáo Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cô Nguyễn Thị Lan"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên Đăng Nhập (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: co_lan hoặc lan.toan"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mật Khẩu Ban Đầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="123456"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Mật khẩu mặc định khuyến nghị: 123456
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Trường THPT Đang Công Tác
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: THPT Chuyên Hùng Vương"
                  value={newSchool}
                  onChange={(e) => setNewSchool(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bộ Môn Giảng Dạy
                </label>
                <input
                  type="text"
                  placeholder="Toán Học THPT"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Tạo & Duyệt Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ĐẶT LẠI MẬT KHẨU CHO GIÁO VIÊN */}
      {resetTargetTeacher && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-900 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">Đặt Lại Mật Khẩu</h4>
                <p className="text-[11px] text-slate-500">{resetTargetTeacher.fullName} ({resetTargetTeacher.username})</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật Khẩu Mới Cấp Cho Giáo Viên:
              </label>
              <input
                type="text"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Sau khi đặt lại, hãy gửi mật khẩu này cho giáo viên để đăng nhập.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetTargetTeacher(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md cursor-pointer"
              >
                Lưu Mật Khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHỈNH SỬA THÔNG TIN GIÁO VIÊN */}
      {editTargetTeacher && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-900 p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h4 className="font-black text-sm">Chỉnh Sửa Thông Tin Giáo Viên</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditTargetTeacher(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Họ và Tên</label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Trường THPT</label>
              <input
                type="text"
                value={editSchool}
                onChange={(e) => setNewSchool(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bộ Môn Giảng Dạy</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditTargetTeacher(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmEditTeacher}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md cursor-pointer"
              >
                Cập Nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA TÀI KHOẢN GIÁO VIÊN */}
      {deleteTargetTeacher && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-900 p-5 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-sm text-slate-900">Xác Nhận Xóa Giáo Viên?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Thầy/Cô có chắc chắn muốn xóa tài khoản <b>{deleteTargetTeacher.fullName}</b> ({deleteTargetTeacher.username}) khỏi hệ thống? Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetTeacher(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer flex-1"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeacher}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md cursor-pointer flex-1"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
