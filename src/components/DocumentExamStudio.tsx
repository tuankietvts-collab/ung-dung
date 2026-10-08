import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Copy,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Share2,
  Layers,
  GraduationCap
} from 'lucide-react';
import { Exam } from '../types/exam';
import { prepareDocumentPayload, digitizeDocumentApi, DocumentQuestionItem } from '../services/api';
import { detectGradeFromFileName } from '../services/fileUploadService';
import { MathRenderer } from './MathRenderer';

interface DocumentExamStudioProps {
  onExamCreated?: (exam: Exam) => void;
  onOpenExamRoom?: (exam: Exam) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentExamStudio: React.FC<DocumentExamStudioProps> = ({
  onExamCreated,
  onOpenExamRoom,
  showToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [targetGrade, setTargetGrade] = useState<string>('11');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<DocumentQuestionItem[]>([]);
  const [generatedExam, setGeneratedExam] = useState<Exam | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [scoreResult, setScoreResult] = useState<{ correct: number; total: number; score: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quizTopRef = useRef<HTMLDivElement | null>(null);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFileName(file.name);
      setStatusMessage(null);
      const detected = detectGradeFromFileName(file.name);
      if (detected) {
        setTargetGrade(detected);
      }
    }
  };

  // Quick sample test (Grade 11 Curriculum)
  const handleUseSampleExam = () => {
    const sampleQuestions: DocumentQuestionItem[] = [
      {
        id: 1,
        question: 'Tập giá trị của hàm số lượng giác $y = \\sin 2x$ là:',
        options: ['A. $[-1; 1]$', 'B. $[-2; 2]$', 'C. $[0; 1]$', 'D. $\\mathbb{R}$'],
        correctAnswer: 'A',
        explanation: 'Với mọi $x \\in \\mathbb{R}$, ta luôn có $-1 \\le \\sin 2x \\le 1$. Do đó tập giá trị của hàm số là đoạn $[-1; 1]$.'
      },
      {
        id: 2,
        question: 'Cho cấp số cộng $(u_n)$ có số hạng đầu $u_1 = 3$ và công sai $d = 4$. Số hạng thứ hai $u_2$ bằng:',
        options: ['A. $7$', 'B. $12$', 'C. $-1$', 'D. $8$'],
        correctAnswer: 'A',
        explanation: 'Theo công thức số hạng tổng quát của cấp số cộng: $u_2 = u_1 + d = 3 + 4 = 7$.'
      },
      {
        id: 3,
        question: 'Tính giới hạn dãy số $L = \\lim \\dfrac{2n + 1}{n + 3}$:',
        options: ['A. $2$', 'B. $\\dfrac{1}{3}$', 'C. $0$', 'D. $+\\infty$'],
        correctAnswer: 'A',
        explanation: 'Chia cả tử và mẫu cho $n$: $\\lim \\dfrac{2 + \\frac{1}{n}}{1 + \\frac{3}{n}} = \\dfrac{2+0}{1+0} = 2$.'
      },
      {
        id: 4,
        question: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình bình hành. Giao tuyến của hai mặt phẳng $(SAB)$ và $(SCD)$ là:',
        options: [
          'A. Đường thẳng đi qua $S$ và song song với $AB$ và $CD$',
          'B. Đường thẳng $SO$ với $O$ là tâm hình bình hành',
          'C. Đường thẳng đi qua $S$ và vuông góc với mặt phẳng đáy',
          'D. Đường chéo $AC$'
        ],
        correctAnswer: 'A',
        explanation: 'Hai mặt phẳng $(SAB)$ và $(SCD)$ chứa hai đường thẳng song song $AB \\parallel CD$ và có điểm chung $S$, do đó giao tuyến là đường thẳng đi qua $S$ và song song với $AB, CD$.'
      }
    ];

    const sampleExam: Exam = {
      id: `exam-${Date.now()}`,
      title: 'ĐỀ THI TOÁN LỚP 11 - LƯỢNG GIÁC, DÃY SỐ & HÌNH KHÔNG GIAN',
      examCode: 'TOAN11-SAMPLE',
      grade: '11',
      durationMinutes: 45,
      totalPoints: 10,
      textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
      topic: 'Lượng giác, Cấp số cộng/nhân, Giới hạn & Hình học không gian',
      createdAt: new Date().toISOString().split('T')[0],
      multipleChoice: sampleQuestions.map((q, idx) => ({
        id: `mc_${idx + 1}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer as any,
        points: 2.5,
        explanation: q.explanation
      })),
      trueFalseQuestions: [],
      essays: []
    };

    setTargetGrade('11');
    setQuizQuestions(sampleQuestions);
    setGeneratedExam(sampleExam);
    setUserAnswers({});
    setIsSubmitted(false);
    setScoreResult(null);
    setFileName('MaTran_DeThi_Toan11.docx');
    setStatusMessage({ text: 'Đã nạp đề thi mẫu môn Toán Lớp 11 chuẩn GDPT 2018 thành công!', type: 'success' });
    if (showToast) showToast('Đã mở đề thi mẫu Toán 11. Bạn có thể làm bài và nộp bài ngay!');
  };

  // Generate exam from uploaded file
  const handleGenerateExam = async () => {
    if (!selectedFile) {
      setStatusMessage({ text: 'Vui lòng chọn một file đề thi trước (.pdf, .docx, .xlsx, ảnh hoặc .txt).', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage({ text: 'Đang đọc nội dung và số hóa công thức toán qua Gemini AI...', type: 'info' });
    setUserAnswers({});
    setIsSubmitted(false);
    setScoreResult(null);

    try {
      const payload = await prepareDocumentPayload(selectedFile);
      const result = await digitizeDocumentApi({
        fileName: payload.fileName,
        fileBase64: payload.fileBase64,
        mimeType: payload.mimeType,
        extractedText: payload.extractedText,
        targetGrade,
      });

      if (!result.quizData || result.quizData.length === 0) {
        throw new Error('AI không tìm thấy câu hỏi trắc nghiệm trong tài liệu. Vui lòng kiểm tra lại nội dung file.');
      }

      setQuizQuestions(result.quizData);
      setGeneratedExam(result.exam);
      setStatusMessage({ text: `Đã số hóa thành công ${result.quizData.length} câu hỏi từ tài liệu!`, type: 'success' });

      if (onExamCreated && result.exam) {
        onExamCreated(result.exam);
      }

      if (showToast) {
        showToast(`Đã số hóa thành công ${result.quizData.length} câu hỏi từ file "${selectedFile.name}"!`);
      }

      setTimeout(() => {
        quizTopRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err: any) {
      console.error('Document digitization error:', err);
      setStatusMessage({ text: err.message || 'Lỗi khi đọc file hoặc số hóa câu hỏi.', type: 'error' });
      if (showToast) {
        showToast(err.message || 'Lỗi khi số hóa file', 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle select answer
  const handleSelectAnswer = (questionIdx: number, selectedOptionLetter: string) => {
    if (isSubmitted) return; // Prevent changing after submission
    setUserAnswers((prev) => ({
      ...prev,
      [questionIdx]: selectedOptionLetter,
    }));
  };

  // Handle submit quiz
  const handleSubmitQuiz = () => {
    if (quizQuestions.length === 0) return;

    let correctCount = 0;
    quizQuestions.forEach((q, idx) => {
      const chosen = userAnswers[idx];
      const correct = (q.correctAnswer || '').trim().toUpperCase().slice(0, 1);
      if (chosen && chosen.toUpperCase() === correct) {
        correctCount++;
      }
    });

    const scoreNum = Number(((correctCount / quizQuestions.length) * 10).toFixed(2));
    setScoreResult({
      correct: correctCount,
      total: quizQuestions.length,
      score: scoreNum.toFixed(2),
    });
    setIsSubmitted(true);

    if (showToast) {
      showToast(`Đã nộp bài! Bạn đạt ${scoreNum}/10 điểm (${correctCount}/${quizQuestions.length} câu đúng).`);
    }
  };

  // Reset quiz to do again
  const handleResetQuiz = () => {
    setUserAnswers({});
    setIsSubmitted(false);
    setScoreResult(null);
  };

  // Copy direct exam link for students
  const handleCopyExamLink = () => {
    if (!generatedExam) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const link = `${origin}${path}?exam=${encodeURIComponent(generatedExam.examCode)}&examId=${encodeURIComponent(generatedExam.id)}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    if (showToast) showToast(`Đã sao chép link phòng thi: ${link}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <header className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Công Nghệ AI Số Hóa Đa Định Dạng Tài Liệu GDPT 2018</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Số Hóa & Tạo Đề Thi Trực Tuyến Từ Mọi Tài Liệu
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          Tự động đọc nội dung đề từ <b className="text-blue-700">Word (.docx)</b>, <b className="text-emerald-700">Excel (.xlsx, .xls)</b>, <b className="text-rose-700">PDF</b>, <b className="text-indigo-700">Ảnh chụp đề thi</b> và chuyển thành bài kiểm tra trực tuyến có công thức Toán KaTeX chuẩn SGK.
        </p>
      </header>

      {/* File Upload Box */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">Tải tài liệu đề thi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ các định dạng: <span className="font-bold text-blue-700">.pdf, .docx, .xlsx, .xls, ảnh (.png, .jpg), .txt</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700">Khối lớp:</label>
            <select
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="10">Lớp 10</option>
              <option value="11">Lớp 11</option>
              <option value="12">Lớp 12</option>
            </select>
          </div>
        </div>

        {/* Dropzone */}
        <input
          ref={fileInputRef}
          type="file"
          id="fileInput"
          accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <label
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 cursor-pointer bg-slate-50/70 hover:bg-blue-50/40 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-blue-700 mb-2 transition-colors">
              <Upload className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-sm font-black text-slate-800 text-center truncate max-w-sm">
              {fileName || 'Bấm để chọn file từ máy tính'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Kéo thả hoặc nhấp để tải file lên (tối đa 25MB)
            </span>
          </label>

          <div className="flex flex-col gap-2 shrink-0 sm:w-56">
            <button
              type="button"
              id="btnGenerate"
              onClick={handleGenerateExam}
              disabled={isProcessing || !selectedFile}
              className="w-full py-4 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-black text-sm rounded-2xl shadow-md shadow-blue-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Số Hóa...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Tạo Đề Thi Ngay</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleUseSampleExam}
              className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
            >
              Dùng đề thi mẫu có sẵn
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200 ${
              statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* QUIZ CONTAINER */}
      {quizQuestions.length > 0 && (
        <div ref={quizTopRef} className="space-y-6 max-w-4xl mx-auto animate-in slide-in-from-bottom duration-300">
          
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {generatedExam?.title || 'Đề Thi Số Hóa'}
                </h3>
                <span className="text-xs font-bold text-indigo-700" id="totalQuestions">
                  {quizQuestions.length} câu hỏi trắc nghiệm khách quan
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isSubmitted ? (
                <button
                  type="button"
                  id="btnSubmit"
                  onClick={handleSubmitQuiz}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105"
                >
                  <Check className="w-4 h-4" />
                  <span>Nộp Bài & Chấm Điểm</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>Làm Lại</span>
                </button>
              )}

              {generatedExam && onOpenExamRoom && (
                <button
                  type="button"
                  onClick={() => onOpenExamRoom(generatedExam)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Mở đề thi trong phòng thi trực tuyến của học sinh"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Vào Phòng Thi Trực Tuyến</span>
                </button>
              )}

              {generatedExam && (
                <button
                  type="button"
                  onClick={handleCopyExamLink}
                  className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Sao chép link làm bài gửi cho học sinh"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-sky-600" />}
                  <span>{copiedLink ? 'Đã sao chép link!' : 'Gửi link vào thi'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Result Box (Appears after submission) */}
          {isSubmitted && scoreResult && (
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 p-6 sm:p-8 rounded-3xl border-2 border-emerald-300 shadow-sm text-center space-y-3 animate-in zoom-in-95 duration-200">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Kết Quả Bài Làm
              </span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Đúng <span className="text-emerald-600">{scoreResult.correct}/{scoreResult.total}</span> câu
                <span className="text-slate-400 font-light mx-2">•</span>
                <span className="text-indigo-700">{scoreResult.score}/10 điểm</span>
              </div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {Number(scoreResult.score) >= 8.0
                  ? 'Xuất sắc! Bạn đã nắm rất vững kiến thức và trả lời đúng phần lớn các câu hỏi.'
                  : Number(scoreResult.score) >= 5.0
                  ? 'Khá tốt! Hãy đối chiếu phần giải thích bên dưới để ôn tập lại những câu chưa chính xác.'
                  : 'Hãy xem kỹ các bước giải chi tiết bên dưới để bổ sung kiến thức cần thiết nhé!'}
              </p>
            </div>
          )}

          {/* Questions List */}
          <div className="space-y-5" id="questionsList">
            {quizQuestions.map((q, qIdx) => {
              const selectedLetter = userAnswers[qIdx];
              const correctLetter = (q.correctAnswer || 'A').trim().toUpperCase().slice(0, 1);
              const isCorrect = selectedLetter?.toUpperCase() === correctLetter;

              let cardBorderClass = 'border-slate-200 bg-white';
              if (isSubmitted) {
                cardBorderClass = isCorrect
                  ? 'border-emerald-400 bg-emerald-50/20'
                  : 'border-rose-300 bg-rose-50/20';
              }

              return (
                <div
                  key={q.id || qIdx}
                  id={`q-card-${qIdx}`}
                  className={`p-6 sm:p-7 rounded-3xl border transition-all shadow-sm ${cardBorderClass}`}
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-black text-xs">
                        Câu {qIdx + 1}
                      </span>
                      {isSubmitted && (
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1 ${
                            isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Đúng
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" /> Chưa đúng
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question text with KaTeX Math Renderer */}
                  <div className="font-extrabold text-slate-900 text-base leading-relaxed mb-5">
                    <MathRenderer content={q.question} />
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {q.options.map((opt, optIdx) => {
                      const optLetter = ['A', 'B', 'C', 'D'][optIdx] || opt.trim().charAt(0).toUpperCase();
                      const isChosen = selectedLetter === optLetter;
                      const isOptionCorrect = optLetter === correctLetter;

                      let optClass = 'border-slate-200 hover:bg-slate-50 text-slate-700';
                      if (isChosen && !isSubmitted) {
                        optClass = 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold';
                      } else if (isSubmitted) {
                        if (isOptionCorrect) {
                          optClass = 'border-emerald-500 bg-emerald-100/70 text-emerald-950 font-black';
                        } else if (isChosen && !isCorrect) {
                          optClass = 'border-rose-400 bg-rose-100/60 text-rose-950 font-bold';
                        }
                      }

                      return (
                        <label
                          key={optIdx}
                          onClick={() => handleSelectAnswer(qIdx, optLetter)}
                          className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${optClass}`}
                        >
                          <input
                            type="radio"
                            name={`question_${qIdx}`}
                            value={optLetter}
                            checked={isChosen}
                            disabled={isSubmitted}
                            onChange={() => handleSelectAnswer(qIdx, optLetter)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
                          />
                          <div className="text-xs sm:text-sm font-semibold leading-relaxed flex-1">
                            <MathRenderer content={opt} />
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Explanation card (Revealed on submission) */}
                  {isSubmitted && (
                    <div className="mt-4 p-4 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs text-blue-950 space-y-1.5 animate-in fade-in duration-200">
                      <div className="font-black text-blue-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Đáp án đúng: <b className="text-emerald-700 font-mono text-sm">{correctLetter}</b></span>
                      </div>
                      {q.explanation && (
                        <div className="text-slate-700 leading-relaxed font-medium pt-1">
                          <MathRenderer content={q.explanation} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Submit / Action Bar */}
          <div className="flex items-center justify-between bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 font-bold">
              Đã trả lời {Object.keys(userAnswers).length}/{quizQuestions.length} câu
            </span>

            {!isSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitQuiz}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105"
              >
                <Check className="w-4 h-4" />
                <span>Nộp Bài</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetQuiz}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Làm Lại Lần Nữa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
