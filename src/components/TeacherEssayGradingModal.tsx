import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  X,
  Sliders,
  Check,
  RotateCcw,
  BookOpen,
  ShieldAlert,
  Save,
  MessageSquare,
  FileCheck,
  TrendingUp,
  Brain,
  Filter,
  Search,
  Loader2,
  HelpCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  PenTool
} from 'lucide-react';
import {
  Exam,
  StudentSubmission,
  EssayQuestion,
  EssayGradingResult,
  TeacherEssayOverride,
  GradingCalibrationFeedback,
  RubricStep
} from '../types/exam';
import { gradeEssayApi } from '../services/api';
import {
  saveSubmissionToFirestore,
  saveCalibrationFeedbackToFirestore,
  deleteCalibrationFeedbackFromFirestore,
  getStoredCalibrationFeedbacks,
  subscribeCalibrationFeedbackFromFirestore
} from '../services/firebase';
import { MathRenderer } from './MathRenderer';

interface TeacherEssayGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: StudentSubmission[];
  currentExam: Exam | null;
  teacherName?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSubmissionUpdated?: (updatedSubmission: StudentSubmission) => void;
}

export const TeacherEssayGradingModal: React.FC<TeacherEssayGradingModalProps> = ({
  isOpen,
  onClose,
  submissions,
  currentExam,
  teacherName = 'Giáo viên bộ môn Toán',
  showToast,
  onSubmissionUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'calibration'>('review');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded' | 'overridden' | 'violation'>('all');
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [selectedEssayIdx, setSelectedEssayIdx] = useState<number>(0);

  // Gallery zoom/pan preview
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // Teacher Override Form State
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<TeacherEssayOverride['overrideReason']>('ai_too_strict');
  const [teacherFeedback, setTeacherFeedback] = useState<string>('');
  const [showStepDetails, setShowStepDetails] = useState<boolean>(false);
  const [stepAdjustments, setStepAdjustments] = useState<Record<number, { awardedPoints: number; comment?: string }>>({});
  const [isGradingSingle, setIsGradingSingle] = useState<boolean>(false);
  const [isSavingOverride, setIsSavingOverride] = useState<boolean>(false);

  // Calibration Feedback list
  const [calibrations, setCalibrations] = useState<GradingCalibrationFeedback[]>([]);

  // Subscribe to real-time calibrations
  useEffect(() => {
    setCalibrations(getStoredCalibrationFeedbacks());
    const unsub = subscribeCalibrationFeedbackFromFirestore((list) => {
      setCalibrations(list);
    });
    return () => unsub();
  }, []);

  // Filter submissions with essays
  const essaySubmissions = submissions.filter((s) => {
    const hasEssays = s.essayAnswers && Object.keys(s.essayAnswers).length > 0;
    const hasExamEssays = s.examSnapshot?.essays && s.examSnapshot.essays.length > 0;
    const hasCurrentExamEssays = currentExam?.essays && currentExam.essays.length > 0;
    return hasEssays || hasExamEssays || hasCurrentExamEssays;
  });

  // Filter by category
  const filteredSubmissions = essaySubmissions.filter((sub) => {
    const matchSearch =
      sub.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.studentClass.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.studentId.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    const hasGrading = Object.values(sub.essayAnswers || {}).some((a) => !!a.grading);
    const hasOverride = !!sub.teacherOverrides && Object.keys(sub.teacherOverrides).length > 0;
    const hasViolation = Object.values(sub.essayAnswers || {}).some(
      (a) => a.grading?.universityMethodDetected
    );

    if (statusFilter === 'pending') return !hasGrading;
    if (statusFilter === 'graded') return hasGrading && !hasOverride;
    if (statusFilter === 'overridden') return hasOverride;
    if (statusFilter === 'violation') return hasViolation;
    return true;
  });

  // Select first submission on open or filter change
  useEffect(() => {
    if (filteredSubmissions.length > 0 && !filteredSubmissions.some((s) => s.id === selectedSubId)) {
      setSelectedSubId(filteredSubmissions[0].id);
    }
  }, [filteredSubmissions, selectedSubId]);

  const activeSubmission = essaySubmissions.find((s) => s.id === selectedSubId) || filteredSubmissions[0] || null;
  const activeExam = activeSubmission?.examSnapshot || currentExam;
  const essaysList = activeExam?.essays || [];
  const activeEssay: EssayQuestion | undefined = essaysList[selectedEssayIdx] || essaysList[0];

  const activeEssayAnswer = activeSubmission && activeEssay
    ? activeSubmission.essayAnswers?.[activeEssay.id] ||
      activeSubmission.essayAnswers?.essay1 ||
      Object.values(activeSubmission.essayAnswers || {})[selectedEssayIdx]
    : undefined;

  const currentGrading = activeEssayAnswer?.grading;
  const currentOverride = activeSubmission && activeEssay
    ? activeSubmission.teacherOverrides?.[activeEssay.id] || activeSubmission.teacherOverrides?.essay1
    : undefined;

  // Sync form inputs when active submission or active essay changes
  useEffect(() => {
    if (currentOverride) {
      setOverrideScore(currentOverride.teacherScore);
      setOverrideReason(currentOverride.overrideReason || 'ai_too_strict');
      setTeacherFeedback(currentOverride.teacherFeedback || '');
      setStepAdjustments(currentOverride.stepAdjustments || {});
    } else if (currentGrading) {
      setOverrideScore(currentGrading.totalScore);
      setOverrideReason('ai_too_strict');
      setTeacherFeedback(currentGrading.finalTeacherNote || '');
      setStepAdjustments({});
    } else {
      setOverrideScore(activeEssay?.maxPoints || 3.0);
      setOverrideReason('ai_too_strict');
      setTeacherFeedback('');
      setStepAdjustments({});
    }
    setActiveImageIndex(0);
  }, [activeSubmission?.id, activeEssay?.id, currentGrading, currentOverride]);

  if (!isOpen) return null;

  // Multi-image list for active essay
  const imageGalleryUrls: string[] = [];
  if (activeEssayAnswer?.imageUrls && activeEssayAnswer.imageUrls.length > 0) {
    imageGalleryUrls.push(...activeEssayAnswer.imageUrls);
  } else if (activeEssayAnswer?.imageUrl) {
    imageGalleryUrls.push(activeEssayAnswer.imageUrl);
  }

  // 1. Grade single essay using AI Gemini Vision & Text reasoning
  const handleGradeWithAI = async () => {
    if (!activeSubmission || !activeEssay) return;
    if (imageGalleryUrls.length === 0 && !activeEssayAnswer?.typedSolution?.trim()) {
      if (showToast) showToast('Học sinh chưa có bài làm tự luận (chưa gõ bài giải và chưa tải ảnh).', 'error');
      return;
    }

    try {
      setIsGradingSingle(true);
      const primaryImage = imageGalleryUrls[activeImageIndex] || imageGalleryUrls[0] || '';

      // Pass stored calibrations for few-shot prompt tuning
      const result: EssayGradingResult = await gradeEssayApi({
        imageUrl: primaryImage && !primaryImage.startsWith('data:') ? primaryImage : undefined,
        imageBase64: primaryImage && primaryImage.startsWith('data:') ? primaryImage : undefined,
        typedSolution: activeEssayAnswer?.typedSolution?.trim() || undefined,
        questionText: activeEssay.question,
        maxPoints: activeEssay.maxPoints,
        rubric: activeEssay.rubric,
        studentName: activeSubmission.studentName,
        studentClass: activeSubmission.studentClass,
        calibrations: calibrations.slice(0, 4),
      });

      // Update submission state
      const updatedEssayAnswers = {
        ...(activeSubmission.essayAnswers || {}),
        [activeEssay.id]: {
          ...(activeEssayAnswer || {}),
          imageUrl: primaryImage,
          imageUrls: imageGalleryUrls,
          typedSolution: activeEssayAnswer?.typedSolution,
          grading: result,
        },
      };

      // Recalculate essayScore & totalScore
      let totalEssay = 0;
      Object.keys(updatedEssayAnswers).forEach((key) => {
        const item = updatedEssayAnswers[key];
        const ov = activeSubmission.teacherOverrides?.[key];
        totalEssay += ov ? ov.teacherScore : item.grading ? item.grading.totalScore : 0;
      });

      const newTotal = Math.min(10, Math.round((activeSubmission.mcScore + totalEssay) * 100) / 100);

      const updatedSub: StudentSubmission = {
        ...activeSubmission,
        essayAnswers: updatedEssayAnswers,
        essayScore: totalEssay,
        totalScore: newTotal,
        status: 'graded',
      };

      await saveSubmissionToFirestore(updatedSub);
      if (onSubmissionUpdated) onSubmissionUpdated(updatedSub);
      if (showToast) showToast(`AI Gemini Vision đã chấm xong bài tự luận của ${activeSubmission.studentName}: ${result.totalScore}đ!`, 'success');
    } catch (err: any) {
      console.error('Error grading essay:', err);
      if (showToast) showToast('Lỗi AI chấm bài: ' + (err.message || String(err)), 'error');
    } finally {
      setIsGradingSingle(false);
    }
  };

  // 2. Save Teacher Override & Calibration Record
  const handleSaveTeacherOverride = async () => {
    if (!activeSubmission || !activeEssay) return;

    try {
      setIsSavingOverride(true);
      const originalAiScore = currentGrading ? currentGrading.totalScore : activeEssay.maxPoints;
      const finalTeacherScore = Math.min(activeEssay.maxPoints, Math.max(0, Number(overrideScore)));
      const scoreDelta = Math.round((finalTeacherScore - originalAiScore) * 100) / 100;

      const overrideRecord: TeacherEssayOverride = {
        originalAiScore,
        teacherScore: finalTeacherScore,
        teacherFeedback: teacherFeedback.trim(),
        overrideReason,
        adjustedAt: new Date().toISOString(),
        teacherName,
        stepAdjustments: Object.keys(stepAdjustments).length > 0 ? stepAdjustments : undefined,
      };

      const updatedOverrides = {
        ...(activeSubmission.teacherOverrides || {}),
        [activeEssay.id]: overrideRecord,
      };

      // Calculate new total essay score considering all overrides
      let totalEssay = 0;
      const allEssayKeys = new Set([
        ...Object.keys(activeSubmission.essayAnswers || {}),
        ...essaysList.map((e) => e.id),
      ]);

      allEssayKeys.forEach((key) => {
        const ov = updatedOverrides[key];
        const originalAnswer = activeSubmission.essayAnswers?.[key];
        if (ov) {
          totalEssay += ov.teacherScore;
        } else if (originalAnswer?.grading) {
          totalEssay += originalAnswer.grading.totalScore;
        }
      });

      const newTotal = Math.min(10, Math.round((activeSubmission.mcScore + totalEssay) * 100) / 100);

      const updatedSub: StudentSubmission = {
        ...activeSubmission,
        teacherOverrides: updatedOverrides,
        essayScore: totalEssay,
        totalScore: newTotal,
        isTeacherReviewed: true,
        reviewedAt: new Date().toISOString(),
      };

      // Persist to Cloud Firestore
      await saveSubmissionToFirestore(updatedSub);
      if (onSubmissionUpdated) onSubmissionUpdated(updatedSub);

      // Save Calibration Feedback Record for Fine-Tuning & Prompt Tuning
      const calibrationFeedback: GradingCalibrationFeedback = {
        id: `calib_${activeSubmission.id}_${activeEssay.id}_${Date.now()}`,
        submissionId: activeSubmission.id,
        studentName: activeSubmission.studentName,
        studentClass: activeSubmission.studentClass,
        studentId: activeSubmission.studentId,
        essayId: activeEssay.id,
        questionText: activeEssay.question,
        ocrTranscription: currentGrading?.ocrTranscription || '',
        aiScore: originalAiScore,
        teacherScore: finalTeacherScore,
        scoreDelta,
        aiFeedback: currentGrading?.finalTeacherNote || '',
        teacherFeedback: teacherFeedback.trim(),
        reason:
          overrideReason === 'ai_too_strict'
            ? 'AI chấm quá khắt khe, trừ điểm không đáng có'
            : overrideReason === 'ai_too_lenient'
            ? 'AI chấm quá nới lỏng, bỏ qua lỗi sai logic'
            : overrideReason === 'ocr_misread'
            ? 'OCR đọc nhầm chữ viết tay hoặc ký hiệu toán'
            : overrideReason === 'alternative_valid_method'
            ? 'Học sinh dùng cách giải khác chuẩn xác ngoài barem dự kiến'
            : overrideReason === 'partial_credit'
            ? 'Cộng điểm khuyến khích lập luận sáng tạo'
            : 'Giáo viên điều chỉnh chuyên môn',
        imageUrl: imageGalleryUrls[0],
        imageUrls: imageGalleryUrls,
        createdAt: new Date().toISOString(),
        teacherName,
      };

      await saveCalibrationFeedbackToFirestore(calibrationFeedback);

      // Send to server in-memory prompt tuning buffer
      fetch('/api/calibration-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calibrationFeedback),
      }).catch(() => {});

      if (showToast) {
        showToast(
          `Đã lưu điểm sửa của giáo viên (${finalTeacherScore}đ) và cập nhật bộ dữ liệu hiệu chuẩn AI!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Save override error:', err);
      if (showToast) showToast('Lỗi lưu điều chỉnh: ' + err.message, 'error');
    } finally {
      setIsSavingOverride(false);
    }
  };

  // 3. Reset back to original AI score
  const handleResetToAiScore = async () => {
    if (!activeSubmission || !activeEssay || !currentGrading) return;

    try {
      const updatedOverrides = { ...(activeSubmission.teacherOverrides || {}) };
      delete updatedOverrides[activeEssay.id];
      delete updatedOverrides['essay1'];

      let totalEssay = 0;
      Object.keys(activeSubmission.essayAnswers || {}).forEach((key) => {
        const ov = updatedOverrides[key];
        const originalAnswer = activeSubmission.essayAnswers[key];
        if (ov) {
          totalEssay += ov.teacherScore;
        } else if (originalAnswer?.grading) {
          totalEssay += originalAnswer.grading.totalScore;
        }
      });

      const newTotal = Math.min(10, Math.round((activeSubmission.mcScore + totalEssay) * 100) / 100);

      const updatedSub: StudentSubmission = {
        ...activeSubmission,
        teacherOverrides: updatedOverrides,
        essayScore: totalEssay,
        totalScore: newTotal,
      };

      await saveSubmissionToFirestore(updatedSub);
      if (onSubmissionUpdated) onSubmissionUpdated(updatedSub);
      setOverrideScore(currentGrading.totalScore);
      setTeacherFeedback(currentGrading.finalTeacherNote || '');
      setStepAdjustments({});
      if (showToast) showToast('Đã khôi phục về điểm chấm ban đầu của AI Gemini Vision!', 'info');
    } catch (err: any) {
      if (showToast) showToast('Lỗi khôi phục điểm: ' + err.message, 'error');
    }
  };

  // 4. Export fine-tuning dataset as JSONL
  const handleDownloadFinetuningJsonl = () => {
    if (calibrations.length === 0) {
      if (showToast) showToast('Chưa có mẫu hiệu chuẩn nào được ghi nhận để xuất file.', 'info');
      return;
    }

    const lines = calibrations.map((item) => {
      const systemInstruction = 'Bạn là chuyên gia thẩm định và chấm bài tự luận môn Toán THPT Việt Nam (Chương trình GDPT 2018). Đánh giá bám sát barem SGK, không dùng kiến thức Đại học.';
      const userPrompt = `ĐỀ BÀI TOÁN TỰ LUẬN:\n"${item.questionText}"\n\nBÀI LÀM / OCR:\n"${item.ocrTranscription || 'Bài giải viết tay'}"`;
      const modelTarget = JSON.stringify({
        ocrTranscription: item.ocrTranscription || '',
        totalScore: item.teacherScore,
        aiScoreOriginal: item.aiScore,
        overrideReason: item.reason,
        teacherFeedback: item.teacherFeedback,
      });

      return JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
          { role: 'model', content: modelTarget },
        ],
      });
    });

    const blob = new Blob([lines.join('\n')], { type: 'application/x-jsonlines;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gemini_math_essay_finetuning_${new Date().toISOString().split('T')[0]}.jsonl`;
    link.click();
    URL.revokeObjectURL(url);

    if (showToast) showToast(`Đã xuất ${calibrations.length} mẫu chuẩn định dạng JSONL Fine-Tuning Google AI Studio!`, 'success');
  };

  // Calibration summary metrics
  const totalCalibrated = calibrations.length;
  const avgDelta = totalCalibrated > 0
    ? (calibrations.reduce((acc, c) => acc + c.scoreDelta, 0) / totalCalibrated).toFixed(2)
    : '0.00';
  const agreementRate = totalCalibrated > 0
    ? Math.round((calibrations.filter((c) => Math.abs(c.scoreDelta) <= 0.25).length / totalCalibrated) * 100)
    : 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-7xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-indigo-950">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <Brain className="w-3 h-3 text-emerald-400" />
                Cơ Chế Cân Chỉnh AI & Duyệt Chấm Tự Luận
              </span>
              <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-400/30">
                {essaySubmissions.length} Bài Nộp Tự Luận
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-black text-white mt-1 flex items-center gap-2">
              <span>Hệ Thống Thẩm Định Điểm Tự Luận & Prompt Engineering Hub</span>
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Thầy/Cô duyệt điểm AI, điều chỉnh điểm & ghi nhận xét sư phạm. Mọi điều chỉnh được tự động nạp vào Few-Shot Prompt Tuning và chuẩn bị dataset Fine-Tuning Gemini.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Tab switch */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('review')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'review'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Duyệt Chấm Bài ({filteredSubmissions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calibration')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'calibration'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Hiệu Chuẩn Prompt & Dataset ({totalCalibrated})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TAB 1: DUYỆT CHẤM BÀI & THẨM ĐỊNH ĐIỂM */}
        {activeTab === 'review' && (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* LEFT COLUMN: Submissions list & Filters (4 cols) */}
            <div className="lg:col-span-4 flex flex-col bg-slate-50/50 h-full overflow-hidden">
              {/* Search & filter controls */}
              <div className="p-3.5 border-b border-slate-200 space-y-2.5 shrink-0 bg-white">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên học sinh, lớp, SBD..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'pending', label: 'Chưa chấm AI' },
                    { id: 'graded', label: 'AI đã chấm' },
                    { id: 'overridden', label: 'GV đã sửa điểm' },
                    { id: 'violation', label: 'Phạm quy chế' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                        statusFilter === f.id
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submissions items list */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {filteredSubmissions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">Không tìm thấy bài nộp tự luận nào</p>
                  </div>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const isSelected = sub.id === activeSubmission?.id;
                    const hasOverrides = !!sub.teacherOverrides && Object.keys(sub.teacherOverrides).length > 0;
                    const essayGraded = Object.values(sub.essayAnswers || {}).some((a) => !!a.grading);
                    const isViolation = Object.values(sub.essayAnswers || {}).some(
                      (a) => a.grading?.universityMethodDetected
                    );

                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubId(sub.id)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-white border-indigo-600 ring-2 ring-indigo-100 shadow-sm'
                            : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 leading-tight">
                              {sub.studentName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              Lớp: <b className="text-indigo-700">{sub.studentClass}</b> • SBD: {sub.studentId || 'N/A'}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black font-mono text-slate-900">
                              {sub.essayScore.toFixed(2)}đ
                            </div>
                            <span className="text-[10px] text-slate-400 block">TL đạt</span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-1 flex-wrap text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {hasOverrides ? (
                              <span className="px-2 py-0.5 rounded font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                ✏️ GV đã sửa điểm
                              </span>
                            ) : essayGraded ? (
                              <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                                AI đã chấm
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                Chờ chấm AI
                              </span>
                            )}

                            {isViolation && (
                              <span className="px-1.5 py-0.5 rounded font-black bg-rose-100 text-rose-800">
                                L'Hôpital
                              </span>
                            )}
                          </div>

                          <span className="text-slate-400 font-mono text-[10px]">
                            {sub.submittedAt ? sub.submittedAt.split(' ')[0] : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Selected Submission Essay Review & Override Details (8 cols) */}
            <div className="lg:col-span-8 flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-white">
              {activeSubmission && activeEssay ? (
                <>
                  {/* Top Bar of active submission */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          Thẩm Định Bài Thi: {activeSubmission.studentName}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600">
                          Lớp {activeSubmission.studentClass} • SBD: {activeSubmission.studentId || 'N/A'}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-slate-900 mt-1">
                        Mã đề: <b className="text-indigo-600">{activeSubmission.examCode}</b> • Nộp lúc: {activeSubmission.submittedAt}
                      </h4>
                    </div>

                    {/* Question selector tabs if multiple essays exist */}
                    {essaysList.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        {essaysList.map((es, idx) => (
                          <button
                            key={es.id}
                            type="button"
                            onClick={() => setSelectedEssayIdx(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              selectedEssayIdx === idx
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Câu {idx + 1} ({es.maxPoints}đ)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Question Prompt */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Nội dung câu hỏi tự luận:</span>
                      <span className="text-indigo-600">Thang điểm: {activeEssay.maxPoints}đ</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 leading-relaxed pt-1">
                      <MathRenderer content={activeEssay.question} />
                    </div>
                  </div>

                  {/* Student's Directly Typed Math Solution (MathType / LaTeX) */}
                  {activeEssayAnswer?.typedSolution && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-indigo-950">
                        <span className="flex items-center gap-1.5">
                          <PenTool className="w-4 h-4 text-indigo-600" />
                          <span>Bài giải tự luận học sinh soạn qua MathType ({activeEssayAnswer.typedSolution.length} ký tự):</span>
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">
                          Chuẩn SGK GDPT 2018
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-white border border-indigo-100 text-sm leading-relaxed text-slate-900 overflow-x-auto shadow-2xs space-y-1">
                        {activeEssayAnswer.typedSolution.split('\n').map((line, lIdx) => (
                          <div key={lIdx} className="min-h-[1.5rem] py-0.5">
                            {line.trim() ? <MathRenderer content={line} /> : <div className="h-2" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Student's Uploaded Handwritten Work Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>Ảnh bài làm viết tay của học sinh ({imageGalleryUrls.length} trang):</span>
                      </h5>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Bấm vào trang để xem phóng to
                      </span>
                    </div>

                    {imageGalleryUrls.length === 0 ? (
                      <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center text-slate-500 text-xs">
                        {activeEssayAnswer?.typedSolution?.trim() ? (
                          <span className="text-indigo-700 font-medium">
                            ✍️ Thí sinh đã nộp bài giải trực tiếp bằng công cụ MathType ở khung trên (không đính kèm thêm ảnh viết tay).
                          </span>
                        ) : (
                          'Học sinh chưa tải ảnh bài làm lên cho câu hỏi này.'
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Thumbnail selector */}
                        {imageGalleryUrls.length > 1 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {imageGalleryUrls.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveImageIndex(idx)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                                  activeImageIndex === idx
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                Trang {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Large Image Preview Card */}
                        <div className="p-2 rounded-2xl bg-slate-950 border border-slate-800 shadow-md flex flex-col items-center justify-center relative group">
                          <img
                            src={imageGalleryUrls[activeImageIndex] || imageGalleryUrls[0]}
                            alt={`Bài làm trang ${activeImageIndex + 1}`}
                            className={`max-h-96 object-contain rounded-xl bg-white transition-all ${
                              isZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'
                            }`}
                            onClick={() => setIsZoomed(!isZoomed)}
                          />
                          <div className="mt-2 text-center text-slate-400 text-[11px] flex items-center gap-2">
                            <span>Trang {activeImageIndex + 1} / {imageGalleryUrls.length}</span>
                            <span>•</span>
                            <span>Bấm ảnh để {isZoomed ? 'thu nhỏ' : 'phóng to'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Grading Status & Action */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded">
                          Đánh giá từ AI Gemini Vision
                        </span>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="text-xl font-black text-slate-900">
                            Điểm AI chấm:{' '}
                            <span className="text-emerald-600 font-mono">
                              {currentGrading ? `${currentGrading.totalScore.toFixed(2)}đ` : 'Chưa chấm'}
                            </span>
                            <span className="text-xs text-slate-400 font-normal"> / {activeEssay.maxPoints}đ</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGradeWithAI}
                        disabled={isGradingSingle || imageGalleryUrls.length === 0}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isGradingSingle ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI đang chấm theo barem...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>{currentGrading ? 'Chấm Lại Bằng AI' : 'Gửi AI Gemini Chấm Điểm'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* AI Rubric Evaluation details */}
                    {currentGrading && (
                      <div className="space-y-3 pt-3 border-t border-slate-200 text-xs">
                        {/* High school compliance check */}
                        {currentGrading.universityMethodDetected ? (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold text-xs text-rose-900">
                                Phát hiện kiến thức Đại học (Quy tắc L'Hôpital / ngoài SGK THPT)
                              </div>
                              <p className="text-[11px] text-rose-800 mt-0.5">
                                {currentGrading.universityMethodDetails || 'Học sinh dùng công thức vượt cấp không thuộc quy chế THPT.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Lời giải tuân thủ 100% chuẩn kiến thức SGK GDPT 2018.</span>
                          </div>
                        )}

                        {/* OCR Transcription */}
                        {currentGrading.ocrTranscription && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                            <span className="font-bold text-slate-700 block">Văn bản & công thức AI nhận diện (OCR):</span>
                            <p className="font-mono text-slate-800 bg-slate-50 p-2 rounded-lg leading-relaxed whitespace-pre-wrap text-[11px]">
                              {currentGrading.ocrTranscription}
                            </p>
                          </div>
                        )}

                        {/* Step by step rubric breakdown */}
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-700 block">Đối chiếu từng bước theo barem:</span>
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                            {currentGrading.rubricEvaluation?.map((st, sIdx) => (
                              <div key={sIdx} className="p-3 flex items-start justify-between gap-3 text-xs">
                                <div className="flex-1">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className={st.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                                      {st.isCorrect ? '✓' : '✗'}
                                    </span>
                                    <span>{st.stepTitle}</span>
                                  </div>
                                  <p className="text-slate-600 mt-0.5 text-[11px]">
                                    <MathRenderer content={st.comment} />
                                  </p>
                                </div>
                                <div className="font-mono font-black text-sm shrink-0">
                                  <span className={st.awardedPoints > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {st.awardedPoints}
                                  </span>
                                  <span className="text-slate-400 font-normal"> / {st.maxStepPoints}đ</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* AI final note */}
                        <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-xs">
                          <span className="font-bold block mb-1">Lời phê tổng quát của AI:</span>
                          <p className="italic leading-relaxed">{currentGrading.finalTeacherNote}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TEACHER OVERRIDE & FEEDBACK FORM */}
                  <div className="p-5 rounded-3xl bg-indigo-950 text-white shadow-xl border border-indigo-900 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full">
                            Khu Vực Thẩm Định Của Giáo Viên
                          </span>
                          {currentOverride && (
                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                              Đã sửa: {currentOverride.teacherScore}đ
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-white mt-1">
                          Điều Chỉnh Điểm & Thêm Lời Phê Của Giáo Viên
                        </h4>
                        <p className="text-xs text-indigo-200 mt-0.5">
                          Thầy/Cô có quyền ghi đè toàn bộ điểm số của AI. Dữ liệu này sẽ được dùng để hiệu chuẩn mô hình Gemini cho các đề thi tiếp theo.
                        </p>
                      </div>

                      {currentOverride && (
                        <button
                          type="button"
                          onClick={handleResetToAiScore}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Khôi Phục Điểm AI
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Teacher Score Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-indigo-200 block">
                          Điểm số Giáo viên phê duyệt: <span className="text-amber-400">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={activeEssay.maxPoints}
                            value={overrideScore}
                            onChange={(e) => setOverrideScore(Number(e.target.value))}
                            className="w-32 px-4 py-2.5 rounded-xl font-mono text-xl font-black bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                          />
                          <span className="text-sm font-bold text-indigo-200">
                            / {activeEssay.maxPoints} điểm tối đa
                          </span>
                        </div>
                      </div>

                      {/* Override Reason */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-indigo-200 block">
                          Lý do điều chỉnh điểm:
                        </label>
                        <select
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value as any)}
                          className="w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white border border-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="ai_too_strict">AI chấm quá khắt khe (Cần cộng điểm)</option>
                          <option value="ai_too_lenient">AI chấm quá nới lỏng (Cần trừ điểm)</option>
                          <option value="ocr_misread">OCR nhận diện nhầm chữ viết tay / ký hiệu toán</option>
                          <option value="alternative_valid_method">Học sinh dùng cách giải khác hợp lệ</option>
                          <option value="partial_credit">Cộng điểm khuyến khích lập luận tốt</option>
                          <option value="other">Lý do chuyên môn khác</option>
                        </select>
                      </div>
                    </div>

                    {/* Teacher Feedback Textarea */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-indigo-200 flex items-center justify-between">
                        <span>Lời phê & Nhận xét sư phạm của Giáo viên gửi cho học sinh:</span>
                        <span className="text-[10px] text-amber-300 font-mono">(Dùng làm golden feedback cho AI)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={teacherFeedback}
                        onChange={(e) => setTeacherFeedback(e.target.value)}
                        placeholder="Thầy/Cô ghi nhận xét chi tiết: khen ngợi lập luận tốt, nhắc nhở lỗi tính toán hoặc giải thích vì sao được cộng/trừ điểm..."
                        className="w-full p-3 rounded-2xl text-xs font-medium bg-slate-900/90 text-white border border-indigo-800 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-500 leading-relaxed"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[11px] text-indigo-300 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Điểm và lời phê sẽ lập tức cập nhật vào Sổ điểm & Bài làm học sinh.</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveTeacherOverride}
                        disabled={isSavingOverride}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingOverride ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Đang lưu điều chỉnh...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Lưu Điều Chỉnh & Đồng Bộ Cloud Firestore</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Hãy chọn một học sinh trong danh sách bên trái để duyệt chấm bài tự luận</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AI CALIBRATION & PROMPT TUNING HUB */}
        {activeTab === 'calibration' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Mẫu Đã Hiệu Chuẩn</span>
                <div className="text-2xl font-black text-slate-900 font-mono">{totalCalibrated}</div>
                <p className="text-[11px] text-slate-500">Từ các lần chấm bài thực tế</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-indigo-700">Tỷ Lệ Tương Đồng AI - GV</span>
                <div className="text-2xl font-black text-indigo-600 font-mono">{agreementRate}%</div>
                <p className="text-[11px] text-slate-500">Sai lệch trong ngưỡng 0.25đ</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-700">Độ Lệch Điểm TB (Δ)</span>
                <div className="text-2xl font-black text-amber-600 font-mono">{avgDelta > '0' ? `+${avgDelta}` : avgDelta}đ</div>
                <p className="text-[11px] text-slate-500">Giáo viên thường cộng thêm điểm</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5" /> Prompt Tuning Status
                </span>
                <div className="text-xs font-bold text-emerald-300">🟢 Đang hoạt động (Few-Shot Active)</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Các bài chấm tiếp theo sẽ tự động nạp tiêu chuẩn này vào prompt.
                </p>
              </div>
            </div>

            {/* Prompt Tuning & Fine-Tuning Export Actions */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h4 className="font-black text-slate-900 text-sm sm:text-base">
                    Xuất Bộ Dữ Liệu Huấn Luyện AI (Gemini SFT Dataset)
                  </h4>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Toàn bộ các điều chỉnh của Giáo viên được xuất ra file <b>.jsonl</b> chuẩn Google AI Studio. Thầy/Cô có thể nạp trực tiếp vào tab <b>Model Tuning</b> để tinh chỉnh mô hình Gemini chuyên sâu theo phong cách chấm thi của trường.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadFinetuningJsonl}
                  disabled={totalCalibrated === 0}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:bg-slate-300"
                >
                  <Download className="w-4 h-4" /> Tải Dataset .JSONL ({totalCalibrated} mẫu)
                </button>
              </div>
            </div>

            {/* Calibrations Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="font-black text-slate-900 text-sm">
                  Lịch Sử Các Lần Hiệu Chuẩn Tiêu Chuẩn Chấm Của Giáo Viên ({totalCalibrated}):
                </h4>
                <span className="text-xs text-slate-400 font-medium">Lưu trữ Cloud Firestore</span>
              </div>

              {calibrations.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Chưa có lần sửa điểm nào được ghi nhận. Khi Thầy/Cô bấm "Lưu Điều Chỉnh" ở Tab Duyệt Chấm, dữ liệu sẽ tự động xuất hiện tại đây.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3 w-40">Thí Sinh & Lớp</th>
                        <th className="p-3 w-28 text-center">Điểm AI</th>
                        <th className="p-3 w-28 text-center bg-indigo-50">Điểm GV Sửa</th>
                        <th className="p-3 w-20 text-center">Độ Lệch</th>
                        <th className="p-3 w-48">Lý Do Điều Chỉnh</th>
                        <th className="p-3">Lời Phê Sư Phạm Chuẩn</th>
                        <th className="p-3 w-20 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {calibrations.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">
                            <div>{item.studentName}</div>
                            <span className="text-[11px] text-slate-400 font-normal">Lớp {item.studentClass}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700">
                            {item.aiScore.toFixed(2)}đ
                          </td>
                          <td className="p-3 text-center font-mono font-black text-indigo-700 bg-indigo-50/40">
                            {item.teacherScore.toFixed(2)}đ
                          </td>
                          <td className="p-3 text-center font-mono font-black">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] ${
                                item.scoreDelta > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.scoreDelta < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-medium">
                            {item.reason}
                          </td>
                          <td className="p-3 text-slate-800 italic leading-relaxed">
                            "{item.teacherFeedback || 'Không có ghi chú'}"
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteCalibrationFeedbackFromFirestore(item.id);
                                setCalibrations((prev) => prev.filter((c) => c.id !== item.id));
                                if (showToast) showToast('Đã xóa mẫu hiệu chuẩn.', 'info');
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Xóa mẫu hiệu chuẩn này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
