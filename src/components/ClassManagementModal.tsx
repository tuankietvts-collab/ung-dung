import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Users,
  Building,
  Upload,
  FileSpreadsheet,
  Trash2,
  Check,
  Share2,
  Copy,
  Download,
  Search,
  Sparkles,
  GraduationCap,
  Calendar,
  AlertCircle,
  FileDown,
  Loader2,
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { ClassGroup, StudentRosterItem, Exam } from '../types/exam';

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassGroup[];
  roster: StudentRosterItem[];
  currentExam?: Exam | null;
  onSaveClass: (cls: ClassGroup) => Promise<void>;
  onDeleteClass: (classId: string) => Promise<void>;
  onSaveRoster: (students: StudentRosterItem[]) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen,
  onClose,
  classes,
  roster,
  currentExam,
  onSaveClass,
  onDeleteClass,
  onSaveRoster,
  onDeleteStudent,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'quick_paste'>('classes');
  
  // Create class form state
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassGrade, setNewClassGrade] = useState<string>('12');
  const [newSchoolYear, setNewSchoolYear] = useState<string>('2024 - 2025');
  const [isSubmittingClass, setIsSubmittingClass] = useState<boolean>(false);

  // Selected class for student management
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes.length > 0 ? classes[0].name : '12A1'
  );

  // Search & Filter students
  const [searchStudent, setSearchStudent] = useState<string>('');

  // Quick Paste state
  const [pastedText, setPastedText] = useState<string>('');
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);

  // Link copy state
  const [copiedLinkClass, setCopiedLinkClass] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle creating a new class
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newClassName.trim().toUpperCase();
    if (!cleanName) {
      if (showToast) showToast('Vui lòng nhập tên lớp (Ví dụ: 10A1, 12A8)', 'error');
      return;
    }

    setIsSubmittingClass(true);
    try {
      const newClass: ClassGroup = {
        id: cleanName,
        name: cleanName,
        grade: newClassGrade,
        schoolYear: newSchoolYear.trim() || '2024 - 2025',
        createdAt: new Date().toISOString(),
      };
      await onSaveClass(newClass);
      setSelectedClassId(cleanName);
      setNewClassName('');
      if (showToast) showToast(`Đã tạo thành công lớp ${cleanName}!`);
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi tạo lớp: ' + err.message, 'error');
    } finally {
      setIsSubmittingClass(false);
    }
  };

  // Get students of the selected class
  const currentClassStudents = roster.filter(
    (s) => s.className?.toUpperCase() === selectedClassId.toUpperCase()
  );

  const filteredStudents = currentClassStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.sbd.toLowerCase().includes(searchStudent.toLowerCase())
  );

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const header = ['STT', 'Họ và tên', 'Lớp', 'Mã định danh/SBD'];
    const sampleRows = [
      [1, 'Nguyễn Văn An', selectedClassId || '10A1', `${selectedClassId || '10A1'}-01`],
      [2, 'Trần Thị Mai', selectedClassId || '10A1', `${selectedClassId || '10A1'}-02`],
      [3, 'Lê Hoàng Nam', selectedClassId || '10A1', `${selectedClassId || '10A1'}-03`],
      [4, 'Đỗ Thùy Linh', selectedClassId || '10A1', `${selectedClassId || '10A1'}-04`],
      [5, 'Phạm Quốc Bảo', selectedClassId || '10A1', `${selectedClassId || '10A1'}-05`],
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...sampleRows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `DS_${selectedClassId || 'Lop'}`);
    XLSX.writeFile(wb, `Mau_DanhSach_HocSinh_${selectedClassId || 'EduMath'}.xlsx`);
  };

  // Parse Excel or CSV File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (!rawRows || rawRows.length < 2) {
        throw new Error('File không có đủ dữ liệu học sinh.');
      }

      // Auto-detect columns
      let headerRowIndex = 0;
      let colIdxStt = -1;
      let colIdxName = -1;
      let colIdxClass = -1;
      let colIdxSbd = -1;

      for (let r = 0; r < Math.min(10, rawRows.length); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim().toLowerCase();
          if (val === 'stt' || val === 'no' || val.includes('thứ tự')) colIdxStt = c;
          if (val.includes('họ') || val.includes('tên') || val.includes('name')) colIdxName = c;
          if (val.includes('lớp') || val.includes('class')) colIdxClass = c;
          if (val.includes('sbd') || val.includes('mã') || val.includes('định danh') || val.includes('id')) colIdxSbd = c;
        }
        if (colIdxName !== -1) {
          headerRowIndex = r;
          break;
        }
      }

      if (colIdxName === -1) colIdxName = 1;
      if (colIdxStt === -1) colIdxStt = 0;
      if (colIdxClass === -1) colIdxClass = 2;
      if (colIdxSbd === -1) colIdxSbd = 3;

      const parsedStudents: StudentRosterItem[] = [];

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const nameVal = String(row[colIdxName] || '').trim();
        if (!nameVal || nameVal.toLowerCase().includes('họ và tên') || nameVal.length < 2) continue;

        const sttVal = parseInt(String(row[colIdxStt] || '0'), 10) || parsedStudents.length + 1;
        const classVal = (String(row[colIdxClass] || selectedClassId || '10A1')).trim().toUpperCase();
        const sbdVal = String(row[colIdxSbd] || `${classVal}-${String(sttVal).padStart(2, '0')}`).trim();
        const safeId = `${classVal}_${sbdVal}`.replace(/[\/\s#?]/g, '_');

        parsedStudents.push({
          id: safeId,
          stt: sttVal,
          fullName: nameVal,
          className: classVal,
          sbd: sbdVal,
          createdAt: new Date().toISOString(),
        });
      }

      if (parsedStudents.length === 0) {
        throw new Error('Không nhận diện được học sinh nào từ file.');
      }

      await onSaveRoster(parsedStudents);
      if (showToast) {
        showToast(`Đã tải thành công ${parsedStudents.length} học sinh vào lớp ${selectedClassId}!`);
      }
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi tải file: ' + err.message, 'error');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Quick Paste parsing
  const handleParseQuickPaste = async () => {
    if (!pastedText.trim()) {
      if (showToast) showToast('Vui lòng dán danh sách học sinh vào ô văn bản.', 'error');
      return;
    }

    const lines = pastedText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedStudents: StudentRosterItem[] = [];

    lines.forEach((line, idx) => {
      // Possible formats:
      // "1. Nguyễn Văn An - 10A1-01"
      // "1 | Nguyễn Văn An | 10A1-01"
      // "1	Nguyễn Văn An	10A1-01"
      // "Nguyễn Văn An"
      let name = line;
      let sbd = `${selectedClassId}-${String(idx + 1).padStart(2, '0')}`;
      let stt = idx + 1;

      if (line.includes('\t') || line.includes('|') || line.includes(';')) {
        const parts = line.split(/[\t|;]+/).map((p) => p.trim());
        if (parts.length >= 2) {
          const firstIsNumber = /^\d+$/.test(parts[0]);
          if (firstIsNumber) {
            stt = parseInt(parts[0], 10);
            name = parts[1];
            if (parts[2]) sbd = parts[2];
          } else {
            name = parts[0];
            sbd = parts[1];
          }
        }
      } else {
        // Strip leading number like "1. " or "01 - "
        const numMatch = line.match(/^(\d+)[\.\-\s]+(.+)$/);
        if (numMatch) {
          stt = parseInt(numMatch[1], 10);
          name = numMatch[2].trim();
        }
      }

      if (name && name.length >= 2) {
        parsedStudents.push({
          id: `${selectedClassId}_${sbd}`.replace(/[\/\s#?]/g, '_'),
          stt,
          fullName: name,
          className: selectedClassId,
          sbd,
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (parsedStudents.length === 0) {
      if (showToast) showToast('Không tìm thấy học sinh hợp lệ.', 'error');
      return;
    }

    try {
      await onSaveRoster(parsedStudents);
      setPastedText('');
      setActiveTab('students');
      if (showToast) {
        showToast(`Đã thêm nhanh ${parsedStudents.length} học sinh vào lớp ${selectedClassId}!`);
      }
    } catch (err: any) {
      if (showToast) showToast('Lỗi lưu danh sách: ' + err.message, 'error');
    }
  };

  // Generate class direct exam link
  const getClassExamLink = (clsName: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const code = currentExam?.examCode || 'TOAN12-GDPT';
    const id = currentExam?.id || '';
    return `${origin}${path}?exam=${encodeURIComponent(code)}&examId=${encodeURIComponent(id)}&class=${encodeURIComponent(clsName)}`;
  };

  const handleCopyClassLink = (clsName: string) => {
    const link = getClassExamLink(clsName);
    navigator.clipboard.writeText(link);
    setCopiedLinkClass(clsName);
    setTimeout(() => setCopiedLinkClass(null), 3000);
    if (showToast) {
      showToast(`Đã sao chép link phát đề gắn lớp ${clsName}! Học sinh mở link sẽ tự động gợi ý danh sách lớp.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  Phân Hệ Quản Lý Giáo Viên
                </span>
                <span className="text-xs text-indigo-300 font-mono font-bold">
                  {classes.length} Lớp • {roster.length} Học sinh
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                Quản Lý Lớp Học & Danh Sách Học Sinh
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 pt-3 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'classes'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>1. Danh Sách Lớp ({classes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'students'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>2. Danh Sách Học Sinh ({currentClassStudents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quick_paste')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'quick_paste'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>3. Dán Nhanh Danh Sách</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* TAB 1: DANH SÁCH LỚP HỌC & FORM TẠO LỚP */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              {/* Form Tạo Lớp Mới */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" /> Tạo Lớp Học Mới
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Ví dụ: 10A1, 10A2, 11B1, 12A8
                  </span>
                </div>

                <form onSubmit={handleCreateClass} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Tên Lớp <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="10A1, 12A8..."
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Khối Lớp
                    </label>
                    <select
                      value={newClassGrade}
                      onChange={(e) => setNewClassGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    >
                      <option value="10">Khối 10 (Toán 10)</option>
                      <option value="11">Khối 11 (Toán 11)</option>
                      <option value="12">Khối 12 (Toán 12)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Năm Học
                    </label>
                    <input
                      type="text"
                      placeholder="2024 - 2025"
                      value={newSchoolYear}
                      onChange={(e) => setNewSchoolYear(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isSubmittingClass || !newClassName.trim()}
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingClass ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Lưu Lớp Mới</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Bảng Danh Sách Lớp Hiện Có */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" /> Các Lớp Đang Quản Lý ({classes.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Bấm "Gửi Link Đề" để sao chép link thi tự động gắn với lớp đó
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {classes.map((cls) => {
                    const count = roster.filter(
                      (r) => r.className?.toUpperCase() === cls.name.toUpperCase()
                    ).length;
                    const isSelected = selectedClassId === cls.name;

                    return (
                      <div
                        key={cls.id || cls.name}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-300 shadow-xs ring-1 ring-indigo-400'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-slate-900 tracking-tight">
                                Lớp {cls.name}
                              </span>
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-md border border-indigo-200">
                                Khối {cls.grade}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Năm học: <b className="text-slate-700">{cls.schoolYear || '2024 - 2025'}</b> • Sĩ số: <b className="text-emerald-700">{count} học sinh</b>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassId(cls.name);
                                setActiveTab('students');
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Xem và quản lý danh sách học sinh lớp này"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>DS Học Sinh</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Thầy/Cô có chắc chắn muốn xóa lớp ${cls.name}? Danh sách học sinh của lớp cũng sẽ bị gỡ bỏ.`)) {
                                  onDeleteClass(cls.id || cls.name);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa lớp học"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Direct share link button with class param */}
                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                            ?exam={currentExam?.examCode || 'TOAN12'}&class={cls.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyClassLink(cls.name)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            {copiedLinkClass === cls.name ? (
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedLinkClass === cls.name ? 'Đã sao chép!' : 'Sao chép link thi'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ DANH SÁCH HỌC SINH CỦA TỪNG LỚP */}
          {activeTab === 'students' && (
            <div className="space-y-5">
              {/* Select class and action bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700 uppercase">
                    Đang Chọn Lớp:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id || cls.name} value={cls.name}>
                        Lớp {cls.name} (Khối {cls.grade})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500 font-semibold">
                    ({currentClassStudents.length} học sinh)
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {/* Nút Tải File Excel / CSV */}
                  <button
                    type="button"
                    disabled={isParsingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isParsingFile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>Tải File Excel / CSV</span>
                  </button>

                  {/* Tải Mẫu Excel */}
                  <button
                    type="button"
                    onClick={handleDownloadSampleExcel}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Tải file mẫu Excel chuẩn [STT, Họ và tên, Lớp, SBD]"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Tải Mẫu Excel</span>
                  </button>

                  {/* Sao chép link thi theo lớp */}
                  <button
                    type="button"
                    onClick={() => handleCopyClassLink(selectedClassId)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLinkClass === selectedClassId ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    <span>Link Thi Lớp {selectedClassId}</span>
                  </button>
                </div>
              </div>

              {/* Search in student list */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-full max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={`Tìm học sinh lớp ${selectedClassId}...`}
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Hiển thị: <b>{filteredStudents.length}</b> / {currentClassStudents.length} học sinh
                </span>
              </div>

              {/* Table of students */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800 text-white font-black">
                    <tr>
                      <th className="p-3 text-center w-14">STT</th>
                      <th className="p-3">HỌ VÀ TÊN HỌC SINH</th>
                      <th className="p-3 text-center w-24">LỚP</th>
                      <th className="p-3 text-center w-36">SBD / MÃ ĐỊNH DANH</th>
                      <th className="p-3 text-center w-20">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 bg-slate-50/50">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                            <Users className="w-8 h-8 text-slate-400" />
                            <span className="font-bold text-slate-700 text-sm">
                              Chưa có học sinh nào trong lớp {selectedClassId}
                            </span>
                            <span className="text-xs text-slate-400">
                              Thầy/Cô hãy bấm <b>"Tải File Excel / CSV"</b> hoặc chuyển sang tab <b>"Dán Nhanh Danh Sách"</b> để nhập danh sách lớp.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st, idx) => (
                        <tr key={st.id || idx} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="p-3 text-center font-bold font-mono text-slate-600">
                            {st.stt || idx + 1}
                          </td>
                          <td className="p-3 font-extrabold text-slate-900 text-sm">
                            {st.fullName}
                          </td>
                          <td className="p-3 text-center font-black text-indigo-700">
                            {st.className}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700">
                            {st.sbd || `${st.className}-${st.stt}`}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Xóa học sinh ${st.fullName} khỏi danh sách?`)) {
                                  onDeleteStudent(st.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa học sinh"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DÁN NHANH DANH SÁCH HỌC SINH */}
          {activeTab === 'quick_paste' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
                <div className="font-black text-sm flex items-center gap-1.5 text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Dán Nhanh Danh Sách Học Sinh Cho Lớp: <b>{selectedClassId}</b>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Thầy/Cô chỉ cần copy danh sách từ Word, Excel hoặc Zalo và dán vào ô bên dưới.
                  Hệ thống tự động nhận diện STT, Họ và tên và cấp SBD theo định dạng <code>{selectedClassId}-01</code>, <code>{selectedClassId}-02</code>...
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nhập/Dán Danh Sách Học Sinh (Mỗi học sinh 1 dòng):
                </label>
                <textarea
                  rows={9}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`1. Nguyễn Văn An
2. Trần Thị Mai
3. Lê Hoàng Nam
4. Đỗ Thùy Linh
5. Phạm Quốc Bảo`}
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {pastedText.split('\n').filter((l) => l.trim()).length} dòng đã nhập
                </span>

                <button
                  type="button"
                  onClick={handleParseQuickPaste}
                  disabled={!pastedText.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Xác Nhận & Lưu Vào Lớp {selectedClassId}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>EduMath AI • Nền Tảng Khảo Thí & Phân Hệ Sư Phạm GDPT 2018</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Đóng Cửa Sổ
          </button>
        </div>

      </div>
    </div>
  );
};
