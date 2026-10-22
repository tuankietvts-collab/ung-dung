import React, { useState, useRef, useEffect } from 'react';
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
  Edit3,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  FileCheck,
  Send
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { ClassGroup, StudentRosterItem, Exam } from '../types/exam';
import { generateStudentAccountsForClass } from '../services/firebase';
import {
  parseStudentRosterFromWorkbook,
  parseQuickPasteText,
  normalizeVietnameseName,
  isInvalidStudentName
} from '../services/studentRosterParser';
import {
  encodeSchoolName,
  encodeSubjectName,
  encodeSchoolYear,
  generateClassId,
  generateStudentDocId,
  generateStudentUsername,
} from '../services/schoolEncoder';

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassGroup[];
  roster: StudentRosterItem[];
  currentExam?: Exam | null;
  savedExams?: Exam[];
  initialClassId?: string;
  initialTab?: 'classes' | 'students' | 'quick_paste' | 'accounts' | 'assign_exam';
  onSaveClass: (cls: ClassGroup) => Promise<void>;
  onDeleteClass: (classId: string) => Promise<void>;
  onSaveRoster: (students: StudentRosterItem[]) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  teacherId?: string;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen,
  onClose,
  classes,
  roster,
  currentExam,
  savedExams = [],
  initialClassId,
  initialTab,
  onSaveClass,
  onDeleteClass,
  onSaveRoster,
  onDeleteStudent,
  showToast,
  teacherId,
}) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'quick_paste' | 'accounts' | 'assign_exam'>('classes');
  
  // Create class form state with natural language inputs
  const [newSchoolFullName, setNewSchoolFullName] = useState<string>('THPT Võ Thị Sáu');
  const [newSubjectFullName, setNewSubjectFullName] = useState<string>('Toán');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassGrade, setNewClassGrade] = useState<string>('12');
  const [newSchoolYear, setNewSchoolYear] = useState<string>('2026-2027');
  const [isSubmittingClass, setIsSubmittingClass] = useState<boolean>(false);

  // Deduplicate classes strictly by normalized name and ID
  const uniqueClasses = React.useMemo(() => {
    const seen = new Set<string>();
    return classes.filter((c) => {
      const norm = (c.name || '').trim().toUpperCase().replace(/^LỚP\s+/i, '');
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [classes]);

  // Selected class for student management
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClassId || (uniqueClasses.length > 0 ? uniqueClasses[0].name : '12A8')
  );

  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
    }
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialClassId, initialTab, isOpen]);

  // Student accounts generation state
  const [defaultPassword, setDefaultPassword] = useState<string>('123456');
  const [isGeneratingAccounts, setIsGeneratingAccounts] = useState<boolean>(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedAccountUser, setCopiedAccountUser] = useState<string | null>(null);
  const [copiedZaloList, setCopiedZaloList] = useState<boolean>(false);

  // Assigned Exam State (Lớp nào được giao đề nào)
  const [assignedExamMap, setAssignedExamMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('edumath_assigned_exams');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Search & Filter students
  const [searchStudent, setSearchStudent] = useState<string>('');

  // Quick Paste state
  const [pastedText, setPastedText] = useState<string>('');
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);

  // Link copy state
  const [copiedLinkClass, setCopiedLinkClass] = useState<string | null>(null);

  // Confirmation Modals State (Zero window.confirm calls)
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentRosterItem | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState<boolean>(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState<boolean>(false);

  // Edit student state
  const [editingStudent, setEditingStudent] = useState<StudentRosterItem | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editSbd, setEditSbd] = useState<string>('');
  const [editStt, setEditStt] = useState<number>(1);
  const [isSavingStudent, setIsSavingStudent] = useState<boolean>(false);

  // Quick single student add state
  const [singleFullName, setSingleFullName] = useState<string>('');
  const [singleSbd, setSingleSbd] = useState<string>('');
  const [isAddingSingleStudent, setIsAddingSingleStudent] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle creating a new class with automatic encoding formula
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newClassName.trim().toUpperCase().replace(/^LỚP\s+/i, '');
    if (!cleanName) {
      if (showToast) showToast('Vui lòng nhập tên lớp (Ví dụ: 12A8, 11A1)', 'error');
      return;
    }

    const schoolFullName = newSchoolFullName.trim() || 'THPT Võ Thị Sáu';
    const subjectFullName = newSubjectFullName.trim() || 'Toán';
    const schoolYear = newSchoolYear.trim() || '2026-2027';
    const schoolCode = encodeSchoolName(schoolFullName);
    const subjectCode = encodeSubjectName(subjectFullName);
    const yearCode = encodeSchoolYear(schoolYear);
    // Formula: [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP] (Ví dụ: "VTS_TO_26_12A8")
    const classId = generateClassId(schoolFullName, subjectFullName, schoolYear, cleanName);

    const isExisted = uniqueClasses.some((c) => {
      const cNorm = (c.name || '').trim().toUpperCase().replace(/^LỚP\s+/i, '');
      return c.id === classId || cNorm === cleanName;
    });
    if (isExisted) {
      if (showToast) showToast(`Lớp ${cleanName} (${classId}) đã tồn tại trong danh sách!`, 'info');
      setSelectedClassId(cleanName);
      setNewClassName('');
      return;
    }

    setIsSubmittingClass(true);
    try {
      const newClass: ClassGroup = {
        id: classId,
        name: cleanName,
        grade: newClassGrade,
        schoolYear,
        schoolFullName,
        schoolCode,
        subjectFullName,
        subjectCode,
        yearCode,
        teacherId: teacherId || undefined,
        createdAt: new Date().toISOString(),
      };
      await onSaveClass(newClass);
      setSelectedClassId(cleanName);
      setNewClassName('');
      if (showToast) showToast(`Đã tạo thành công lớp ${cleanName} (Mã Document: ${classId})!`);
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi tạo lớp: ' + err.message, 'error');
    } finally {
      setIsSubmittingClass(false);
    }
  };

  // Get students of the selected class (Strictly filters out summary / footer rows like Khối 11, Thống kê)
  const normalizeCls = (c?: string) => (c || '').trim().toUpperCase().replace(/^LỚP\s+/i, '');
  const currentClassStudents = roster
    .filter((s) => !isInvalidStudentName(s.fullName))
    .filter((s) => normalizeCls(s.className) === normalizeCls(selectedClassId));

  const filteredStudents = currentClassStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.sbd.toLowerCase().includes(searchStudent.toLowerCase())
  );

  // Download Sample Excel Template (Supports both vnEdu 2-column format & 1-column standard format)
  const handleDownloadSampleExcel = () => {
    // Sheet 1: vnEdu 2-column format (Họ và chữ lót + Tên riêng biệt chuẩn vnEdu)
    const headerVnEdu = ['STT', 'Mã học sinh', 'Họ và chữ lót', 'Tên', 'Lớp', 'Ngày sinh', 'Giới tính'];
    const sampleVnEduRows = [
      [1, '23000101', 'Nguyễn Văn', 'An', selectedClassId || '11A1', '15/04/2007', 'Nam'],
      [2, '23000102', 'Thái Thị Tuyết', 'Hồng', selectedClassId || '11A1', '20/08/2007', 'Nữ'],
      [3, '23000103', 'Trần Bảo', 'Nam', selectedClassId || '11A1', '01/01/2007', 'Nam'],
      [4, '23000104', 'Đỗ Thùy', 'Linh', selectedClassId || '11A1', '12/11/2007', 'Nữ'],
      [5, '23000105', 'Lê Quốc', 'Bảo', selectedClassId || '11A1', '05/03/2007', 'Nam'],
    ];
    const wsVnEdu = XLSX.utils.aoa_to_sheet([headerVnEdu, ...sampleVnEduRows]);
    wsVnEdu['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];

    // Sheet 2: 1-column standard format
    const headerStandard = ['STT', 'Họ và tên', 'Lớp', 'Mã định danh/SBD'];
    const sampleStandardRows = [
      [1, 'Nguyễn Văn An', selectedClassId || '11A1', `${selectedClassId || '11A1'}-01`],
      [2, 'Thái Thị Tuyết Hồng', selectedClassId || '11A1', `${selectedClassId || '11A1'}-02`],
      [3, 'Trần Bảo Nam', selectedClassId || '11A1', `${selectedClassId || '11A1'}-03`],
      [4, 'Đỗ Thùy Linh', selectedClassId || '11A1', `${selectedClassId || '11A1'}-04`],
      [5, 'Lê Quốc Bảo', selectedClassId || '11A1', `${selectedClassId || '11A1'}-05`],
    ];
    const wsStandard = XLSX.utils.aoa_to_sheet([headerStandard, ...sampleStandardRows]);
    wsStandard['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsVnEdu, `vnEdu_TachCot_Lop_${selectedClassId || '11A1'}`);
    XLSX.utils.book_append_sheet(wb, wsStandard, `Chuan_1Cot_Lop_${selectedClassId || '11A1'}`);
    XLSX.writeFile(wb, `Mau_DanhSach_HocSinh_vnEdu_${selectedClassId || 'EduMath'}.xlsx`);
  };

  // Parse Excel or CSV File (Fully supports vnEdu 2 columns: Họ và chữ lót + Tên, SMAS, CSDL Ngành)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const result = parseStudentRosterFromWorkbook(wb, selectedClassId);
      const validStudents = result.students.filter((s) => !isInvalidStudentName(s.fullName));
      if (validStudents.length === 0) {
        throw new Error('Không nhận diện được học sinh hợp lệ nào từ file.');
      }

      const selectedClassObj = classes.find(
        (c) => c.name.toUpperCase() === selectedClassId.toUpperCase() || c.id === selectedClassId
      );
      const schoolName = selectedClassObj?.schoolFullName || 'THPT Võ Thị Sáu';
      const subjectName = selectedClassObj?.subjectFullName || 'Toán';
      const schoolYear = selectedClassObj?.schoolYear || '2026-2027';
      const classId = selectedClassObj?.id || generateClassId(schoolName, subjectName, schoolYear, selectedClassId);

      const enrichedStudents: StudentRosterItem[] = validStudents.map((st, idx) => {
        const stt = st.stt || idx + 1;
        const username = generateStudentUsername(selectedClassId, stt);
        const docId = generateStudentDocId(classId, stt);
        return {
          ...st,
          stt,
          className: selectedClassId,
          classId,
          schoolFullName: schoolName,
          schoolCode: encodeSchoolName(schoolName),
          subjectFullName: subjectName,
          subjectCode: encodeSubjectName(subjectName),
          yearCode: encodeSchoolYear(schoolYear),
          username,
          password: defaultPassword || '123456',
          isAccountCreated: true,
          id: docId,
        };
      });

      await onSaveRoster(enrichedStudents);
      if (showToast) {
        showToast(
          `Đã tải & cấp tài khoản cho ${enrichedStudents.length} học sinh lớp ${selectedClassId}! ${result.formatNote ? `[${result.formatNote}]` : ''}`,
          'success'
        );
      }
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi đọc file danh sách: ' + err.message, 'error');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Quick Paste parsing (Intelligently detects tab-separated vnEdu columns)
  const handleParseQuickPaste = async () => {
    if (!pastedText.trim()) {
      if (showToast) showToast('Vui lòng dán danh sách học sinh vào ô văn bản.', 'error');
      return;
    }

    try {
      const parsedStudents = parseQuickPasteText(pastedText, selectedClassId);
      const validStudents = parsedStudents.filter((s) => !isInvalidStudentName(s.fullName));

      if (validStudents.length === 0) {
        if (showToast) showToast('Không tìm thấy học sinh hợp lệ. Vui lòng kiểm tra lại văn bản dán.', 'error');
        return;
      }

      const selectedClassObj = classes.find(
        (c) => c.name.toUpperCase() === selectedClassId.toUpperCase() || c.id === selectedClassId
      );
      const schoolName = selectedClassObj?.schoolFullName || 'THPT Võ Thị Sáu';
      const subjectName = selectedClassObj?.subjectFullName || 'Toán';
      const schoolYear = selectedClassObj?.schoolYear || '2026-2027';
      const classId = selectedClassObj?.id || generateClassId(schoolName, subjectName, schoolYear, selectedClassId);

      const enrichedStudents: StudentRosterItem[] = validStudents.map((st, idx) => {
        const stt = st.stt || idx + 1;
        const username = generateStudentUsername(selectedClassId, stt);
        const docId = generateStudentDocId(classId, stt);
        return {
          ...st,
          stt,
          className: selectedClassId,
          classId,
          schoolFullName: schoolName,
          schoolCode: encodeSchoolName(schoolName),
          subjectFullName: subjectName,
          subjectCode: encodeSubjectName(subjectName),
          yearCode: encodeSchoolYear(schoolYear),
          username,
          password: defaultPassword || '123456',
          isAccountCreated: true,
          id: docId,
        };
      });

      await onSaveRoster(enrichedStudents);
      setPastedText('');
      setActiveTab('students');
      if (showToast) {
        showToast(`Đã nhận diện chuẩn & cấp tài khoản cho ${enrichedStudents.length} học sinh lớp ${selectedClassId}!`);
      }
    } catch (err: any) {
      if (showToast) showToast('Lỗi lưu danh sách: ' + err.message, 'error');
    }
  };

  // Open Edit Student Dialog
  const handleOpenEditStudent = (st: StudentRosterItem) => {
    setEditingStudent(st);
    setEditFullName(st.fullName);
    setEditSbd(st.sbd);
    setEditStt(st.stt || 1);
  };

  // Save Edit Student
  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const cleanName = normalizeVietnameseName(editFullName);
    if (!cleanName) {
      if (showToast) showToast('Vui lòng nhập họ và tên học sinh', 'error');
      return;
    }
    const cleanSbd = editSbd.trim() || editingStudent.sbd;
    setIsSavingStudent(true);
    try {
      const updatedStudent: StudentRosterItem = {
        ...editingStudent,
        fullName: cleanName,
        sbd: cleanSbd,
        stt: editStt,
      };

      await onSaveRoster([updatedStudent]);
      setEditingStudent(null);
      if (showToast) showToast(`Đã cập nhật học sinh "${cleanName}" thành công!`);
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi cập nhật học sinh: ' + err.message, 'error');
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Quick Add Single Student
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = normalizeVietnameseName(singleFullName);
    if (!cleanName) {
      if (showToast) showToast('Vui lòng nhập họ và tên học sinh', 'error');
      return;
    }
    const nextStt = currentClassStudents.length + 1;
    const cleanSbd = singleSbd.trim() || `${selectedClassId}-${String(nextStt).padStart(2, '0')}`;

    const selectedClassObj = classes.find(
      (c) => c.name.toUpperCase() === selectedClassId.toUpperCase() || c.id === selectedClassId
    );
    const schoolName = selectedClassObj?.schoolFullName || 'THPT Võ Thị Sáu';
    const subjectName = selectedClassObj?.subjectFullName || 'Toán';
    const schoolYear = selectedClassObj?.schoolYear || '2026-2027';
    const classId = selectedClassObj?.id || generateClassId(schoolName, subjectName, schoolYear, selectedClassId);

    const docId = generateStudentDocId(classId, nextStt);
    const username = generateStudentUsername(selectedClassId, nextStt);

    setIsAddingSingleStudent(true);
    try {
      const newSt: StudentRosterItem = {
        id: docId,
        stt: nextStt,
        fullName: cleanName,
        className: selectedClassId,
        classId,
        schoolFullName: schoolName,
        schoolCode: encodeSchoolName(schoolName),
        subjectFullName: subjectName,
        subjectCode: encodeSubjectName(subjectName),
        yearCode: encodeSchoolYear(schoolYear),
        sbd: cleanSbd,
        username,
        password: defaultPassword || '123456',
        isAccountCreated: true,
        createdAt: new Date().toISOString(),
      };
      await onSaveRoster([newSt]);
      setSingleFullName('');
      setSingleSbd('');
      if (showToast) showToast(`Đã thêm học sinh "${cleanName}" (TK: ${username}) vào lớp ${selectedClassId}!`);
    } catch (err: any) {
      if (showToast) showToast('Lỗi khi thêm học sinh: ' + err.message, 'error');
    } finally {
      setIsAddingSingleStudent(false);
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

  // Generate student accounts for current class
  const handleGenerateAccounts = async () => {
    if (currentClassStudents.length === 0) {
      if (showToast) showToast(`Lớp ${selectedClassId} chưa có học sinh nào. Hãy tải file danh sách hoặc dán nhanh trước!`, 'error');
      return;
    }
    setIsGeneratingAccounts(true);
    try {
      const res = await generateStudentAccountsForClass(roster, selectedClassId, defaultPassword.trim() || '123456');
      await onSaveRoster(res.updatedRoster);
      if (showToast) {
        showToast(`Đã tự động tạo thành công ${res.createdCount} tài khoản học sinh cho lớp ${selectedClassId}! Mật khẩu: ${defaultPassword}`);
      }
    } catch (err: any) {
      if (showToast) showToast('Lỗi tạo tài khoản: ' + err.message, 'error');
    } finally {
      setIsGeneratingAccounts(false);
    }
  };

  // Export accounts list to Excel
  const handleExportAccountsExcel = () => {
    if (currentClassStudents.length === 0) {
      if (showToast) showToast(`Chưa có học sinh trong lớp ${selectedClassId} để xuất file!`, 'info');
      return;
    }

    const selectedClassObj = classes.find(
      (c) => c.name.toUpperCase() === selectedClassId.toUpperCase() || c.id === selectedClassId
    );
    const schoolName = selectedClassObj?.schoolFullName || 'THPT Võ Thị Sáu';
    const subjectName = selectedClassObj?.subjectFullName || 'Toán';
    const schoolYear = selectedClassObj?.schoolYear || '2026-2027';
    const classId = selectedClassObj?.id || generateClassId(schoolName, subjectName, schoolYear, selectedClassId);

    const header = [
      'STT',
      'Họ và tên học sinh',
      'Lớp',
      'Tên đăng nhập',
      'Mật khẩu',
      'Mã Document Học Sinh',
      'Trường học',
      'Môn học',
      'Năm học',
      'Link phòng thi trực tuyến',
      'Hướng dẫn đăng nhập'
    ];
    const examLink = getClassExamLink(selectedClassId);
    const rows = currentClassStudents.map((s, idx) => {
      const stt = s.stt || idx + 1;
      const username = s.username || generateStudentUsername(selectedClassId, stt);
      const studentDocId = s.id && s.id.includes('_') && s.id.split('_').length >= 4
        ? s.id
        : generateStudentDocId(classId, stt);
      const password = s.password || defaultPassword || '123456';
      return [
        stt,
        s.fullName,
        s.className,
        username,
        password,
        studentDocId,
        schoolName,
        subjectName,
        schoolYear,
        examLink,
        `Đăng nhập: Trường "${schoolName}", Môn "${subjectName}", Năm "${schoolYear}", Lớp "${s.className}". Nhập Tài khoản: "${username}" và Mật khẩu: "${password}"`
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 12 },
      { wch: 20 },
      { wch: 14 },
      { wch: 28 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 35 },
      { wch: 55 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `TaiKhoan_${selectedClassId}`);
    XLSX.writeFile(wb, `DanhSach_TaiKhoan_HocSinh_Lop_${selectedClassId}.xlsx`);
    if (showToast) showToast(`Đã xuất file Excel danh sách tài khoản học sinh lớp ${selectedClassId}!`);
  };

  // Copy accounts list for Zalo
  const handleCopyZaloAccounts = () => {
    if (currentClassStudents.length === 0) {
      if (showToast) showToast('Chưa có học sinh để sao chép', 'info');
      return;
    }
    const examLink = getClassExamLink(selectedClassId);
    let text = `📢 THÔNG TIN TÀI KHOẢN VÀ LINK THI TRỰC TUYẾN - LỚP ${selectedClassId}\n`;
    text += `🏫 Hệ thống EduMath AI • Môn Toán GDPT 2018\n`;
    text += `🔗 Link vào thi trực tiếp: ${examLink}\n`;
    text += `-----------------------------------------\n`;
    currentClassStudents.forEach((s, idx) => {
      const stt = s.stt || idx + 1;
      const username = s.username || `${selectedClassId.toLowerCase()}_${String(stt).padStart(2, '0')}`;
      const password = s.password || defaultPassword || '123456';
      text += `${stt}. ${s.fullName} (${s.sbd}) | TK: ${username} | MK: ${password}\n`;
    });
    text += `-----------------------------------------\n`;
    text += `📌 Lưu ý: Các em có thể đăng nhập bằng Tài khoản hoặc mở Link trên, điền Họ tên và Lớp là vào thi ngay!`;

    navigator.clipboard.writeText(text);
    setCopiedZaloList(true);
    setTimeout(() => setCopiedZaloList(false), 3000);
    if (showToast) showToast(`Đã sao chép danh sách tài khoản lớp ${selectedClassId} để gửi Zalo!`);
  };

  // Assign exam to class
  const handleAssignExamToClass = (examCode: string) => {
    const updated = { ...assignedExamMap, [selectedClassId]: examCode };
    setAssignedExamMap(updated);
    try {
      localStorage.setItem('edumath_assigned_exams', JSON.stringify(updated));
    } catch {}
    if (showToast) showToast(`Đã giao đề thi [${examCode}] cho lớp ${selectedClassId}! Học sinh của lớp khi vào phòng thi sẽ tự động nhận đề này.`);
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
                  {uniqueClasses.length} Lớp • {roster.filter((s) => !isInvalidStudentName(s.fullName)).length} Học sinh
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
            <span>1. Danh Sách Lớp ({uniqueClasses.length})</span>
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

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'accounts'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>4. Cấp Tài Khoản Học Sinh</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assign_exam')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'assign_exam'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Share2 className="w-4 h-4 text-purple-600" />
            <span>5. Giao Đề Cho Lớp & Link Thi</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* TAB 1: DANH SÁCH LỚP HỌC & FORM TẠO LỚP */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              {/* Form Tạo Lớp Mới Với Tên Đầy Đủ Tự Nhiên & Mã Hóa Ngầm */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" /> Tạo Lớp Học Mới (Tự Động Mã Hóa Trường / Môn / Niên Khóa)
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Nhập có dấu tiếng Việt tự nhiên, hệ thống tự sinh mã Document ID
                  </span>
                </div>

                <form onSubmit={handleCreateClass} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Tên Trường Đầy Đủ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: THPT Võ Thị Sáu, THPT An Phú..."
                        value={newSchoolFullName}
                        onChange={(e) => setNewSchoolFullName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Môn Học Giảng Dạy <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Toán, Vật Lý, Hóa Học..."
                        value={newSubjectFullName}
                        onChange={(e) => setNewSubjectFullName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Năm Học / Niên Khóa <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: 2026-2027"
                        value={newSchoolYear}
                        onChange={(e) => setNewSchoolYear(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Tên Lớp <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="12A8..."
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
                          <option value="10">K10</option>
                          <option value="11">K11</option>
                          <option value="12">K12</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Live Encoding Badge & Submit */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-extrabold text-indigo-900">Mã Lớp Hệ Thống (Document ID):</span>
                      <code className="px-2 py-0.5 bg-white rounded border border-indigo-300 text-indigo-700 font-mono font-black text-xs shadow-2xs">
                        {generateClassId(newSchoolFullName, newSubjectFullName, newSchoolYear, newClassName || '12A8')}
                      </code>
                      <span className="text-[11px] text-slate-500">
                        (Trường: <b>{encodeSchoolName(newSchoolFullName)}</b> • Môn: <b>{encodeSubjectName(newSubjectFullName)}</b> • Năm: <b>{encodeSchoolYear(newSchoolYear)}</b> • Lớp: <b>{(newClassName || '12A8').toUpperCase()}</b>)
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingClass || !newClassName.trim()}
                      className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {isSubmittingClass ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Lưu Lớp Học Mới</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Bảng Danh Sách Lớp Hiện Có */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" /> Các Lớp Đang Quản Lý ({uniqueClasses.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Bấm "Gửi Link Đề" để sao chép link thi tự động gắn với lớp đó
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {uniqueClasses.map((cls) => {
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
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-md border border-slate-200">
                                {cls.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              {cls.schoolFullName ? `${cls.schoolFullName} • ` : ''}{cls.subjectFullName ? `${cls.subjectFullName} • ` : ''}Năm: <b className="text-slate-800">{cls.schoolYear || '2026-2027'}</b> • Sĩ số: <b className="text-emerald-700">{count} HS</b>
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
                              onClick={() => setClassToDelete(cls)}
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

              {/* Notice Banner for vnEdu & File Support */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-950">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-indigo-600 text-white shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <span className="font-extrabold text-indigo-900">Tự động nhận diện chuẩn danh sách vnEdu: </span>
                    <span className="text-slate-600 font-medium">Hệ thống tự động gộp 2 cột riêng <b>"Họ và chữ lót" (hoặc "Họ và đệm") + "Tên"</b> thành <b>Họ và tên đầy đủ</b> chuẩn tiếng Việt, tự động loại bỏ dòng thống kê/khối ở cuối file.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-100/60 text-indigo-700 font-bold rounded-lg border border-indigo-200 transition-colors text-[11px] shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3 h-3 text-indigo-600" />
                  <span>Tải mẫu vnEdu / Excel</span>
                </button>
              </div>

              {/* Quick Add Single Student Form */}
              <form onSubmit={handleAddSingleStudent} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-2.5">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    required
                    placeholder="Họ và tên học sinh (VD: Thái Thị Tuyết Hồng, Nguyễn Văn An)..."
                    value={singleFullName}
                    onChange={(e) => setSingleFullName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="w-full sm:w-44">
                  <input
                    type="text"
                    placeholder={`SBD / Mã vnEdu (${selectedClassId}-${String(currentClassStudents.length + 1).padStart(2, '0')})`}
                    value={singleSbd}
                    onChange={(e) => setSingleSbd(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingSingleStudent || !singleFullName.trim()}
                  className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isAddingSingleStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Thêm 1 Học Sinh</span>
                </button>
              </form>

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
                      <th className="p-3 text-center w-24">THAO TÁC</th>
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
                              Thầy/Cô hãy bấm <b>"Tải File Excel / CSV"</b> (nhận diện cả file vnEdu 2 cột) hoặc chuyển sang tab <b>"Dán Nhanh Danh Sách"</b> để nhập danh sách lớp.
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
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditStudent(st)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Chỉnh sửa họ tên, SBD"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentToDelete(st)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa học sinh"
                              >
                                <Trash2 className="w-4 h-4" />
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
          )}

          {/* TAB 3: DÁN NHANH DANH SÁCH HỌC SINH */}
          {activeTab === 'quick_paste' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
                <div className="font-black text-sm flex items-center gap-1.5 text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Dán Nhanh Danh Sách Học Sinh Cho Lớp: <b>{selectedClassId}</b>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Thầy/Cô chỉ cần copy danh sách từ Word, Excel hoặc vnEdu và dán vào ô bên dưới.
                  Hệ thống tự động nhận diện cả định dạng <b>vnEdu 2 cột riêng (Họ và đệm + Tên)</b>, tự ghép thành <b>Họ và tên chuẩn</b> và cấp SBD theo định dạng <code>{selectedClassId}-01</code>, <code>{selectedClassId}-02</code>...
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nhập/Dán Danh Sách Học Sinh (Hỗ trợ copy cả bảng từ vnEdu hoặc dán Họ tên thông thường):
                </label>
                <textarea
                  rows={9}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`1	23000101	Nguyễn Văn	An	${selectedClassId}
2	23000102	Thái Thị Tuyết	Hồng	${selectedClassId}
3	23000103	Trần Bảo	Nam	${selectedClassId}
(Hoặc định dạng đơn giản: 1. Nguyễn Văn An, 2. Thái Thị Tuyết Hồng...)`}
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
                  <span>Xác Nhận Nhận Diện & Lưu Vào Lớp {selectedClassId}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CẤP TÀI KHOẢN HỌC SINH CỦA LỚP */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              {/* Class selector & Overview banner */}
              <div className="bg-gradient-to-r from-amber-50 via-indigo-50 to-sky-50 p-5 rounded-2xl border border-amber-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-500 text-white shadow-2xs">
                        <KeyRound className="w-4 h-4" />
                      </span>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Cấp Tài Khoản Học Sinh Cho Lớp: <span className="text-indigo-700">{selectedClassId}</span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Hệ thống tự động sinh <b>Tên đăng nhập</b> (ví dụ: <code className="bg-white/80 px-1.5 py-0.5 rounded border font-mono font-bold text-indigo-700">{selectedClassId.toLowerCase()}_01</code>) và <b>Mật khẩu</b> để học sinh đăng nhập vào làm bài.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">Chọn lớp:</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id || cls.name} value={cls.name}>
                          Lớp {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Batch Account Creation Action Bar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Mật khẩu khởi tạo chung:
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={defaultPassword}
                          onChange={(e) => setDefaultPassword(e.target.value)}
                          placeholder="123456"
                          className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div className="pt-4 text-xs text-slate-500">
                      Sĩ số: <b className="text-slate-800">{currentClassStudents.length}</b> HS • Đã có tài khoản: <b className="text-emerald-700">{currentClassStudents.filter((s) => s.username || s.isAccountCreated).length}</b> HS
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Nút 1: Tự động cấp tài khoản cho cả lớp */}
                    <button
                      type="button"
                      disabled={isGeneratingAccounts || currentClassStudents.length === 0}
                      onClick={handleGenerateAccounts}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isGeneratingAccounts ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-300" />
                      )}
                      <span>Tự Động Tạo Tài Khoản Cho Cả Lớp</span>
                    </button>

                    {/* Nút 2: Xuất Excel tài khoản */}
                    <button
                      type="button"
                      onClick={handleExportAccountsExcel}
                      disabled={currentClassStudents.length === 0}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Xuất file Excel gồm STT, Họ tên, Lớp, SBD, Tài khoản, Mật khẩu"
                    >
                      <Download className="w-4 h-4" />
                      <span>Xuất Excel Tài Khoản</span>
                    </button>

                    {/* Nút 3: Sao chép gửi Zalo */}
                    <button
                      type="button"
                      onClick={handleCopyZaloAccounts}
                      disabled={currentClassStudents.length === 0}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Sao chép toàn bộ danh sách tài khoản định dạng văn bản gửi vào nhóm Zalo lớp"
                    >
                      {copiedZaloList ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedZaloList ? 'Đã chép!' : 'Sao Chép Gửi Zalo'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Table of student accounts */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800 text-white font-black">
                    <tr>
                      <th className="p-3 text-center w-12">STT</th>
                      <th className="p-3">HỌ VÀ TÊN HỌC SINH</th>
                      <th className="p-3 text-center w-24">LỚP</th>
                      <th className="p-3 text-center w-28">SBD</th>
                      <th className="p-3 text-center w-40">TÊN ĐĂNG NHẬP</th>
                      <th className="p-3 text-center w-36">MẬT KHẨU</th>
                      <th className="p-3 text-center w-28">TRẠNG THÁI</th>
                      <th className="p-3 text-center w-20">CHÉP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {currentClassStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 bg-slate-50/50">
                          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="font-bold text-slate-700">Chưa có học sinh nào trong lớp {selectedClassId}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Vui lòng qua tab <b>"Danh Sách Học Sinh"</b> để tải file Excel hoặc tab <b>"Dán Nhanh"</b> trước khi cấp tài khoản.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      currentClassStudents.map((st, idx) => {
                        const stt = st.stt || idx + 1;
                        const username = st.username || generateStudentUsername(selectedClassId, stt);
                        const pass = st.password || defaultPassword;
                        const isVisible = !!showPasswordMap[st.id || idx];
                        const isCopied = copiedAccountUser === username;

                        return (
                          <tr key={st.id || idx} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-3 text-center font-bold font-mono text-slate-600">
                              {String(stt).padStart(2, '0')}
                            </td>
                            <td className="p-3 font-extrabold text-slate-900 text-sm">
                              <div>{st.fullName}</div>
                              {st.id && st.id.includes('_') && (
                                <span className="text-[10px] font-mono text-slate-400 font-normal">
                                  Doc ID: {st.id}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-black text-indigo-700">
                              {st.className}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {st.sbd}
                            </td>
                            <td className="p-3 text-center font-mono font-black text-indigo-700 bg-indigo-50/60">
                              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {username}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-800">
                              <div className="flex items-center justify-center gap-1.5">
                                <span>{isVisible ? pass : '••••••••'}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowPasswordMap((prev) => ({
                                      ...prev,
                                      [st.id || idx]: !prev[st.id || idx],
                                    }))
                                  }
                                  className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
                                  title={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {st.username || st.isAccountCreated ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã cấp
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                  Chờ tạo
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`TK: ${username} | MK: ${pass}`);
                                  setCopiedAccountUser(username);
                                  setTimeout(() => setCopiedAccountUser(null), 2000);
                                  if (showToast) showToast(`Đã sao chép: TK ${username} / MK ${pass}`);
                                }}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Sao chép tài khoản và mật khẩu của học sinh này"
                              >
                                {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: GIAO ĐỀ CHO LỚP & LINK THI */}
          {activeTab === 'assign_exam' && (
            <div className="space-y-6">
              {/* Class selection and Direct Exam Link banner */}
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-5 rounded-2xl border border-purple-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-600 text-white shadow-2xs">
                        <Send className="w-4 h-4" />
                      </span>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Giao Đề Kiểm Tra & Phát Link Thi Cho Lớp: <span className="text-purple-700">{selectedClassId}</span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Khi Thầy/Cô giao đề cho lớp {selectedClassId}, học sinh của lớp khi đăng nhập sẽ <b>tự động nhận đề thi này</b>. Hoặc Thầy/Cô có thể gửi link trực tiếp để học sinh vào thi ngay không cần mật khẩu.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">Đang chọn lớp:</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id || cls.name} value={cls.name}>
                          Lớp {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Direct Link Share Card */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-900 block">
                      Liên kết làm bài trực tiếp dành cho Lớp {selectedClassId}:
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 block mt-1 break-all bg-slate-50 p-2 rounded-lg border border-slate-200">
                      {getClassExamLink(selectedClassId)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyClassLink(selectedClassId)}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {copiedLinkClass === selectedClassId ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    <span>{copiedLinkClass === selectedClassId ? 'Đã Sao Chép Link!' : 'Sao Chép Link Phòng Thi'}</span>
                  </button>
                </div>
              </div>

              {/* List of Available Exams to assign */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Chọn Đề Thi Để Giao Cho Lớp {selectedClassId}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Current Active Exam Card */}
                  {currentExam && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-300 shadow-2xs flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">
                            ĐỀ ĐANG MỞ
                          </span>
                          <span className="font-mono font-bold text-indigo-900 text-xs">
                            {currentExam.examCode}
                          </span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-sm mt-1">
                          {currentExam.title}
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Khối {currentExam.grade} • Thời gian: {currentExam.durationMinutes} phút • {currentExam.multipleChoice?.length || 0} câu TN + {currentExam.trueFalseQuestions?.length || 0} câu Đ/S + {currentExam.essays?.length || 0} câu TL
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                        <span className="text-xs font-bold text-indigo-700">
                          {assignedExamMap[selectedClassId] === currentExam.examCode ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đã giao cho lớp {selectedClassId}
                            </span>
                          ) : (
                            'Chưa gán cho lớp này'
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAssignExamToClass(currentExam.examCode)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Giao Đề Này Cho Lớp {selectedClassId}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Other saved exams */}
                  {savedExams
                    .filter((e) => (!currentExam || e.id !== currentExam.id) && !e.id.includes('-variant-') && (!e.masterExamCode || e.examCode === e.masterExamCode))
                    .map((ex) => (
                      <div
                        key={ex.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200">
                              KHO ĐỀ
                            </span>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {ex.examCode}
                            </span>
                          </div>
                          <h5 className="font-extrabold text-slate-900 text-sm mt-1 truncate">
                            {ex.title}
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Khối {ex.grade} • Thời gian: {ex.durationMinutes} phút
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500 font-medium">
                            {assignedExamMap[selectedClassId] === ex.examCode ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đã giao cho lớp {selectedClassId}
                              </span>
                            ) : (
                              'Chưa giao'
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleAssignExamToClass(ex.examCode)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Giao Cho Lớp {selectedClassId}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
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

      {/* MODAL XÁC NHẬN XÓA LỚP HỌC (Không dùng window.confirm) */}
      {classToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-lg font-black text-slate-900">
                Xác Nhận Xóa Lớp Học
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Thầy/Cô có chắc chắn muốn xóa lớp <b className="text-rose-700">{classToDelete.name}</b> (Khối {classToDelete.grade}) không?
              </p>
              <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-xs font-semibold text-rose-800 text-left space-y-1">
                <div>• Sĩ số hiện tại: <b>{roster.filter((r) => r.className?.toUpperCase() === classToDelete.name.toUpperCase()).length} học sinh</b></div>
                <div>• Danh sách học sinh và tài khoản của lớp này sẽ được gỡ bỏ khỏi hệ thống.</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingClass}
                onClick={() => setClassToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingClass}
                onClick={async () => {
                  setIsDeletingClass(true);
                  try {
                    await onDeleteClass(classToDelete.id || classToDelete.name);
                    if (selectedClassId.toUpperCase() === classToDelete.name.toUpperCase()) {
                      const remaining = classes.filter((c) => c.name.toUpperCase() !== classToDelete.name.toUpperCase());
                      setSelectedClassId(remaining.length > 0 ? remaining[0].name : '');
                    }
                    setClassToDelete(null);
                  } finally {
                    setIsDeletingClass(false);
                  }
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeletingClass ? 'Đang Xóa...' : 'Đồng Ý Xóa Lớp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA HỌC SINH */}
      {studentToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-base font-black text-slate-900">
                Xóa Học Sinh Khỏi Lớp
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Xác nhận gỡ học sinh <b className="text-slate-900">{studentToDelete.fullName}</b> (SBD: <span className="font-mono text-indigo-700">{studentToDelete.sbd}</span>) khỏi lớp {studentToDelete.className}?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={async () => {
                  setIsDeletingStudent(true);
                  try {
                    await onDeleteStudent(studentToDelete.id);
                    setStudentToDelete(null);
                  } finally {
                    setIsDeletingStudent(false);
                  }
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeletingStudent ? 'Đang Xóa...' : 'Xóa Học Sinh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA THÔNG TIN HỌC SINH */}
      {editingStudent && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    Sửa Thông Tin Học Sinh
                  </h4>
                  <p className="text-xs text-slate-500">
                    Lớp: <b className="text-indigo-700">{editingStudent.className}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Ví dụ: Thái Thị Tuyết Hồng"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Tự động chuẩn hóa chữ hoa đầu từ tiếng Việt (VD: Thái Thị Tuyết Hồng).
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Số Báo Danh / Mã vnEdu
                  </label>
                  <input
                    type="text"
                    value={editSbd}
                    onChange={(e) => setEditSbd(e.target.value)}
                    placeholder="23000102 hoặc 10A1-02"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Số Thứ Tự (STT)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={editStt}
                    onChange={(e) => setEditStt(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSavingStudent}
                  onClick={() => setEditingStudent(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent || !editFullName.trim()}
                  className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isSavingStudent ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
