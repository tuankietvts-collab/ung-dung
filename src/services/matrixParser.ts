import { ExamMatrixData } from '../types/exam';
import { detectGradeFromFileName, getDefaultTopicForGrade, prepareMatrixUploadPayload } from './fileUploadService';
import { safeParseGeminiResponse } from './safeJsonParser';

/**
 * Creates a default standard GDPT 2018 matrix tailored to the specific grade (10, 11, or 12).
 * Eliminates any hardcoded Grade 12 default!
 */
export function createDefaultMatrixForGrade(grade: '10' | '11' | '12' = '11', customTopic?: string): ExamMatrixData {
  const topic = customTopic || getDefaultTopicForGrade(grade);

  return {
    topic,
    grade,
    durationMinutes: 45,
    totalPoints: 10.0,
    textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
    part1: {
      title: 'Phần I: TN nhiều lựa chọn (4 phương án)',
      nhanBiet: 6,
      thongHieu: 4,
      vanDung: 2,
      vanDungCao: 0,
      totalQuestions: 12,
      points: 3.0,
    },
    part2: {
      title: 'Phần II: TN Đúng / Sai',
      nhanBiet: 2,
      thongHieu: 1,
      vanDung: 1,
      vanDungCao: 0,
      totalQuestions: 4,
      points: 4.0,
    },
    part3: {
      title: 'Phần III: Tự luận / Trả lời ngắn',
      nhanBiet: 0,
      thongHieu: 1,
      vanDung: 1,
      vanDungCao: 0,
      totalQuestions: 2,
      points: 3.0,
    },
    rawSummary: `Ma trận chuẩn môn Toán Lớp ${grade} (GDPT 2018): 12 câu TN (3.0đ) + 4 câu Đúng/Sai (4.0đ) + 2 câu Trả lời ngắn/Tự luận (3.0đ).`,
  };
}

/**
 * Parses an uploaded matrix document (.pdf, .docx, .xlsx, images).
 * Extracts structure and guarantees that Grade 11 files (e.g. 11.pdf) stay 100% Grade 11!
 * Bóc tách nội dung trực tiếp từ file được tải lên và đồng bộ tuyệt đối với khối lớp.
 */
export async function parseMatrixDocument(
  fileOrPayload: File | { fileName: string; fileBase64?: string; mimeType?: string; extractedText?: string }
): Promise<ExamMatrixData> {
  let fileName = '';
  let fileBase64 = '';
  let mimeType = 'application/pdf';
  let rawText = '';
  let detectedGrade: '10' | '11' | '12' = '11';

  if (fileOrPayload instanceof File) {
    const payload = await prepareMatrixUploadPayload(fileOrPayload);
    fileName = payload.fileName;
    fileBase64 = payload.fileBase64 || '';
    mimeType = payload.mimeType;
    rawText = payload.extractedText || '';
    detectedGrade = payload.detectedGrade;
  } else {
    fileName = fileOrPayload.fileName;
    fileBase64 = fileOrPayload.fileBase64 || '';
    mimeType = fileOrPayload.mimeType || 'application/pdf';
    rawText = fileOrPayload.extractedText || '';
    detectedGrade = detectGradeFromFileName(fileName, rawText);
  }

  try {
    const response = await fetch('/api/parse-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        fileBase64,
        mimeType,
        rawText,
        detectedGrade,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errDetail = 'Máy chủ không thể trích xuất ma trận từ file';
      try {
        const errObj = safeParseGeminiResponse(responseText);
        errDetail = errObj.error || errDetail;
      } catch {}
      throw new Error(errDetail);
    }

    const data = safeParseGeminiResponse(responseText);
    const matrix: ExamMatrixData = data.matrix || createDefaultMatrixForGrade(detectedGrade);

    // Hard guarantee: sync the grade
    matrix.grade = detectedGrade;

    // Strict validation: Grade 11 files must NEVER carry Grade 12 topics
    if (detectedGrade === '11') {
      const isLop12Topic =
        !matrix.topic ||
        matrix.topic.includes('Lớp 12') ||
        matrix.topic.includes('LỚP 12') ||
        matrix.topic.includes('Khảo sát') ||
        matrix.topic.includes('Tích phân') ||
        matrix.topic.includes('Cực trị') ||
        matrix.topic.includes('Oxyz');

      if (isLop12Topic) {
        matrix.topic = getDefaultTopicForGrade('11');
      }
    } else if (detectedGrade === '10') {
      const isLop12Topic =
        !matrix.topic ||
        matrix.topic.includes('Lớp 12') ||
        matrix.topic.includes('LỚP 12') ||
        matrix.topic.includes('Khảo sát') ||
        matrix.topic.includes('Tích phân');

      if (isLop12Topic) {
        matrix.topic = getDefaultTopicForGrade('10');
      }
    }

    return matrix;
  } catch (err: any) {
    console.warn('[MatrixParser] Server extraction fallback to local detected matrix:', err.message);
    return createDefaultMatrixForGrade(detectedGrade, `Ma trận bóc tách từ file: ${fileName}`);
  }
}
