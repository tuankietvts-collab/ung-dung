import React, { useState, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Share2,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ListPlus,
  Compass,
  FileCheck,
  Upload,
  FileText,
  FileCode,
  Scissors,
  Image as ImageIcon,
  Layers,
  Wand2,
  Download,
  Table,
  CheckSquare,
  Shuffle,
  Cloud,
  CloudUpload,
  Trash2,
  Save,
  Database,
  PlusCircle,
  FolderOpen,
  Send,
  Building,
  X
} from 'lucide-react';
import { Exam, ExamMatrixData, StudentRosterItem, TeacherProfile, ClassGroup } from '../types/exam';
import { generateExamApi, parseMatrixApi } from '../services/api';
import { generateExamByMatrix, generateExamByPrompt } from '../services/examGenerator';
import { AnswerMatrixRow, VariantGenerationConfig } from '../services/examPermuter';
import { MathRenderer } from './MathRenderer';
import { QuestionVisual } from './QuestionVisual';
import { ImageSnipperModal } from './ImageSnipperModal';
import { ExamVariantManagerModal } from './ExamVariantManagerModal';
import { StudentRosterManagerModal } from './StudentRosterManagerModal';
import { AssignExamModal } from './AssignExamModal';
import { ExamLibraryModal } from './ExamLibraryModal';
import { DocumentExamStudio } from './DocumentExamStudio';
import { detectGradeFromFileName, getDefaultTopicForGrade, prepareMatrixUploadPayload } from '../services/fileUploadService';
import { parseMatrixDocument, createDefaultMatrixForGrade } from '../services/matrixParser';

interface TeacherExamStudioProps {
  currentExam: Exam | null;
  savedExams?: Exam[];
  variants?: Exam[];
  answerMatrix?: AnswerMatrixRow[];
  roster?: StudentRosterItem[];
  classes?: ClassGroup[];
  onRosterUpdated?: (newRoster: StudentRosterItem[]) => void;
  onExamCreated: (newExam: Exam) => void;
  onSaveExamToCloud?: (exam: Exam) => Promise<void>;
  onDeleteExamFromCloud?: (examId: string) => Promise<void>;
  onSelectSavedExam?: (exam: Exam) => void;
  onGenerate45Variants?: (config?: VariantGenerationConfig) => void;
  onSelectVariant?: (variant: Exam) => void;
  onSwitchToStudentView?: () => void;
  onQuickCreateSample?: () => void;
  isCloudSaving?: boolean;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  currentTeacher?: TeacherProfile | null;
  onLogoutTeacher?: () => void;
  onAssignExam?: (assignedClasses: string[], assignedStudentIds: string[], note: string) => Promise<void> | void;
}

