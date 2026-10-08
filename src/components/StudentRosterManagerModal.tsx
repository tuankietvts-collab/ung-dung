import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Download,
  Users,
  Search,
  Check,
  Loader2,
  FileDown,
  Sparkles,
  Cloud
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { StudentRosterItem } from '../types/exam';
import { saveStudentRosterToFirestore, deleteStudentFromFirestore } from '../services/firebase';
import { parseStudentRosterFromWorkbook, isInvalidStudentName } from '../services/studentRosterParser';

interface StudentRosterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoster: StudentRosterItem[];
  onRosterUpdated: (newRoster: StudentRosterItem[]) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StudentRosterManagerModal: React.FC<StudentRosterManagerModalProps> = ({
  isOpen,
  onClose,
  currentRoster,
  onRosterUpdated,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewList, setPreviewList] = useState<StudentRosterItem[] | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [studentToDelete, setStudentToDelete] = useState<StudentRosterItem | null>(null);

  if (!isOpen) return null;

  // Classes list
  const classes = Array.from(new Set(currentRoster.map((s) => s.className).filter(Boolean)));

  // Filter roster
  const displayedStudents = currentRoster.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sbd.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.className.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.className === selectedClass;
    return matchesSearch && matchesClass;
  });

  // 1. Download Sample Excel Template (Supports both vnEdu 2-column format & 1-column format)
  const handleDownloadSampleTemplate = () => {
    // Sheet 1: vnEdu Format (2 separate columns: Họ và chữ lót + Tên)
    const headerVnEdu = ['STT', 'Mã học sinh', 'Họ và chữ lót', 'Tên', 'Lớp', 'Ngày sinh', 'Giới tính'];
    const sampleVnEduRows = [
      [1, '23000101', 'Nguyễn Văn', 'An', '12A1', '15/04/2007', 'Nam'],
      [2, '23000102', 'Thái Thị Tuyết', 'Hồng', '12A1', '20/08/2007', 'Nữ'],
      [3, '23000103', 'Trần Bảo', 'Nam', '12A1', '01/01/2007', 'Nam'],
      [4, '23000104', 'Đỗ Thùy', 'Linh', '12A1', '12/11/2007', 'Nữ'],
      [5, '23000105', 'Lê Quốc', 'Bảo', '12A1', '05/03/2007', 'Nam'],
    ];
    const wsVnEdu = XLSX.utils.aoa_to_sheet([headerVnEdu, ...sampleVnEduRows]);
    wsVnEdu['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];

    // Sheet 2: Standard 1-column format
    const headerStandard = ['STT', 'Họ và tên', 'Lớp', 'Mã định danh/SBD'];
    const sampleStandardRows = [
      [1, 'Nguyễn Văn An', '12A1', '12A1-01'],
      [2, 'Thái Thị Tuyết Hồng', '12A1', '12A1-02'],
      [3, 'Trần Bảo Nam', '12A1', '12A1-03'],
      [4, 'Đỗ Thùy Linh', '12A1', '12A1-04'],
      [5, 'Lê Quốc Bảo', '12A1', '12A1-05'],
    ];
    const wsStandard = XLSX.utils.aoa_to_sheet([headerStandard, ...sampleStandardRows]);
    wsStandard['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsVnEdu, 'DinhDang_vnEdu_TachCot');
    XLSX.utils.book_append_sheet(wb, wsStandard, 'DinhDang_Chuan_1Cot');
    XLSX.writeFile(wb, 'Mau_DanhSach_HocSinh_vnEdu_EduMath.xlsx');
  };

  // 2. Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const result = parseStudentRosterFromWorkbook(wb, selectedClass === 'all' ? '12A1' : selectedClass);

      const validStudents = result.students.filter((s) => !isInvalidStudentName(s.fullName));

      if (validStudents.length === 0) {
        throw new Error('Không đọc được học sinh hợp lệ nào từ file. Vui lòng kiểm tra định dạng file.');
      }

      setPreviewList(validStudents);
      setImportSummary(`Đã nhận diện chuẩn ${validStudents.length} học sinh từ file "${file.name}"! ${result.formatNote ? `[${result.formatNote}]` : ''}. Bấm "Xác nhận nạp vào Firestore" để hoàn tất.`);
    } catch (err: any) {
      console.error('Import excel error:', err);
      if (showToast) showToast(err.message || 'Lỗi đọc file Excel.', 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Confirm and Save to Cloud Firestore
  const handleConfirmSaveToFirestore = async () => {
    if (!previewList || previewList.length === 0) return;
    setIsProcessing(true);
    try {
      await saveStudentRosterToFirestore(previewList);
      onRosterUpdated(previewList);
      if (showToast) {
        showToast(`Đã nạp thành công ${previewList.length} học sinh vào Cloud Firestore!`);
      }
      setPreviewList(null);
      setImportSummary(null);
    } catch (err: any) {
      if (showToast) showToast('Lỗi lưu vào Firestore: ' + (err.message || String(err)), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Delete Single Student
  const handleDeleteStudent = (student: StudentRosterItem) => {
    setStudentToDelete(student);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      await deleteStudentFromFirestore(studentToDelete.id);
      const updated = currentRoster.filter((s) => s.id !== studentToDelete.id);
      onRosterUpdated(updated);
      if (showToast) showToast(`Đã xóa học sinh ${studentToDelete.fullName}.`);
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi xóa học sinh: ' + err.message, 'error');
    } finally {
      setStudentToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  Quản Lý Danh Sách Học Sinh & Nạp Từ Excel
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Cloud className="w-3 h-3" /> Firestore Cloud
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nạp danh sách học sinh gồm các cột: <b>[STT, Họ và tên, Lớp, SBD]</b> để học sinh vào thi và quản lý điểm.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Actions: File Upload & Sample Download */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 my-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Chọn file Excel (.xlsx / .csv)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>Tải file Excel mẫu chuẩn</span>
            </button>
          </div>

          <div className="text-xs font-bold text-slate-600">
            Tổng cộng: <b className="text-indigo-700">{currentRoster.length}</b> học sinh trong CSDL
          </div>
        </div>

        {/* Import Preview Banner */}
        {previewList && (
          <div className="p-4 mb-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 text-emerald-950 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{importSummary}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewList(null)}
                className="px-3 py-1.5 bg-white text-slate-700 font-bold rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveToFirestore}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Xác nhận nạp vào Firestore</span>
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên học sinh, số báo danh, lớp..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {classes.length > 0 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả lớp ({currentRoster.length})</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  Lớp {c} ({currentRoster.filter((s) => s.className === c).length})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Roster Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
          {displayedStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">
                {currentRoster.length === 0
                  ? 'Chưa có danh sách học sinh nào trong cơ sở dữ liệu.'
                  : 'Không tìm thấy học sinh nào phù hợp.'}
              </p>
              <p className="text-[11px] text-slate-400">
                Bấm nút "Chọn file Excel (.xlsx / .csv)" ở trên để nạp danh sách học sinh từ sổ điểm.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-14 text-center">STT</th>
                  <th className="py-2.5 px-3">Họ và Tên</th>
                  <th className="py-2.5 px-3 w-28">Lớp</th>
                  <th className="py-2.5 px-3 w-32">Số Báo Danh</th>
                  <th className="py-2.5 px-3 w-20 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {displayedStudents.map((st, idx) => (
                  <tr key={st.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                      {st.stt || idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {st.fullName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                        {st.className}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                      {st.sbd}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(st)}
                        title="Xóa học sinh này"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            💡 Sau khi nạp danh sách, học sinh truy cập link thi có thể chọn nhanh tên mình để tự động điền Lớp và SBD.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Confirmation Modal Xóa Học Sinh (Zero confirm/alert) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-base font-black text-slate-900">
                Xác Nhận Xóa Học Sinh
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Thầy/Cô có chắc chắn muốn xóa học sinh <b className="text-slate-900">{studentToDelete.fullName}</b> (SBD: <span className="font-mono text-indigo-700">{studentToDelete.sbd}</span>, Lớp {studentToDelete.className}) khỏi danh sách?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Đồng Ý Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
