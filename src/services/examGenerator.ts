import { Exam, ExamMatrixData } from '../types/exam';

export interface PromptExamRequest {
  grade: string;
  topic: string;
  textbook: string;
  difficulty?: string;
  promptCustom?: string;
  part3Type?: 'short_answer' | 'essay';
}

export interface MatrixExamRequest {
  grade: string;
  topic?: string;
  textbook?: string;
  matrix: ExamMatrixData;
  part3Type?: 'short_answer' | 'essay';
  matrixFileBase64?: string;
  matrixFileName?: string;
  matrixMimeType?: string;
}

export interface RecreateExamRequest {
  originalExam?: Exam;
  examFileBase64?: string;
  examFileName?: string;
  grade?: string;
  topic?: string;
  textbook?: string;
  part3Type?: 'short_answer' | 'essay';
}

/**
 * CƠ CHẾ 1: TẠO ĐỀ THEO YÊU CẦU (PROMPT)
 * Khi giáo viên chọn khối lớp, chương trình và gõ yêu cầu cụ thể (chủ đề, dạng bài),
 * AI gọi API Gemini sinh đúng 100% nội dung câu hỏi mới theo yêu cầu đó, không sinh đề chung chung.
 */
export async function generateExamByPrompt(params: PromptExamRequest): Promise<Exam> {
  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'prompt',
      grade: params.grade,
      topic: params.topic,
      textbook: params.textbook,
      difficulty: params.difficulty || 'Đề thi chuẩn cấu trúc tốt nghiệp THPT 2025',
      promptCustom: params.promptCustom || '',
      part3Type: params.part3Type || 'short_answer',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi khi yêu cầu AI tạo đề theo prompt');
  }

  const data = await response.json();
  return {
    ...data.exam,
    id: `exam-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

/**
 * CƠ CHẾ 2: TẠO ĐỀ THEO MA TRẬN
 * Khi tải lên file/ảnh ma trận (hoặc cấu hình số câu Biết, Hiểu, Vận dụng cho từng phần I, II, III),
 * hệ thống bám sát tuyệt đối số lượng và dạng thức của ma trận để tạo đề.
 */
export async function generateExamByMatrix(params: MatrixExamRequest): Promise<Exam> {
  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'matrix',
      grade: params.grade,
      topic: params.topic || params.matrix?.topic || `Đề thi theo ma trận môn Toán lớp ${params.grade}`,
      textbook: params.textbook || params.matrix?.textbook || 'Kết Nối Tri Thức Với Cuộc Sống',
      matrix: params.matrix,
      part3Type: params.part3Type || (params.matrix?.part3 as any)?.type || 'short_answer',
      matrixFileBase64: params.matrixFileBase64,
      matrixFileName: params.matrixFileName,
      matrixMimeType: params.matrixMimeType,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi khi tạo đề thi bám sát ma trận');
  }

  const data = await response.json();
  return {
    ...data.exam,
    id: `exam-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

/**
 * CƠ CHẾ 3: TÁI TẠO ĐỀ (AI TÁI TẠO ĐỀ TƯƠNG TỰ)
 * Giữ nguyên khung cấu trúc kiến thức và độ khó của đề gốc, nhưng hoán đổi số liệu,
 * đổi ngữ cảnh và xáo trộn vị trí đáp án đúng để tạo ra một đề mới hoàn toàn tương đương.
 */
export async function recreateExamWithVariations(params: RecreateExamRequest): Promise<Exam> {
  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'recreate',
      originalExam: params.originalExam,
      examFileBase64: params.examFileBase64,
      examFileName: params.examFileName,
      grade: params.grade || params.originalExam?.grade || '12',
      topic: params.topic || (params.originalExam ? `Tái tạo tương đương từ ${params.originalExam.title}` : 'Tái tạo đề tương tự'),
      textbook: params.textbook || params.originalExam?.textbook || 'Kết Nối Tri Thức Với Cuộc Sống',
      part3Type: params.part3Type || params.originalExam?.part3Type || 'short_answer',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi khi tái tạo đề thi tương đương');
  }

  const data = await response.json();
  return {
    ...data.exam,
    id: `exam-recreated-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
}
