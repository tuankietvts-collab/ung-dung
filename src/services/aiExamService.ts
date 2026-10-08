/**
 * aiExamService.ts
 * Dịch vụ tạo đề thi và xử lý ma trận qua Gemini API tuân thủ chuẩn cấu trúc JSON thuần túy.
 * Áp dụng cấu hình generationConfig bắt buộc và hàm safeParseGeminiResponse.
 */

import { safeParseGeminiResponse } from './safeJsonParser';
import { Exam, ExamMatrixData } from '../types/exam';

export const GEMINI_GENERATION_CONFIG = {
  responseMimeType: 'application/json',
  temperature: 0.2,
};

export const GEMINI_STRICT_JSON_INSTRUCTION =
  'CHỈ TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ. Tuyệt đối không thêm bất kỳ văn bản giải thích, lời chào hay ký tự nào ngoài cặp ngoặc nhọn { }.';

export interface GenerateExamOptions {
  mode: 'prompt' | 'matrix' | 'recreate';
  grade: string;
  topic?: string;
  textbook?: string;
  difficulty?: string;
  promptCustom?: string;
  part3Type?: 'short_answer' | 'essay';
  matrix?: ExamMatrixData;
  matrixFileBase64?: string;
  matrixFileName?: string;
  matrixMimeType?: string;
  originalExam?: Exam;
  examFileBase64?: string;
  examFileName?: string;
}

/**
 * Gửi yêu cầu tạo đề thi đến API máy chủ (nơi tích hợp Gemini API)
 * và kiểm tra kết quả qua safeParseGeminiResponse nếu nhận chuỗi thô.
 */
export async function requestGenerateExam(options: GenerateExamOptions): Promise<Exam> {
  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let errorMsg = 'Lỗi tạo đề thi từ Gemini AI';
    try {
      const errObj = safeParseGeminiResponse(rawText);
      errorMsg = errObj.error || errObj.message || errorMsg;
    } catch {
      errorMsg = rawText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const parsedData = safeParseGeminiResponse(rawText);
  return parsedData.exam || parsedData;
}

/**
 * Gửi yêu cầu trích xuất dữ liệu ma trận từ file đến API máy chủ
 */
export async function requestParseMatrix(payload: {
  fileName: string;
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
  detectedGrade?: string;
}): Promise<ExamMatrixData> {
  const response = await fetch('/api/parse-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let errorMsg = 'Lỗi trích xuất ma trận từ Gemini AI';
    try {
      const errObj = safeParseGeminiResponse(rawText);
      errorMsg = errObj.error || errObj.message || errorMsg;
    } catch {
      errorMsg = rawText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const parsedData = safeParseGeminiResponse(rawText);
  return parsedData.matrix || parsedData;
}

export { safeParseGeminiResponse };
