import React, { useState } from 'react';
import {
  X,
  Send,
  Users,
  CheckCircle2,
  Check,
  Building,
  GraduationCap,
  Sparkles,
  Share2,
  FileSpreadsheet,
  AlertCircle,
  Search,
  Filter
} from 'lucide-react';
import { Exam, ClassGroup, StudentRosterItem } from '../types/exam';

interface AssignExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  classes: ClassGroup[];
  roster: StudentRosterItem[];
  onAssignExam: (
    assignedClasses: string[],
    assignedStudentIds: string[],
    note: string,
    options?: {
      variantCount?: number;
      durationMinutes?: number;
      maxAttempts?: number;
    }
  ) => Promise<void> | void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AssignExamModal: React.FC<AssignExamModalProps> = ({
  isOpen,
  onClose,
  exam,
  classes,
  roster,
  onAssignExam,
  showToast,
}) => {
  // Target Selection: 'class' (giao cả lớp), 'students' (giao học sinh cụ thể), 'group' (nhóm học sinh)
  const [assignMode, setAssignMode] = useState<'class' | 'students' | 'group'>('class');

  // Quy định kiểm tra (Bước 1)
  const [variantCount, setVariantCount] = useState<number>(exam?.variantCount || 4);
  const [durationMinutes, setDurationMinutes] = useState<number>(exam?.durationMinutes || 45);
  const [maxAttempts, setMaxAttempts] = useState<number>(exam?.maxAttempts ?? 1); // 1 = 1 lần, 2, 3, 0 = không giới hạn

  // Selected classes
  const [selectedClasses, setSelectedClasses] = useState<string[]>(() => {
    if (exam?.assignedClassNames && exam.assignedClassNames.length > 0) {
      return exam.assignedClassNames;
    }
    return classes.length > 0 ? [classes[0].name] : [];
  });

  // Selected student IDs
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() => {
    return exam?.assignedStudentIds || [];
  });

  // Filter class for student picker
  const [filterClassForStudents, setFilterClassForStudents] = useState<string>(
    classes.length > 0 ? classes[0].name : 'Tất cả'
  );
  const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');
  const [assignmentNote, setAssignmentNote] = useState<string>(exam?.assignedGroupDetails || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!isOpen || !exam) return null;

  // Filtered roster for selection
  const filteredStudents = roster.filter((st) => {
    const matchClass =
      filterClassForStudents === 'Tất cả' ||
      !st.className ||
      st.className.toUpperCase() === filterClassForStudents.toUpperCase();
    const matchSearch =
      st.fullName.toLowerCase().includes(searchStudentTerm.toLowerCase()) ||
      (st.sbd && st.sbd.toLowerCase().includes(searchStudentTerm.toLowerCase())) ||
      (st.className && st.className.toLowerCase().includes(searchStudentTerm.toLowerCase()));
    return matchClass && matchSearch;
  });

  // Toggle class selection
  const toggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  // Toggle student selection
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Select all visible students
  const selectAllVisibleStudents = () => {
    const visibleIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  // Clear student selection
  const clearStudentSelection = () => {
    setSelectedStudentIds([]);
  };

  // Quick preset groups (Top 10, Điểm cao, Cần ôn tập...)
  const selectPresetGroup = (type: 'half_first' | 'half_second' | 'odd' | 'even') => {
    if (filteredStudents.length === 0) return;
    let selected: string[] = [];
    if (type === 'half_first') {
      selected = filteredStudents.slice(0, Math.ceil(filteredStudents.length / 2)).map((s) => s.id);
    } else if (type === 'half_second') {
      selected = filteredStudents.slice(Math.ceil(filteredStudents.length / 2)).map((s) => s.id);
    } else if (type === 'odd') {
      selected = filteredStudents.filter((_, idx) => idx % 2 === 0).map((s) => s.id);
    } else if (type === 'even') {
      selected = filteredStudents.filter((_, idx) => idx % 2 === 1).map((s) => s.id);
    }
    setSelectedStudentIds(selected);
  };

  // Handle Save Assignment
  const handleConfirmAssignment = async () => {
    if (assignMode === 'class' && selectedClasses.length === 0) {
      if (showToast) showToast('Vui lòng chọn ít nhất 1 lớp học để giao đề!', 'error');
      return;
    }

    if ((assignMode === 'students' || assignMode === 'group') && selectedStudentIds.length === 0) {
      if (showToast) showToast('Vui lòng chọn ít nhất 1 học sinh trong danh sách!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetClasses = assignMode === 'class' ? selectedClasses : [];
      const targetStudents = assignMode !== 'class' ? selectedStudentIds : [];
      const note =
        assignmentNote.trim() ||
        (assignMode === 'class'
          ? `Giao cho toàn bộ lớp: ${selectedClasses.join(', ')}`
          : `Giao cho ${selectedStudentIds.length} học sinh cụ thể`);

      await onAssignExam(targetClasses, targetStudents, note, {
        variantCount,
        durationMinutes,
        maxAttempts,
      });

      // Save to localStorage for quick lookup
      try {
        const stored = localStorage.getItem('edumath_assigned_exams') || '{}';
        const parsed = JSON.parse(stored);
        targetClasses.forEach((cls) => {
          parsed[cls] = exam.examCode;
        });
        localStorage.setItem('edumath_assigned_exams', JSON.stringify(parsed));
      } catch {}

      if (showToast) {
        showToast(
          assignMode === 'class'
            ? `Đã giao đề [${exam.examCode}] (${variantCount} mã đề, ${durationMinutes}p, tối đa ${maxAttempts === 0 ? '∞' : maxAttempts} lần làm) cho lớp ${selectedClasses.join(', ')}!`
            : `Đã giao đề [${exam.examCode}] cho ${selectedStudentIds.length} học sinh!`,
          'success'
        );
      }
      onClose();
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi giao đề: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Exam Room Link for assignment
  const getShareableLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const classParam = selectedClasses.length > 0 ? `&class=${encodeURIComponent(selectedClasses[0])}` : '';
    return `${origin}${path}?exam=${encodeURIComponent(exam.examCode)}&examId=${encodeURIComponent(exam.id)}${classParam}`;
  };

  const handleCopyLink = () => {
    const url = getShareableLink();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    if (showToast) showToast(`Đã sao chép link phát đề: ${url}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <Send className="w-3 h-3" /> Phân Phối Đề Thi Sư Phạm
              </span>
              <span className="text-xs text-sky-200 font-mono font-bold">
                MÃ ĐỀ: {exam.examCode}
              </span>
            </div>
            <h3 className="text-xl font-black text-white mt-1">
              Giao Đề Kiểm Tra Cho Lớp Hoặc Nhóm Học Sinh
            </h3>
            <p className="text-xs text-slate-300 mt-1 line-clamp-1">
              Đề thi: <b className="text-white">{exam.title}</b> (Khối {exam.grade} • {exam.durationMinutes} phút)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setAssignMode('class')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                assignMode === 'class'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Giao Cho Cả Lớp ({selectedClasses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAssignMode('students')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                assignMode === 'students'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Giao Cho Từng Học Sinh ({selectedStudentIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAssignMode('group')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                assignMode === 'group'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phân Nhóm Nâng Cao</span>
            </button>
          </div>

          {/* Quick Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Đã chép link!' : 'Chép link phòng thi'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* BƯỚC 1: CẤU HÌNH ĐỀ KIỂM TRA, THỜI GIAN & SỐ LẦN LÀM BÀI */}
          <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-sky-50/60 to-purple-50/50 rounded-2xl border border-indigo-200/80 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Bước 1: Tùy Chọn Cấu Hình Đề Thi & Thời Gian & Số Lần Làm Bài</span>
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                Chuẩn Khảo Thí GDPT 2018
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Số lượng mã đề sinh ra */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 block uppercase tracking-wider">
                  Số mã đề cần sinh ra:
                </label>
                <select
                  value={variantCount}
                  onChange={(e) => setVariantCount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={1}>1 mã đề gốc ({exam.examCode})</option>
                  <option value={4}>4 mã đề hoán vị (101, 102, 103, 104)</option>
                  <option value={8}>8 mã đề hoán vị</option>
                  <option value={24}>24 mã đề chuẩn bộ môn</option>
                  <option value={45}>45 mã đề riêng từng học sinh</option>
                </select>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Tự động xáo trộn câu hỏi & hoán vị phương án chống sao chép bài.
                </p>
              </div>

              {/* 2. Tùy chọn thời gian làm bài */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 block uppercase tracking-wider">
                  Thời gian làm bài:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-2.5 py-1.5 text-xs font-black bg-slate-50 border border-slate-300 rounded-lg text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center"
                  />
                  <span className="text-xs font-bold text-slate-600">phút</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {[15, 45, 90].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDurationMinutes(m)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                          durationMinutes === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {m}p
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Hệ thống đếm ngược và tự động thu bài khi hết giờ.
                </p>
              </div>

              {/* 3. Tùy chọn số lần làm bài */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 block uppercase tracking-wider">
                  Số lần làm bài tối đa:
                </label>
                <select
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={1}>1 lần duy nhất (Thi chính thức)</option>
                  <option value={2}>2 lần (Cho phép sửa sai 1 lần)</option>
                  <option value={3}>3 lần</option>
                  <option value={0}>Không giới hạn (Ôn luyện tự do)</option>
                </select>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {maxAttempts === 1 ? 'Khóa bài thi sau lần nộp đầu tiên.' : `Học sinh có thể làm lại lần 2, lần 3... tính điểm lần mới.`}
                </p>
              </div>
            </div>
          </div>

          {/* HƯỚNG DẪN 2 CÁCH HỌC SINH LÀM BÀI */}
          <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-2">
            <div className="font-black flex items-center gap-1.5 text-blue-900">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>Bước 2: Học Sinh Có 2 Cách Để Vào Làm Bài Thi:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white border border-blue-200 space-y-1">
                <div className="font-bold text-indigo-700">Cách 1: Vào qua Đường Link giáo viên gửi</div>
                <p className="text-slate-600">
                  Học sinh bấm link nhận được, đăng nhập theo username và mật khẩu giáo viên cung cấp để vào ngay phòng thi cá nhân.
                </p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="mt-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
                  <span>{copiedLink ? 'Đã sao chép link!' : 'Sao chép link làm bài'}</span>
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-blue-200 space-y-1">
                <div className="font-bold text-indigo-700">Cách 2: Đăng nhập từ trang chủ</div>
                <p className="text-slate-600">
                  Học sinh truy cập website, chọn <b>Đăng nhập Học sinh</b> để vào trang cá nhân. Tại đây hệ thống sẽ tự động hiển thị bài thi giáo viên đã giao để học sinh bấm vào làm bài.
                </p>
                <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Tự động bảo lưu tiến trình nếu lỡ thoát ra và đăng nhập lại!</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* TAB 1: GIAO CHO CẢ LỚP */}
          {assignMode === 'class' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Chọn các lớp học sinh nhận đề thi này:
                </h4>
                <p className="text-xs text-slate-500">
                  Học sinh thuộc các lớp được chọn khi mở đường link hoặc đăng nhập hệ thống sẽ tự động được gán làm đề này.
                </p>
              </div>

              {classes.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <Building className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">
                    Chưa có lớp học nào trong hệ thống.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Thầy/Cô hãy vào mục "Quản Lý Lớp Học" để tạo lớp và thêm học sinh trước.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {classes.map((cls) => {
                    const isSelected = selectedClasses.includes(cls.name);
                    const studentCount = roster.filter(
                      (r) => r.className?.toUpperCase() === cls.name.toUpperCase()
                    ).length;

                    return (
                      <div
                        key={cls.id || cls.name}
                        onClick={() => toggleClass(cls.name)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-200 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Khối {cls.grade}
                          </span>
                        </div>

                        <div>
                          <h5 className="font-black text-slate-900 text-base">
                            Lớp {cls.name}
                          </h5>
                          <span className="text-xs text-slate-500 font-medium">
                            {studentCount} học sinh
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 & 3: GIAO CHO TỪNG HỌC SINH HOẶC PHÂN NHÓM */}
          {(assignMode === 'students' || assignMode === 'group') && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm tên hoặc SBD..."
                      value={searchStudentTerm}
                      onChange={(e) => setSearchStudentTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  {/* Filter Class */}
                  <select
                    value={filterClassForStudents}
                    onChange={(e) => setFilterClassForStudents(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                  >
                    <option value="Tất cả">Tất cả các lớp</option>
                    {classes.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        Lớp {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllVisibleStudents}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] cursor-pointer"
                  >
                    Chọn tất cả ({filteredStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearStudentSelection}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-[11px] cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Group Preset Toolbar (for Tab 3) */}
              {assignMode === 'group' && (
                <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <span className="font-bold text-indigo-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Chọn nhanh nhóm học sinh:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => selectPresetGroup('half_first')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Nửa đầu danh sách (Nhóm 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetGroup('half_second')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Nửa sau danh sách (Nhóm 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetGroup('odd')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Số thứ tự lẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetGroup('even')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Số thứ tự chẵn
                    </button>
                  </div>
                </div>
              )}

              {/* Student Cards Grid */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Không tìm thấy học sinh nào phù hợp.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">Chọn</th>
                        <th className="py-2.5 px-3 w-16 text-center">STT</th>
                        <th className="py-2.5 px-3 w-28 text-center">SBD</th>
                        <th className="py-2.5 px-4">Họ và tên thí sinh</th>
                        <th className="py-2.5 px-3 text-center">Lớp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredStudents.map((st, idx) => {
                        const isSelected = selectedStudentIds.includes(st.id);
                        return (
                          <tr
                            key={st.id}
                            onClick={() => toggleStudent(st.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/70 font-bold text-indigo-950' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudent(st.id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500">
                              {st.stt || idx + 1}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                              {st.sbd}
                            </td>
                            <td className="py-2 px-4 text-slate-900">
                              {st.fullName}
                            </td>
                            <td className="py-2 px-3 text-center font-semibold text-indigo-700">
                              {st.className}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Note & Description Input */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Ghi chú sư phạm hoặc dặn dò làm bài (Tùy chọn):
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Kiểm tra 1 tiết chương 1 - Học sinh tự giác làm bài, thời gian 45 phút"
              value={assignmentNote}
              onChange={(e) => setAssignmentNote(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-semibold text-slate-600">
            {assignMode === 'class' ? (
              <span>Đang chọn: <b className="text-indigo-700">{selectedClasses.length} lớp</b></span>
            ) : (
              <span>Đang chọn: <b className="text-indigo-700">{selectedStudentIds.length} học sinh</b></span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleConfirmAssignment}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang Lưu...' : 'Xác Nhận Giao Đề'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