export const TeacherExamStudio: React.FC<TeacherExamStudioProps> = ({
  currentExam,
  savedExams = [],
  variants = [],
  answerMatrix = [],
  roster = [],
  classes = [],
  onRosterUpdated,
  onExamCreated,
  onSaveExamToCloud,
  onDeleteExamFromCloud,
  onSelectSavedExam,
  onGenerate45Variants,
  onSelectVariant,
  onSwitchToStudentView,
  onQuickCreateSample,
  isCloudSaving = false,
  showToast,
  currentTeacher,
  onLogoutTeacher,
  onAssignExam,
}) => {
  // 3 Exam Creation Modes:
  // Cơ chế 1: Tạo theo yêu cầu (Prompt)
  // Cơ chế 2: Tạo theo ma trận (File/Ảnh hoặc Bảng số câu Biết, Hiểu, Vận dụng)
  // Cơ chế 3: Tái tạo đề (AI Tái Tạo Đề Tương Tự)
  const [creationMode, setCreationMode] = useState<'prompt' | 'matrix_file' | 'recreate_exam'>('prompt');

  // Form State for Mode 1
  const [grade, setGrade] = useState<string>('11');
  const [topic, setTopic] = useState<string>('Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn & Hình không gian');
  const [textbook, setTextbook] = useState<string>('Kết Nối Tri Thức Với Cuộc Sống');
  const [difficulty, setDifficulty] = useState<string>('Đề thi chuẩn cấu trúc tốt nghiệp THPT 2025');
  const [promptCustom, setPromptCustom] = useState<string>('');
  const [part3Choice, setPart3Choice] = useState<'short_answer' | 'essay'>('short_answer');

  // State for Mode 2 (Matrix File / Matrix Table)
  const [matrixFile, setMatrixFile] = useState<File | null>(null);
  const [matrixFileName, setMatrixFileName] = useState<string>('');
  const [showMatrixEditor, setShowMatrixEditor] = useState<boolean>(true);
  const matrixFileInputRef = useRef<HTMLInputElement | null>(null);

  // Standard GDPT 2018 High School Math Exam Matrix (Default Grade 11)
  const DEFAULT_MATRIX: ExamMatrixData = createDefaultMatrixForGrade('11');

  const [parsedMatrix, setParsedMatrix] = useState<ExamMatrixData>(() => createDefaultMatrixForGrade('11'));

  // Update specific field in matrix
  const updateMatrixField = (
    section: 'part1' | 'part2' | 'part3',
    field: string,
    value: number
  ) => {
    setParsedMatrix((prev) => {
      const sec = { ...prev[section], [field]: Math.max(0, value) };
      if (field === 'nhanBiet' || field === 'thongHieu' || field === 'vanDung' || field === 'vanDungCao') {
        sec.totalQuestions =
          (sec.nhanBiet || 0) +
          (sec.thongHieu || 0) +
          (sec.vanDung || 0) +
          (sec.vanDungCao || 0);
      }
      return {
        ...prev,
        [section]: sec,
      };
    });
  };

  const [matrixBase64, setMatrixBase64] = useState<string>('');

  const handleMatrixFileUpload = async (file: File) => {
    setMatrixFile(file);
    setMatrixFileName(file.name);
    setError(null);

    // Auto-detect grade immediately from filename (e.g. 11.pdf -> Grade 11)
    const detected = detectGradeFromFileName(file.name);
    if (detected) {
      setGrade(detected);
      const newTopic = getDefaultTopicForGrade(detected);
      setTopic(newTopic);
      setParsedMatrix((prev) => ({
        ...prev,
        grade: detected,
        topic: newTopic,
      }));
    }

    try {
      const payload = await prepareMatrixUploadPayload(file);
      if (payload.fileBase64) {
        setMatrixBase64(payload.fileBase64);
      }
      if (payload.detectedGrade) {
        setGrade(payload.detectedGrade);
        setTopic(payload.detectedTopic);
      }
      const parsed = await parseMatrixDocument(file);
      if (parsed) {
        setParsedMatrix(parsed);
        if (parsed.grade) setGrade(parsed.grade);
        if (parsed.topic) setTopic(parsed.topic);
        if (parsed.part3Type) setPart3Choice(parsed.part3Type);
      }
    } catch (err: any) {
      console.warn('Matrix file processing notice:', err.message);
    }
  };

  // State for Mode 3 (Recreate / Clone Similar Exam)
  const [recreateSource, setRecreateSource] = useState<'current_exam' | 'file_upload'>(currentExam ? 'current_exam' : 'file_upload');
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examFileName, setExamFileName] = useState<string>('');
  const [examFileBase64, setExamFileBase64] = useState<string>('');
  const examFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSnipperOpen, setIsSnipperOpen] = useState<boolean>(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState<boolean>(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isDocumentStudioOpen, setIsDocumentStudioOpen] = useState<boolean>(false);
  const [isConfirmDeleteExamOpen, setIsConfirmDeleteExamOpen] = useState<boolean>(false);
  const [isDeletingExam, setIsDeletingExam] = useState<boolean>(false);

  const handleGradeChange = (newGrade: string) => {
    setGrade(newGrade);
    if (newGrade === '10') {
      setTopic('Hàm số bậc hai và Bất phương trình bậc hai');
    } else if (newGrade === '11') {
      setTopic('Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn & Hình không gian');
    } else {
      setTopic('Khảo sát hàm số, Cực trị & Tích phân');
    }
  };

  // General state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const getDirectExamLink = (examToShare: Exam) => {
    return `${window.location.origin}${window.location.pathname}?mode=student&examId=${examToShare.id}&code=${examToShare.examCode}`;
  };

  const handleCopyDirectLink = (examToShare: Exam) => {
    const url = getDirectExamLink(examToShare);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    if (showToast) {
      showToast(`Đã sao chép link làm bài gửi cho học sinh: ${url}`);
    }
  };

  const handleCopyExamCode = (examToShare: Exam) => {
    navigator.clipboard.writeText(examToShare.examCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
    if (showToast) {
      showToast(`Đã sao chép mã phòng thi: ${examToShare.examCode}`);
    }
  };

  // Handle Mode 1: Prompt AI (Cơ chế 1)
  const handleGeneratePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const generated = await generateExamByPrompt({
        grade,
        topic,
        textbook,
        difficulty,
        promptCustom,
        part3Type: part3Choice,
      });

      onExamCreated(generated);
      if (showToast) {
        showToast(`Đã tạo thành công đề thi môn Toán lớp ${grade}: ${generated.title}`);
      }
    } catch (err: any) {
      console.error('Generate exam error:', err);
      setError(err?.message || 'Lỗi khi yêu cầu AI sinh đề thi theo prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Mode 2: Matrix (Cơ chế 2)
  const handleGenerateFromMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const detectedGrade = detectGradeFromFileName(matrixFileName || '', topic);
      const effectiveGrade: '10' | '11' | '12' = (matrixFileName ? detectedGrade : (grade || detectedGrade || '11')) as '10' | '11' | '12';
      const effectiveTopic = getDefaultTopicForGrade(effectiveGrade);

      const generated = await generateExamByMatrix({
        grade: effectiveGrade,
        topic: effectiveTopic,
        textbook,
        matrixFileBase64: matrixBase64 || undefined,
        matrixFileName: matrixFileName || undefined,
        matrixMimeType: matrixFile?.type || (matrixFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
        matrix: {
          ...parsedMatrix,
          grade: effectiveGrade,
          topic: effectiveTopic,
        },
        part3Type: part3Choice,
      });

      onExamCreated(generated);
      if (showToast) {
        showToast(`Đã tạo thành công đề thi bám sát ma trận: ${generated.title}`);
      }
    } catch (err: any) {
      console.error('Generate exam from matrix error:', err);
      setError(err?.message || 'Lỗi khi tạo đề từ ma trận.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Mode 3: Recreate / Clone Similar Exam (Cơ chế 3)
  const handleRecreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recreateSource === 'current_exam' && !currentExam) {
      setError('Chưa có đề thi nào đang mở để tái tạo. Vui lòng tạo đề hoặc tải file đề lên.');
      return;
    }
    if (recreateSource === 'file_upload' && !examFileName) {
      setError('Vui lòng tải lên file đề thi có sẵn (.doc, .docx, .pdf hoặc ảnh chụp đề).');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generated = await generateExamApi({
        mode: 'recreate',
        grade: currentExam?.grade || grade,
        topic: currentExam ? `Tái tạo tương đương từ ${currentExam.title}` : `Tái tạo từ file ${examFileName}`,
        textbook: currentExam?.textbook || textbook,
        difficulty: 'Giữ nguyên khung cấu trúc kiến thức và độ khó, đổi số liệu, đổi ngữ cảnh, đảo vị trí đáp án đúng',
        originalExam: (recreateSource === 'current_exam' && currentExam) ? currentExam : undefined,
        examFileBase64: recreateSource === 'file_upload' ? examFileBase64 : undefined,
        examFileName: recreateSource === 'file_upload' ? examFileName : undefined,
        part3Type: part3Choice,
      });

      onExamCreated(generated);
      if (showToast) {
        showToast(`AI đã tái tạo thành công đề mới tương đương: ${generated.examCode}`);
      }
    } catch (err: any) {
      console.error('Recreate exam error:', err);
      setError(err?.message || 'Lỗi khi AI tái tạo đề thi tương đương.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Attach snipped image to question
  const handleAttachImageToQuestion = (targetType: 'mc' | 'tf' | 'essay', questionId: string, croppedImageUrl: string) => {
    if (!currentExam) return;
    const updatedExam: Exam = { ...currentExam };

    if (targetType === 'mc') {
      updatedExam.multipleChoice = updatedExam.multipleChoice.map((q) =>
        q.id === questionId ? { ...q, customImageUrl: croppedImageUrl } : q
      );
    } else if (targetType === 'tf') {
      updatedExam.trueFalseQuestions = updatedExam.trueFalseQuestions.map((q) =>
        q.id === questionId ? { ...q, customImageUrl: croppedImageUrl } : q
      );
    } else {
      updatedExam.essays = updatedExam.essays.map((q) =>
        q.id === questionId ? { ...q, customImageUrl: croppedImageUrl } : q
      );
    }

    onExamCreated(updatedExam);
  };

  const getExamShareLink = () => {
    const origin = window.location.origin;
    return `${origin}/?exam=${currentExam?.examCode || 'TOAN12'}`;
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(getExamShareLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner for Teacher Studio */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-sky-200 text-xs font-semibold mb-3 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" /> Module Giáo Viên: AI Sinh Đề Thi & Barem Tự Luận
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Studio Soạn Đề Thi Toán Cấp 3 Bằng Gemini AI
          </h2>
          <p className="mt-2 text-sky-100 text-sm leading-relaxed">
            Hỗ trợ 3 cách tạo đề: Nhập yêu cầu Prompt, Nhập ma trận từ file (Word/Excel/PDF/Ảnh), hoặc Tái tạo đề có sẵn kết hợp chụp cắt ảnh thực tế.
          </p>
        </div>

        {/* Nút bấm tinh gọn [ 📂 Kho Đề Thi (X) ] & [ 📄 Tải File Đề Đa Định Dạng ] trên Header/Toolbar */}
        <div className="relative z-10 shrink-0 flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDocumentStudioOpen(true)}
            className="px-4 py-3.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-950/20 border-2 border-white/40 transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            title="Tạo đề thi trực tuyến từ file Word (.docx), Excel (.xlsx), PDF, Ảnh, Text"
          >
            <Upload className="w-5 h-5 text-sky-100" />
            <span>📄 Tải File Đề Đa Định Dạng</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLibraryModalOpen(true)}
            className="px-5 py-3.5 bg-white hover:bg-slate-50 text-indigo-900 font-black text-sm rounded-2xl shadow-lg shadow-black/10 border-2 border-white/80 transition-all flex items-center gap-2.5 cursor-pointer hover:scale-105 active:scale-95"
            title="Mở kho lưu trữ đề thi đám mây Firebase"
          >
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <span>📂 Kho Đề Thi ({savedExams.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 3 Creation Modes */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {/* Mode Switcher Tabs */}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              Chọn phương thức tạo đề thi:
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setCreationMode('prompt')}
                className={`py-2.5 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  creationMode === 'prompt'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cách 1: Nhập yêu cầu
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('matrix_file')}
                className={`py-2.5 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  creationMode === 'matrix_file'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cách 2: File ma trận
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('recreate_exam')}
                className={`py-2.5 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  creationMode === 'recreate_exam'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cách 3: Tái tạo & Cắt ảnh
              </button>
            </div>
          </div>

          {/* Mode 1: Nhập vào khung yêu cầu để AI soạn đề */}
          {creationMode === 'prompt' && (
            <form onSubmit={handleGeneratePrompt} className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900 font-medium leading-relaxed">
                💡 <b>Cách 1:</b> Giáo viên chọn khối lớp và nhập yêu cầu. Gemini AI sẽ soạn trực tiếp đề chuẩn bám sát 100% chủ đề và khối lớp yêu cầu kèm barem chi tiết.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Khối Lớp
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="w-full text-base font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="10">Toán Lớp 10 (GDPT 2018)</option>
                    <option value="11">Toán Lớp 11 (GDPT 2018)</option>
                    <option value="12">Toán Lớp 12 (GDPT 2018)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Bộ Sách Giáo Khoa
                  </label>
                  <select
                    value={textbook}
                    onChange={(e) => setTextbook(e.target.value)}
                    className="w-full text-base font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Kết Nối Tri Thức Với Cuộc Sống">Kết Nối Tri Thức</option>
                    <option value="Cánh Diều">Cánh Diều</option>
                    <option value="Chân Trời Sáng Tạo">Chân Trời Sáng Tạo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Chủ đề / Chuyên đề Toán <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="VD: Hàm số bậc hai và Bất phương trình bậc hai..."
                  className="w-full text-base font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-xs text-slate-500 block mb-1.5 font-bold">Gợi ý chủ đề theo khối lớp:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { grade: '10', title: 'Hàm số bậc hai và Bất phương trình bậc hai' },
                    { grade: '10', title: 'Hệ thức lượng trong tam giác & Vectơ' },
                    { grade: '11', title: 'Hàm số lượng giác & Phương trình lượng giác' },
                    { grade: '11', title: 'Dãy số, Cấp số cộng và Cấp số nhân' },
                    { grade: '12', title: 'Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số' },
                    { grade: '12', title: 'Nguyên hàm, Tích phân và Ứng dụng hình học' },
                    { grade: '12', title: 'Phương pháp tọa độ trong không gian Oxyz' },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTopic(p.title);
                        setGrade(p.grade);
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border ${
                        grade === p.grade
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.grade === '10' ? 'Lớp 10' : p.grade === '11' ? 'Lớp 11' : 'Lớp 12'}: {p.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Prompt Textarea */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Khung yêu cầu chi tiết (Tùy chọn):
                </label>
                <textarea
                  value={promptCustom}
                  onChange={(e) => setPromptCustom(e.target.value)}
                  rows={3}
                  placeholder="VD: Yêu cầu bám sát định dạng cấu trúc SGK, 12 câu trắc nghiệm, 4 câu Đúng/Sai và 2 bài vận dụng..."
                  className="w-full text-base font-semibold bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Lựa chọn định dạng Phần III: Trả lời ngắn HOẶC Tự luận */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-indigo-950">
                    Cấu trúc câu hỏi Phần III của đề thi:
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    GDPT 2018
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPart3Choice('short_answer')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      part3Choice === 'short_answer'
                        ? 'bg-white border-indigo-600 ring-2 ring-indigo-200 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      part3Choice === 'short_answer' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                    }`}>
                      {part3Choice === 'short_answer' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Trả lời ngắn (Điền đáp số)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Phần III hiển thị các ô để học sinh nhập đáp số.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPart3Choice('essay')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      part3Choice === 'essay'
                        ? 'bg-white border-indigo-600 ring-2 ring-indigo-200 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      part3Choice === 'essay' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                    }`}>
                      {part3Choice === 'essay' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Tự luận (Chụp ảnh / Tải file bài làm)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Học sinh giải ra giấy và tải ảnh bài làm lên; Thầy/cô & AI chấm đối chiếu barem.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-4 px-5 rounded-xl font-black text-white text-sm shadow-md transition-all flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-75 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Gemini AI đang soạn đề Toán theo yêu cầu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Tạo Đề Thi Bằng Gemini AI</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode 2: Nhập ma trận từ file (.doc, .docx, .xls, .xlsx, .PDF, ảnh) */}
          {creationMode === 'matrix_file' && (
            <form onSubmit={handleGenerateFromMatrix} className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-950 font-medium leading-relaxed">
                📊 <b>Quy trình tinh gọn tạo đề từ ma trận:</b> Thầy/cô chỉ cần tải lên file ma trận hoặc ảnh ma trận / bảng đặc tả (<b className="text-blue-700">.docx, .xlsx, .pdf hoặc ảnh</b>) và bấm nút <b>"Tạo Đề Thi Ngay"</b>. Hệ thống AI Gemini sẽ sinh ra bộ đề hoàn chỉnh bám sát 100% số lượng câu, mức độ (Biết, Hiểu, Vận dụng) và cấu trúc chuẩn GDPT 2018.
              </div>

              <input
                ref={matrixFileInputRef}
                type="file"
                accept=".doc,.docx,.xls,.xlsx,.pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleMatrixFileUpload(f);
                  }
                }}
              />

              {/* Upload Dropzone or Uploaded File Card */}
              {matrixFileName ? (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border-2 border-emerald-400 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                          File Ma Trận Đã Chọn
                        </span>
                        <span className="text-[11px] font-black text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-md border border-indigo-200">
                          Khối: Toán Lớp {grade}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Sẵn sàng tạo đề
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-900 truncate mt-0.5">{matrixFileName}</p>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Đã bóc tách ma trận chuẩn <b className="text-indigo-700">Môn Toán Lớp {grade}</b>. Hệ thống đối chiếu và sinh đề bám sát 100% chương trình Lớp {grade}.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => matrixFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-2xs"
                  >
                    Đổi file khác
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => matrixFileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-7 text-center cursor-pointer bg-blue-50/30 hover:bg-blue-50/60 transition-all"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 mb-2 shadow-2xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 mb-1">
                    Bấm để tải lên hoặc kéo thả file ma trận / ảnh ma trận
                  </p>
                  <p className="text-xs text-slate-500">
                    Hỗ trợ định dạng: <b>.doc, .docx, .xls, .xlsx, .pdf, ảnh JPG/PNG</b>
                  </p>
                </div>
              )}

              {/* Sample Matrix button if not uploaded yet */}
              {!matrixFileName && (
                <div className="p-3 rounded-xl bg-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Chưa có sẵn file ma trận?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixFileName('MaTran_DeThi_Toan11_HK1_ChuanBoGD.xlsx');
                      setTopic('Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn & Hình không gian (Lớp 11)');
                      setGrade('11');
                      setParsedMatrix(createDefaultMatrixForGrade('11'));
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-blue-700 cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Dùng file ma trận mẫu Toán 11 (.xlsx)
                  </button>
                </div>
              )}

              {/* Lựa chọn định dạng Phần III trong Mode 2 */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-blue-950">
                    Cấu trúc câu hỏi Phần III:
                  </label>
                  <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {part3Choice === 'short_answer' ? 'Đang chọn: Trả lời ngắn' : 'Đang chọn: Tự luận'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPart3Choice('short_answer')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      part3Choice === 'short_answer'
                        ? 'bg-white border-blue-600 ring-2 ring-blue-200 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      part3Choice === 'short_answer' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                    }`}>
                      {part3Choice === 'short_answer' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Trả lời ngắn (Điền đáp số)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Học sinh làm bài và nhập đáp số vào các ô trả lời.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPart3Choice('essay')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      part3Choice === 'essay'
                        ? 'bg-white border-blue-600 ring-2 ring-blue-200 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      part3Choice === 'essay' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                    }`}>
                      {part3Choice === 'essay' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Tự luận (Chụp ảnh / Tải file)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Học sinh làm bài ra giấy, chụp ảnh hoặc tải file bài làm lên.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Action Button: Direct One-Click Exam Generation */}
              <button
                type="submit"
                disabled={isGenerating || !matrixFileName}
                className="w-full py-3.5 px-5 rounded-xl font-black text-white text-sm shadow-md transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI đang phân tích ma trận và tạo đề thi hoàn chỉnh...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo Đề Thi Ngay</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode 3: Tái tạo đề từ đề có sẵn up lên (Kèm tính năng tự động chụp ảnh cắt và dán vào đề thi) */}
          {creationMode === 'recreate_exam' && (
            <form onSubmit={handleRecreateExam} className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950 font-medium">
                📄 <b>Cách 3:</b> Tái tạo đề từ đề có sẵn up lên. Khi đó các hình ảnh thực tế có trong đề nếu AI không tái tạo lại được thì dùng <b>tính năng tự động chụp ảnh cắt và dán vào đề thi</b>.
              </div>

              <input
                ref={examFileInputRef}
                type="file"
                accept=".doc,.docx,.pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setExamFile(f);
                    setExamFileName(f.name);
                  }
                }}
              />

              <div
                onClick={() => examFileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-emerald-50/30 transition-colors"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mb-2">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800 mb-1">
                  {examFileName ? examFileName : 'Tải lên file đề thi có sẵn (.doc, .docx, .pdf, hoặc ảnh)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  AI sẽ OCR đọc nội dung và tái tạo cấu trúc đề thi trực tuyến
                </p>
              </div>

              {/* Sample existing exam */}
              <div className="p-3 rounded-xl bg-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Đề mẫu có hình vẽ?</span>
                <button
                  type="button"
                  onClick={() => {
                    setExamFileName('De_KhaoSat_Toan12_ChuyenKHTN_2025.pdf');
                    setTopic('Tái tạo đề thi THPT Chuyên KHTN 2025');
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-emerald-700 cursor-pointer shadow-2xs"
                >
                  Dùng đề mẫu có hình học
                </button>
              </div>

              {/* DEDICATED SNIPPING TOOL BANNER AS REQUESTED IN CÁCH 3 */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-300 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase tracking-wide">
                    <Scissors className="w-4 h-4 text-amber-600" />
                    Tính Năng Chụp Ảnh Cắt & Dán Vào Đề Thi:
                  </span>
                  <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                    Quan Trọng
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Khi gặp hình ảnh thực tế phức tạp (hình học không gian 3D, đồ thị thực tế, bảng biến thiên phức tạp) mà AI không tự tái tạo được, hãy dùng công cụ để <b>chụp cắt vùng hình ảnh đó từ đề gốc và dán ngay vào câu hỏi</b>.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSnipperOpen(true)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Scissors className="w-4 h-4" /> Mở Trình Chụp & Cắt Dán Hình Ảnh Vào Đề
                </button>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !examFileName}
                className="w-full py-3 px-4 rounded-xl font-bold text-white text-xs shadow-md transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang số hóa và tái tạo đề thi từ file...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Tái Tạo Đề Thi Từ File Có Sẵn (Cách 3)</span>
                  </>
                )}
              </button>
            </form>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-900">
                    {error.includes('503') || error.includes('high demand') || error.includes('UNAVAILABLE')
                      ? 'Máy chủ AI Gemini đang có lượng truy cập cao tạm thời (Spikes in demand 503)'
                      : 'Thông báo từ hệ thống soạn đề'}
                  </div>
                  <p className="text-rose-700 leading-relaxed">
                    {error.includes('503') || error.includes('high demand') || error.includes('UNAVAILABLE')
                      ? 'Hệ thống đã kích hoạt kênh dự phòng tự động. Thầy/cô có thể bấm "Thử Lại Ngay" hoặc bấm "Soạn Nhanh Đề Chuẩn Toán 12" để dùng ngay lập tức.'
                      : error}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-rose-200/60">
                <button
                  type="button"
                  onClick={(e) => {
                    if (creationMode === 'prompt') handleGeneratePrompt(e);
                    else if (creationMode === 'matrix_file') handleGenerateFromMatrix(e);
                    else handleRecreateExam(e);
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-[11px]"
                >
                  Thử Lại Ngay
                </button>
                {onQuickCreateSample && (
                  <button
                    type="button"
                    onClick={onQuickCreateSample}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 font-bold rounded-xl transition-colors cursor-pointer text-[11px]"
                  >
                    Soạn Nhanh Đề Chuẩn Toán 12
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Current Exam Preview & Clean Toolbar */}
        <div className="lg:col-span-7 space-y-6">
          {!currentExam ? (
            /* Empty State when no exam is selected */
            <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h4 className="text-lg font-black text-slate-900">
                  Chưa Có Đề Thi Nào Đang Mở
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hãy chọn một phương thức tạo đề bên trái (Cách 1: Nhập yêu cầu AI, Cách 2: File ma trận, Cách 3: Tái tạo đề có sẵn) hoặc mở một đề từ <b>Kho Đề Thi ({savedExams.length})</b>.
                </p>
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsLibraryModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  Mở Kho Đề Thi ({savedExams.length})
                </button>
                {onQuickCreateSample && (
                  <button
                    type="button"
                    onClick={onQuickCreateSample}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Soạn Nhanh Đề Chuẩn Toán 12
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Exam Actions Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Nút Kho Đề Thi (X) */}
                  <button
                    type="button"
                    onClick={() => setIsLibraryModalOpen(true)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-black text-xs rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FolderOpen className="w-4 h-4 text-indigo-600" />
                    <span>Kho Đề Thi ({savedExams.length})</span>
                  </button>

                  {/* Gửi link vào thi trực tiếp */}
                  <button
                    type="button"
                    onClick={() => handleCopyDirectLink(currentExam)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Sao chép link gửi cho học sinh làm bài trên điện thoại/máy tính"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Đã sao chép link!' : 'Gửi link vào thi'}</span>
                  </button>

                  {/* Nhập danh sách học sinh từ Excel */}
                  <button
                    type="button"
                    onClick={() => setIsRosterModalOpen(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>DS Học sinh ({roster.length})</span>
                  </button>

                  {onSaveExamToCloud && (
                    <button
                      type="button"
                      onClick={() => onSaveExamToCloud(currentExam)}
                      disabled={isCloudSaving}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isCloudSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CloudUpload className="w-4 h-4" />
                      )}
                      <span>Lưu Lên Cloud</span>
                    </button>
                  )}

                  {onDeleteExamFromCloud && (
                    <button
                      type="button"
                      onClick={() => setIsConfirmDeleteExamOpen(true)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Xóa đề này khỏi Cloud Firebase"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa Đề</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Nút: Trộn Đề & Sinh n Mã Đề */}
                  <button
                    type="button"
                    onClick={() => {
                      if (variants.length === 0 && onGenerate45Variants) {
                        onGenerate45Variants();
                      }
                      setIsVariantModalOpen(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Tùy chọn chỉ trộn đề hoặc tạo n mã đề (2, 4, 8, 24, 45 mã) chuẩn khảo thí"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Trộn Đề & Sinh n Mã Đề ({variants.length > 0 ? `${variants.length} Mã` : 'Khảo thí'})</span>
                  </button>

                  {/* Nút: Giao Đề Cho Đơn Vị Lớp */}
                  {onAssignExam && (
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102"
                      title="Giao đề thi này cho đơn vị lớp học cụ thể (Ví dụ: 10A1, 10A2, 12A8)"
                    >
                      <Send className="w-4 h-4 text-sky-200" />
                      <span>Giao Đề Cho Đơn Vị Lớp</span>
                    </button>
                  )}
                </div>
              </div>

              {/* KHUNG GIAO ĐỀ THEO ĐƠN VỊ LỚP (TRỰC QUAN & 1-CHẠM) */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border-2 border-indigo-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Send className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <span>Giao Đề Về Theo Đơn Vị Lớp</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {currentExam.assignedClassNames && currentExam.assignedClassNames.length > 0
                            ? `Đã giao: ${currentExam.assignedClassNames.join(', ')}`
                            : 'Chưa gán lớp'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600">
                        Chỉ định đơn vị lớp nhận bài thi. Học sinh đúng lớp sẽ tự động thấy đề thi và nạp mã đề tương ứng khi vào thi.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (variants.length === 0 && onGenerate45Variants) {
                          onGenerate45Variants();
                        }
                        setIsVariantModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 font-black text-xs rounded-xl border border-indigo-200 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Có tùy chọn chỉ trộn đề hoặc tạo ra n mã đề"
                    >
                      <Shuffle className="w-4 h-4 text-indigo-600" />
                      <span>Trộn Đề & Tạo n Mã Đề</span>
                    </button>

                    {onAssignExam && (
                      <button
                        type="button"
                        onClick={() => setIsAssignModalOpen(true)}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Building className="w-4 h-4" />
                        <span>Tùy Chọn Giao Đề</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách các lớp của giáo viên để giao 1-chạm */}
                <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-indigo-200/70">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-indigo-600" /> Giao Cho Lớp:
                  </span>

                  {classes.map((cls) => {
                    const isAssigned = currentExam.assignedClassNames?.includes(cls.name);
                    return (
                      <button
                        key={cls.id || cls.name}
                        type="button"
                        onClick={async () => {
                          if (!onAssignExam) return;
                          const currentList = currentExam.assignedClassNames || [];
                          const nextList = isAssigned
                            ? currentList.filter((n) => n !== cls.name)
                            : [...currentList, cls.name];
                          await onAssignExam(nextList, currentExam.assignedStudentIds || [], currentExam.assignedGroupDetails || '');
                          onExamCreated({
                            ...currentExam,
                            assignedClassNames: nextList,
                          });
                          if (showToast) {
                            showToast(
                              !isAssigned
                                ? `Đã giao đề cho Lớp ${cls.name} thành công!`
                                : `Đã hủy giao đề cho Lớp ${cls.name}.`,
                              'success'
                            );
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isAssigned
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs ring-2 ring-emerald-500/30'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        {isAssigned ? <Check className="w-3.5 h-3.5 text-white" /> : <Building className="w-3.5 h-3.5 text-slate-400" />}
                        <span>Lớp {cls.name}</span>
                        {isAssigned && <span className="text-[10px] bg-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Đã giao</span>}
                      </button>
                    );
                  })}

                  {classes.length > 0 && onAssignExam && (
                    <button
                      type="button"
                      onClick={async () => {
                        const allNames = classes.map((c) => c.name);
                        await onAssignExam(allNames, currentExam.assignedStudentIds || [], 'Giao tất cả các lớp');
                        onExamCreated({
                          ...currentExam,
                          assignedClassNames: allNames,
                        });
                        if (showToast) {
                          showToast(`Đã giao đề thi cho TẤT CẢ các lớp (${allNames.join(', ')})!`, 'success');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-indigo-700 shadow-2xs hover:from-blue-700 hover:to-indigo-700 cursor-pointer"
                    >
                      Giao Tất Cả {classes.length} Lớp
                    </button>
                  )}
                </div>
              </div>

              {/* Shareable Link Banner */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold tracking-wider uppercase text-sky-400">
                      Phòng Thi Trực Tuyến Đã Kích Hoạt
                    </span>
                    <h3 className="text-xl font-black text-white mt-0.5 tracking-tight">
                      {currentExam.title}
                    </h3>
                  </div>
                  <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-mono text-emerald-300 font-black self-start sm:self-auto">
                    MÃ ĐỀ: {currentExam.examCode}
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  Đề thi chuẩn GDPT 2018 • Thời lượng: <b>{currentExam.durationMinutes} phút</b> • Thang điểm: <b>{currentExam.totalPoints}đ</b> • Khối: <b>Lớp {currentExam.grade}</b>
                  {currentExam.topic && <> • Chuyên đề: <span className="text-sky-300 font-semibold">{currentExam.topic}</span></>}
                </p>

                {/* Khung hiển thị Đơn Vị Lớp Được Giao Đề */}
                <div className="flex items-center gap-2 flex-wrap mb-4 p-2.5 rounded-2xl bg-white/10 border border-white/15">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" /> Giao Cho Lớp:
                  </span>
                  {currentExam.assignedClassNames && currentExam.assignedClassNames.length > 0 ? (
                    currentExam.assignedClassNames.map((clsName) => (
                      <span
                        key={clsName}
                        className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-black text-xs"
                      >
                        🏫 Lớp {clsName}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-amber-200 italic font-medium">
                      Chưa gán lớp cụ thể (Tất cả học sinh có link đều có thể thi)
                    </span>
                  )}
                  {onAssignExam && (
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="ml-auto text-[11px] font-bold text-sky-300 hover:text-white underline cursor-pointer"
                    >
                      {currentExam.assignedClassNames && currentExam.assignedClassNames.length > 0 ? 'Chỉnh sửa lớp nhận đề →' : 'Giao cho lớp ngay →'}
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getExamShareLink()}
                    className="bg-black/30 text-sky-200 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono flex-1 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Đã Copy Link!' : 'Sao chép Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSwitchToStudentView) onSwitchToStudentView();
                    }}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Thử vai Học sinh</span>
                  </button>
                </div>
              </div>

              {/* Exam Structure Preview with upgraded typography & colors */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-7">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-black text-slate-900 text-base sm:text-lg">
                      Chi Tiết Nội Dung Đề Thi Môn Toán (Thang Điểm: {currentExam.totalPoints}đ)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSnipperOpen(true)}
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 font-black px-3.5 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-600" /> Cắt dán hình vào câu hỏi
                  </button>
                </div>

                {/* ============================================================== */}
                {/* PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN (THẺ XANH DƯƠNG NHẠT) */}
                {/* ============================================================== */}
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200 flex items-center justify-between">
                    <span className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      Phần I: Câu hỏi trắc nghiệm 4 lựa chọn ({currentExam.multipleChoice?.length || 0} câu)
                    </span>
                    <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      Mỗi câu đúng: 0.25đ
                    </span>
                  </div>

                  <div className="space-y-4">
                    {currentExam.multipleChoice?.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="p-5 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 space-y-3.5 shadow-2xs transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-lg font-bold text-slate-900 leading-relaxed flex-1">
                            <span className="text-blue-700 font-extrabold mr-2">Câu {idx + 1}:</span>
                            <MathRenderer content={q.question.replace(/^Câu\s*\d+\s*[:.]*\s*/i, '')} />
                          </div>
                          <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shrink-0">
                            {q.points || 0.25}đ
                          </span>
                        </div>

                        <QuestionVisual
                          visualType={q.visualType}
                          caption={q.visualCaption}
                          questionText={q.question}
                        />

                        {q.customImageUrl && (
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
                            <span className="text-xs text-amber-700 font-bold block mb-1">
                              📷 Hình ảnh đính kèm từ đề gốc:
                            </span>
                            <img src={q.customImageUrl} alt="Hình ảnh câu hỏi" className="max-h-56 object-contain mx-auto rounded-lg" />
                          </div>
                        )}

                        {/* Options Grid (A, B, C, D) */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {q.options.map((opt, oIdx) => {
                              const letter = ['A', 'B', 'C', 'D'][oIdx] || '';
                              // Only the true single correct answer is highlighted in green
                              const cleanCorrect = (q.correctAnswer || '').trim().toUpperCase().replace(/[^A-D]/g, '');
                              const isCorrect = cleanCorrect === letter;

                              return (
                                <div
                                  key={oIdx}
                                  className={`p-3 rounded-xl border text-base font-semibold flex items-center justify-between gap-2.5 transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-200'
                                      : 'bg-white border-slate-200/90 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${
                                        isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                    >
                                      {letter}
                                    </span>
                                    <div className="flex-1 text-slate-800 leading-relaxed break-words overflow-x-auto">
                                      <MathRenderer content={opt.replace(/^[A-D]\.\s*/, '')} />
                                    </div>
                                  </div>
                                  {isCorrect && (
                                    <span className="text-[11px] font-black text-emerald-700 shrink-0 flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-md self-start sm:self-center">
                                      <Check className="w-3 h-3" /> Đáp án đúng
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                            <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                              <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> Lời giải chi tiết:
                            </span>
                            <div className="leading-relaxed">
                              <MathRenderer content={q.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ============================================================== */}
                {/* PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (THẺ HỔ PHÁCH NHẠT) */}
                {/* ============================================================== */}
                {currentExam.trueFalseQuestions && currentExam.trueFalseQuestions.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 flex items-center justify-between">
                      <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                        Phần II: Câu hỏi trắc nghiệm Đúng / Sai ({currentExam.trueFalseQuestions.length} câu)
                      </span>
                      <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-200">
                        1 ý: 0.1đ • 2 ý: 0.25đ • 3 ý: 0.5đ • 4 ý: 1.0đ
                      </span>
                    </div>

                    <div className="space-y-4">
                      {currentExam.trueFalseQuestions.map((tf, idx) => (
                        <div
                          key={tf.id || idx}
                          className="p-5 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 space-y-3.5 shadow-2xs transition-all"
                        >
                          <div className="text-lg font-bold text-slate-900 leading-relaxed">
                            <span className="text-amber-700 font-extrabold mr-2">
                              Câu {(currentExam.multipleChoice?.length || 0) + idx + 1}:
                            </span>
                            <MathRenderer content={tf.prompt.replace(/^(?:Câu|Bài)\s*\d+\s*[:.]*\s*/i, '')} />
                          </div>

                          <QuestionVisual
                            visualType={tf.visualType}
                            caption={tf.visualCaption}
                            questionText={tf.prompt}
                          />

                          {tf.customImageUrl && (
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
                              <span className="text-xs text-amber-700 font-bold block mb-1">
                                📷 Hình ảnh đính kèm từ đề gốc:
                              </span>
                              <img src={tf.customImageUrl} alt="Hình ảnh câu hỏi" className="max-h-56 object-contain mx-auto rounded-lg" />
                            </div>
                          )}

                          {/* 4 statements (a, b, c, d) */}
                          <div className="space-y-2 pt-1">
                            {tf.items?.map((item) => (
                              <div
                                key={item.key}
                                className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-base font-semibold"
                              >
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                    {item.key})
                                  </span>
                                  <div className="text-slate-800 leading-relaxed">
                                    <MathRenderer content={item.statement} />
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-black px-3 py-1 rounded-lg shrink-0 border ${
                                    item.isCorrect
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {item.isCorrect ? '✓ ĐÚNG' : '✗ SAI'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* PHẦN III: TỰ LUẬN HOẶC TRẢ LỜI NGẮN (THẺ TÍM / XANH NGỌC NHẠT) */}
                {/* ============================================================== */}
                {currentExam.essays && currentExam.essays.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        Phần III: {currentExam.part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận giải toán & Barem'} ({currentExam.essays.length} câu)
                      </span>
                      <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        Chấm điểm chuẩn SGK GDPT 2018
                      </span>
                    </div>

                    <div className="space-y-4">
                      {currentExam.essays.map((essay, idx) => (
                        <div
                          key={essay.id || idx}
                          className="p-5 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 space-y-3.5 shadow-2xs transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-lg font-bold text-slate-900 leading-relaxed flex-1">
                              <span className="text-emerald-700 font-extrabold mr-2">
                                Bài {(currentExam.multipleChoice?.length || 0) + (currentExam.trueFalseQuestions?.length || 0) + idx + 1}:
                              </span>
                              <MathRenderer content={essay.question.replace(/^(?:Câu|Bài)\s*\d+\s*[:.]*\s*/i, '')} />
                            </div>
                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                              {essay.maxPoints}đ
                            </span>
                          </div>

                          <QuestionVisual
                            visualType={essay.visualType}
                            caption={essay.visualCaption}
                            questionText={essay.question}
                          />

                          {essay.customImageUrl && (
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
                              <span className="text-xs text-amber-700 font-bold block mb-1">
                                📷 Hình ảnh đính kèm từ đề gốc:
                              </span>
                              <img src={essay.customImageUrl} alt="Hình ảnh câu hỏi" className="max-h-56 object-contain mx-auto rounded-lg" />
                            </div>
                          )}

                          {essay.shortAnswerKey && (
                            <div className="p-3 bg-white rounded-xl border border-emerald-200 text-sm font-semibold flex items-center gap-2">
                              <span className="text-emerald-800 font-bold">Đáp số chính xác:</span>
                              <span className="font-mono text-emerald-700 font-black text-base px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                                <MathRenderer content={essay.shortAnswerKey.trim().startsWith('$') ? essay.shortAnswerKey : `$${essay.shortAnswerKey}$`} />
                              </span>
                            </div>
                          )}

                          {/* Rubric Breakdown */}
                          {essay.rubric && essay.rubric.length > 0 && (
                            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                              <span className="font-bold text-slate-900 uppercase tracking-wider block text-[11px]">
                                Barem điểm chi tiết theo SGK GDPT 2018:
                              </span>
                              <div className="space-y-1.5">
                                {essay.rubric.map((r, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between gap-3 text-slate-700 pb-1 border-b border-slate-100 last:border-none">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">• {r.step}:</span>
                                      <span><MathRenderer content={r.description} /></span>
                                    </div>
                                    <span className="font-bold text-emerald-700 shrink-0">
                                      +{r.points}đ
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Exam Library Modal */}
      <ExamLibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        savedExams={savedExams}
        currentExam={currentExam}
        onSelectExam={(exam) => {
          if (onSelectSavedExam) onSelectSavedExam(exam);
        }}
        onDeleteExam={async (examId) => {
          if (onDeleteExamFromCloud) {
            await onDeleteExamFromCloud(examId);
          }
        }}
      />

      {/* Snipper Modal */}
      {currentExam && (
        <ImageSnipperModal
          exam={currentExam}
          isOpen={isSnipperOpen}
          onClose={() => setIsSnipperOpen(false)}
          onAttachImageToQuestion={handleAttachImageToQuestion}
        />
      )}

      {/* 45-Variant Batch Manager Modal */}
      {currentExam && (
        <ExamVariantManagerModal
          isOpen={isVariantModalOpen}
          onClose={() => setIsVariantModalOpen(false)}
          masterExam={currentExam}
          variants={variants}
          answerMatrix={answerMatrix}
          classes={classes}
          onRecreateVariants={(config) => {
            if (onGenerate45Variants) {
              onGenerate45Variants(config);
            }
          }}
          onAssignToClass={async (className) => {
            if (onAssignExam) {
              await onAssignExam([className], [], `Giao ${variants.length} mã đề cho lớp ${className}`);
            }
            onExamCreated({
              ...currentExam,
              assignedClassNames: [className],
            });
            if (showToast) {
              showToast(`Đã giao ${variants.length} mã đề cho lớp ${className}!`, 'success');
            }
          }}
          onSelectVariantForExamRoom={(variant) => {
            if (onSelectVariant) onSelectVariant(variant);
            if (onSwitchToStudentView) onSwitchToStudentView();
          }}
        />
      )}

      {/* Giao Đề Cho Đơn Vị Lớp Modal */}
      {currentExam && (
        <AssignExamModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          exam={currentExam}
          classes={classes}
          roster={roster}
          onAssignExam={async (targetClasses, targetStudentIds, note) => {
            if (onAssignExam) {
              await onAssignExam(targetClasses, targetStudentIds, note);
            }
            onExamCreated({
              ...currentExam,
              assignedClassNames: targetClasses,
              assignedStudentIds: targetStudentIds,
              assignedGroupDetails: note,
            });
            setIsAssignModalOpen(false);
          }}
          showToast={showToast}
        />
      )}

      {/* Student Roster Manager Modal (Nhập Excel .xlsx / .csv & Firestore) */}
      <StudentRosterManagerModal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        currentRoster={roster}
        onRosterUpdated={(newRoster) => {
          if (onRosterUpdated) onRosterUpdated(newRoster);
        }}
        showToast={showToast}
      />

      {/* Document Exam Studio Modal (Đọc file .docx, .xlsx, .pdf, ảnh, .txt) */}
      {isDocumentStudioOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative shadow-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setIsDocumentStudioOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-2xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors shadow-sm border border-slate-200 cursor-pointer z-10"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
            <DocumentExamStudio
              onExamCreated={(exam) => {
                onExamCreated(exam);
                if (onSelectSavedExam) onSelectSavedExam(exam);
              }}
              onOpenExamRoom={(exam) => {
                if (onSelectSavedExam) onSelectSavedExam(exam);
                if (onSwitchToStudentView) onSwitchToStudentView();
                setIsDocumentStudioOpen(false);
              }}
              showToast={showToast}
            />
          </div>
        </div>
      )}
      {/* Modal xác nhận xóa đề thi (Zero window.confirm) */}
      {isConfirmDeleteExamOpen && currentExam && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-lg font-black text-slate-900">
                Xác Nhận Xóa Đề Thi
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Thầy/Cô có chắc chắn muốn xóa đề thi này không? Đề mẫu hoặc đề đã tạo sẽ được xóa khỏi hệ thống.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 text-left space-y-1">
                <div>Tiêu đề: <span className="text-indigo-700">{currentExam.title}</span></div>
                <div>Mã đề: <span className="font-mono text-slate-700">{currentExam.examCode}</span> (Toán {currentExam.grade || '12'})</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingExam}
                onClick={() => setIsConfirmDeleteExamOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingExam}
                onClick={async () => {
                  if (!onDeleteExamFromCloud) return;
                  setIsDeletingExam(true);
                  try {
                    await onDeleteExamFromCloud(currentExam.id);
                    setIsConfirmDeleteExamOpen(false);
                  } finally {
                    setIsDeletingExam(false);
                  }
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeletingExam ? 'Đang Xóa...' : 'Đồng Ý Xóa Đề'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
