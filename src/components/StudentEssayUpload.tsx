import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileText,
  Clock,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Eye,
  BookOpen,
  Trash2,
  Plus,
  Image as ImageIcon
} from 'lucide-react';
import { EssayQuestion, EssayGradingResult } from '../types/exam';
import { uploadToFirebaseStorage, gradeEssayApi } from '../services/api';
import { createHandwrittenMathSvg } from '../data/defaultExam';
import { MathRenderer } from './MathRenderer';
import { QuestionVisual } from './QuestionVisual';

export interface PageImageItem {
  id: string;
  url: string;
  base64?: string;
  fileName?: string;
  storageUrl?: string;
}

interface StudentEssayUploadProps {
  essay: EssayQuestion;
  studentName: string;
  studentClass: string;
  onGraded?: (result: EssayGradingResult, imageUrl: string, imageUrls?: string[]) => void;
  existingResult?: EssayGradingResult;
  existingImageUrl?: string;
  existingImageUrls?: string[];
  backendUrl?: string;
  disabled?: boolean;
}

export const StudentEssayUpload: React.FC<StudentEssayUploadProps> = ({
  essay,
  studentName,
  studentClass,
  onGraded,
  existingResult,
  existingImageUrl,
  existingImageUrls,
  backendUrl = '',
  disabled = false,
}) => {
  // State: Multiple images for handwritten essay submission (Trang 1, Trang 2...)
  const [imageList, setImageList] = useState<PageImageItem[]>(() => {
    if (existingImageUrls && existingImageUrls.length > 0) {
      return existingImageUrls.map((url, idx) => ({
        id: `page-${idx + 1}-${Date.now()}`,
        url,
        base64: url,
        fileName: `Trang ${idx + 1}`
      }));
    }
    if (existingImageUrl) {
      return [{
        id: `page-1-${Date.now()}`,
        url: existingImageUrl,
        base64: existingImageUrl,
        fileName: 'Trang 1'
      }];
    }
    return [];
  });

  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingStepText, setGradingStepText] = useState<string>('');
  const [gradingResult, setGradingResult] = useState<EssayGradingResult | null>(existingResult || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera & File input refs
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Handle Multiple File Upload from Library
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(10);

    try {
      const newItems: PageImageItem[] = [];
      const total = files.length;

      for (let i = 0; i < total; i++) {
        const file = files[i];
        const pageNumber = imageList.length + i + 1;
        const storagePath = `submissions/${studentClass}_${studentName.replace(/\s+/g, '_')}_p${pageNumber}_${Date.now()}.jpg`;

        // Upload to Storage
        const uploadResult = await uploadToFirebaseStorage(file, storagePath, (progress) => {
          const overall = Math.round(((i + progress / 100) / total) * 100);
          setUploadProgress(overall);
        });

        newItems.push({
          id: `page-${pageNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: uploadResult.base64,
          base64: uploadResult.base64,
          storageUrl: uploadResult.downloadUrl,
          fileName: `Trang ${pageNumber}`
        });
      }

      setImageList((prev) => {
        const updated = [...prev, ...newItems];
        if (onGraded && updated.length > 0) {
          const allUrls = updated.map(item => item.url);
          onGraded(gradingResult as any, allUrls[0], allUrls);
        }
        return updated;
      });
      setSelectedPreviewIndex(imageList.length);
    } catch (err: any) {
      console.error('Upload files failed:', err);
      setErrorMessage(err.message || 'Lỗi khi tải ảnh bài làm lên hệ thống.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Start Live Camera
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMessage('Không thể mở camera. Vui lòng cấp quyền truy cập camera hoặc chọn tải ảnh từ thiết bị.');
      setIsCameraActive(false);
    }
  };

  // Capture Photo from Camera as Next Page
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          stopCamera();
          const pageNumber = imageList.length + 1;
          const file = new File([blob], `bai_lam_p${pageNumber}_${Date.now()}.jpg`, { type: 'image/jpeg' });

          setIsUploading(true);
          try {
            const storagePath = `submissions/${studentClass}_${studentName.replace(/\s+/g, '_')}_p${pageNumber}_${Date.now()}.jpg`;
            const uploadResult = await uploadToFirebaseStorage(file, storagePath, (progress) => {
              setUploadProgress(progress);
            });

            const newItem: PageImageItem = {
              id: `page-${pageNumber}-${Date.now()}`,
              url: uploadResult.base64,
              base64: uploadResult.base64,
              storageUrl: uploadResult.downloadUrl,
              fileName: `Trang ${pageNumber}`
            };

            setImageList((prev) => {
              const updated = [...prev, newItem];
              if (onGraded && updated.length > 0) {
                const allUrls = updated.map(item => item.url);
                onGraded(gradingResult as any, allUrls[0], allUrls);
              }
              return updated;
            });
            setSelectedPreviewIndex(imageList.length);
          } catch (e: any) {
            setErrorMessage('Lỗi khi lưu ảnh chụp từ camera: ' + (e.message || String(e)));
          } finally {
            setIsUploading(false);
          }
        }
      }, 'image/jpeg', 0.92);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // 3. Remove a Page (Nút xóa nếu chụp mờ)
  const handleRemovePage = (indexToRemove: number) => {
    if (disabled) return;
    setImageList((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (selectedPreviewIndex >= updated.length) {
        setSelectedPreviewIndex(Math.max(0, updated.length - 1));
      }
      if (onGraded && updated.length > 0) {
        const allUrls = updated.map(item => item.url);
        onGraded(gradingResult as any, allUrls[0], allUrls);
      }
      return updated;
    });
  };

  // 4. Select Sample Handwritten Solution
  const handleSelectSample = async (type: 'perfect' | 'university_error' | 'calculation_error') => {
    setErrorMessage(null);
    const dataUrl = createHandwrittenMathSvg(type);
    const sampleItem: PageImageItem = {
      id: `sample-${Date.now()}`,
      url: dataUrl,
      base64: dataUrl,
      fileName: `Trang mẫu (${type === 'perfect' ? '10 điểm' : type === 'university_error' ? 'L Hôpital' : 'Sai dấu'})`
    };
    setImageList([sampleItem]);
    setSelectedPreviewIndex(0);
    setGradingResult(null);

    if (onGraded) {
      onGraded(null as any, dataUrl, [dataUrl]);
    }
  };

  // 5. Trigger AI Grading
  const handleGradeWithAI = async () => {
    if (imageList.length === 0) {
      setErrorMessage('Vui lòng tải lên ít nhất một trang ảnh bài làm viết tay.');
      return;
    }

    try {
      setIsGrading(true);
      setErrorMessage(null);
      setGradingStepText('Đang nạp ảnh bài làm vào hệ thống AI Gemini Vision...');

      const primaryImage = imageList[selectedPreviewIndex] || imageList[0];

      let result: EssayGradingResult;

      if (backendUrl) {
        // Optional FastAPI grading
        const response = await fetch(`${backendUrl}/api/v1/grade-math-essay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: primaryImage.storageUrl || '',
            image_base64: primaryImage.base64 || primaryImage.url,
            question_text: essay.question,
            max_points: essay.maxPoints,
            rubric: essay.rubric,
            student_name: studentName,
            student_class: studentClass,
          }),
        });

        if (!response.ok) {
          throw new Error(`Python Backend Error: ${response.statusText}`);
        }

        const pyData = await response.json();
        result = {
          ocrTranscription: pyData.ocr_transcription,
          detectedSteps: pyData.detected_steps,
          rubricEvaluation: pyData.rubric_evaluation.map((item: any) => ({
            stepTitle: item.step_name,
            maxStepPoints: item.max_score,
            awardedPoints: item.awarded_score,
            isCorrect: item.is_correct,
            comment: item.comment
          })),
          universityMethodDetected: pyData.university_method_detected,
          universityMethodDetails: pyData.university_method_details,
          strengths: pyData.strengths,
          weaknesses: pyData.weaknesses,
          totalScore: pyData.total_score,
          maxPoints: pyData.max_score,
          finalTeacherNote: pyData.final_teacher_note
        };
      } else {
        // Default: Use integrated Node/Express Gemini Vision
        result = await gradeEssayApi({
          imageUrl: primaryImage.storageUrl || undefined,
          imageBase64: primaryImage.base64 || primaryImage.url,
          questionText: essay.question,
          maxPoints: essay.maxPoints,
          rubric: essay.rubric,
          studentName,
          studentClass,
        });
      }

      setGradingResult(result);
      if (onGraded) {
        const allUrls = imageList.map(item => item.url);
        onGraded(result, primaryImage.url, allUrls);
      }
    } catch (err: any) {
      console.error('Grading error:', err);
      setErrorMessage(err.message || 'Lỗi khi gọi AI chấm bài tự luận');
    } finally {
      setIsGrading(false);
      setGradingStepText('');
    }
  };

  const activeImage = imageList[selectedPreviewIndex] || imageList[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
      {/* Header: Question Title & Max Points */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              Phần III: Tự luận Toán
            </span>
            <span className="text-xs text-slate-600 font-bold">Thang điểm: {essay.maxPoints}đ</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
            Câu hỏi tự luận & Nộp bài viết tay
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Chuẩn SGK GDPT 2018
          </span>
        </div>
      </div>

      {/* Question Text */}
      <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
        <MathRenderer content={essay.question} className="text-base sm:text-lg leading-relaxed text-slate-900" />
      </div>

      {/* Visual Diagram if available */}
      {essay.visualType && (
        <QuestionVisual
          visualType={essay.visualType}
          caption={essay.visualCaption}
          questionText={essay.question}
        />
      )}

      {/* Attached image if available */}
      {essay.customImageUrl && (
        <div className="my-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs text-center">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
            📷 Hình vẽ câu hỏi từ đề gốc:
          </span>
          <img
            src={essay.customImageUrl}
            alt="Hình vẽ câu hỏi"
            className="max-h-64 object-contain mx-auto rounded-lg border border-slate-100"
          />
        </div>
      )}

      {/* Rubric Preview (Barem ghi chú thang điểm) */}
      <div className="mb-6 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs">
        <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          Barem chấm điểm từng bước (Thang điểm: {essay.maxPoints}đ):
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {essay.rubric.map((r, idx) => (
            <div key={idx} className="bg-white p-2.5 rounded-lg border border-emerald-100 text-slate-700 font-medium">
              <span className="font-extrabold text-emerald-800">{r.step}</span> ({r.points}đ):{' '}
              <MathRenderer content={r.description} />
            </div>
          ))}
        </div>
      </div>

      {/* Camera Live Stream */}
      {isCameraActive && (
        <div className="mb-6 p-4 rounded-2xl bg-slate-950 text-white shadow-xl border border-slate-800">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold flex items-center gap-2 text-emerald-400">
              <Camera className="w-4 h-4" /> Camera Chụp Bài Làm (Trang {imageList.length + 1})
            </span>
            <button
              onClick={stopCamera}
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 transition-colors cursor-pointer"
            >
              Đóng Camera
            </button>
          </div>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-80 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={capturePhoto}
              className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 font-black text-white text-sm shadow-lg flex items-center gap-2 cursor-pointer transition-all"
            >
              <Camera className="w-4 h-4" /> Chụp Trang Này Ngay
            </button>
          </div>
        </div>
      )}

      {/* MULTIPLE IMAGE UPLOAD ZONE */}
      <div className="space-y-4">
        {/* Upload Action Bar */}
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 hover:border-indigo-400 transition-colors">
          {/* File picker input for image library */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFilesChange}
          />
          {/* Camera direct input for mobile devices */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFilesChange}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm sm:text-base">
                  Khu Vực Tải Ảnh Bài Làm Viết Tay
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cho phép nộp <b>nhiều ảnh</b> (Trang 1, Trang 2...). Hỗ trợ chọn từ thư viện hoặc chụp camera trực tiếp.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end">
              {/* Nút 1: Chọn ảnh từ thư viện */}
              <button
                type="button"
                onClick={() => !disabled && fileInputRef.current?.click()}
                disabled={disabled || isUploading || isGrading}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" /> Chọn ảnh từ thư viện
              </button>

              {/* Nút 2: Chụp ảnh bài làm (Chỉ mở camera khi học sinh bấm vào) */}
              <button
                type="button"
                onClick={() => {
                  if (disabled || isUploading || isGrading) return;
                  // On mobile touch devices, trigger native camera file input for instant full-resolution capture
                  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && cameraInputRef.current) {
                    cameraInputRef.current.click();
                  } else {
                    startCamera();
                  }
                }}
                disabled={disabled || isUploading || isGrading}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Camera className="w-4 h-4" /> Chụp ảnh bài làm
              </button>
            </div>
          </div>

          {/* Quick sample buttons for test/demo */}
          <div className="mt-4 pt-3 border-t border-indigo-100/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Hoặc thử nhanh bài mẫu viết tay:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => !disabled && handleSelectSample('perfect')}
                disabled={disabled}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 text-emerald-700 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Bài mẫu 10đ
              </button>
              <button
                type="button"
                onClick={() => !disabled && handleSelectSample('university_error')}
                disabled={disabled}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-rose-500 text-rose-700 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Vi phạm L'Hôpital
              </button>
              <button
                type="button"
                onClick={() => !disabled && handleSelectSample('calculation_error')}
                disabled={disabled}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-amber-500 text-amber-700 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Sai tính toán
              </button>
            </div>
          </div>
        </div>

        {/* Uploading progress bar */}
        {isUploading && (
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs space-y-1">
            <div className="flex justify-between font-bold text-indigo-700">
              <span>Đang tải và tối ưu hóa ảnh bài làm...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* THUMBNAIL STRIP & PREVIEW (Khung thumbnail xem trước các trang đã chụp và nút xóa nếu chụp mờ) */}
        {imageList.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                Các trang bài làm đã nộp ({imageList.length} trang)
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Bấm vào trang để phóng to • Có nút xóa trang nếu chụp mờ
              </span>
            </div>

            {/* Thumbnail cards list */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {imageList.map((img, idx) => {
                const isSelected = idx === selectedPreviewIndex;
                return (
                  <div
                    key={img.id}
                    onClick={() => setSelectedPreviewIndex(idx)}
                    className={`relative rounded-xl border-2 p-1.5 cursor-pointer transition-all bg-white group ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-sm'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="aspect-3/4 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center relative">
                      <img
                        src={img.url}
                        alt={`Trang ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 bg-slate-900/80 text-white font-black text-[10px] px-1.5 py-0.5 rounded backdrop-blur-xs">
                        Trang {idx + 1}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {img.fileName || `Trang ${idx + 1}`}
                      </span>

                      {/* Nút xóa nếu chụp mờ */}
                      {!disabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePage(idx);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa trang này nếu chụp mờ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Enlarged Preview of Selected Page */}
            {activeImage && (
              <div className="mt-4 p-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-xs text-white pb-2 mb-2 border-b border-slate-800 px-2">
                  <span className="font-bold flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-sky-400" />
                    Xem trước: <b>Trang {selectedPreviewIndex + 1} / {imageList.length}</b>
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemovePage(selectedPreviewIndex)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa trang này nếu mờ
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2">
                  <img
                    src={activeImage.url}
                    alt={`Phóng to trang ${selectedPreviewIndex + 1}`}
                    className="max-h-80 object-contain rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* AI Grading Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGradeWithAI}
                disabled={disabled || isGrading}
                className="w-full py-3.5 px-4 rounded-xl font-black text-white text-sm shadow-md transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGrading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Gemini Vision đang đối chiếu barem và chấm bài...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Gửi AI Chấm Tự Luận Theo Barem Chi Tiết</span>
                  </>
                )}
              </button>

              {isGrading && (
                <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 animate-pulse flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>{gradingStepText || 'Đang quét nét chữ và nhận diện công thức toán...'}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold">Chưa có ảnh bài làm tự luận nào được tải lên</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Bấm nút "Chọn ảnh từ máy" hoặc "Mở Camera chụp" ở trên để nộp bài
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* AI Grading Results */}
      {gradingResult && (
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-slate-900 text-white gap-3 shadow-md">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
                Kết Quả Chấm Tự Luận Bằng AI Gemini Vision
              </span>
              <h4 className="text-base font-bold text-white mt-0.5">
                Thí sinh: {studentName} ({studentClass})
              </h4>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Điểm tự luận đạt:</span>
                <div className="text-2xl font-black text-emerald-400">
                  {gradingResult.totalScore.toFixed(2)}
                  <span className="text-sm font-normal text-slate-400"> / {gradingResult.maxPoints}đ</span>
                </div>
              </div>
            </div>
          </div>

          {/* High school compliance check */}
          {gradingResult.universityMethodDetected ? (
            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-sm text-rose-900">
                  🚨 PHÁT HIỆN KIẾN THỨC ĐẠI HỌC NGOÀI QUY CHẾ SGK CẤP 3!
                </h5>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  {gradingResult.universityMethodDetails ||
                    "Học sinh đã sử dụng quy tắc Đại học (như L'Hôpital) không thuộc SGK THPT hiện hành. Bước này không được công nhận điểm."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>✅ Lời giải tuân thủ 100% chuẩn kiến thức SGK GDPT 2018.</span>
            </div>
          )}

          {/* OCR text */}
          {gradingResult.ocrTranscription && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                Văn bản và công thức AI nhận diện từ ảnh viết tay (OCR):
              </div>
              <p className="font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed whitespace-pre-wrap">
                {gradingResult.ocrTranscription}
              </p>
            </div>
          )}

          {/* Rubric table */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Bảng đối chiếu điểm từng bước theo barem:
            </h5>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2.5 w-1/4">Bước theo Barem</th>
                    <th className="p-2.5 w-20 text-center">Tối đa</th>
                    <th className="p-2.5 w-20 text-center">Đạt được</th>
                    <th className="p-2.5">Nhận xét chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {gradingResult.rubricEvaluation.map((item, idx) => (
                    <tr key={idx} className={item.isCorrect ? 'hover:bg-slate-50' : 'bg-rose-50/30'}>
                      <td className="p-2.5 font-medium text-slate-800">{item.stepTitle}</td>
                      <td className="p-2.5 text-center text-slate-600 font-mono">{item.maxStepPoints}đ</td>
                      <td className="p-2.5 text-center font-bold font-mono">
                        <span
                          className={
                            item.awardedPoints === item.maxStepPoints
                              ? 'text-emerald-600'
                              : item.awardedPoints > 0
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }
                        >
                          {item.awardedPoints}đ
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700 leading-relaxed">
                        <MathRenderer content={item.comment} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
