import XLSX from 'xlsx-js-style';
import mammoth from 'mammoth';
import { Exam, EssayGradingResult, RubricStep, StudentSubmission, ExamMatrixData } from '../types/exam';

export interface DocumentQuestionItem {
  id: number | string;
  question: string;
  options: string[];
  correctAnswer: 'A' | 'B' | 'C' | 'D' | string;
  explanation: string;
}

export interface DigitizeDocumentResult {
  quizData: DocumentQuestionItem[];
  exam: Exam;
}

// Convert File to raw base64 string
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (err) => reject(err);
  });

// Extract text or multimodal payload from any document (.pdf, .docx, .xlsx, .xls, .png, .jpg, .txt)
export async function prepareDocumentPayload(file: File): Promise<{
  fileName: string;
  fileBase64?: string;
  mimeType?: string;
  extractedText?: string;
  isMultimodal: boolean;
}> {
  const fileName = file.name.toLowerCase();

  // 1. Image formats (.png, .jpg, .jpeg, etc.)
  if (file.type.startsWith('image/')) {
    const b64 = await fileToBase64(file);
    return { isMultimodal: true, fileBase64: b64, mimeType: file.type, fileName: file.name };
  }

  // 2. PDF (.pdf)
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    const b64 = await fileToBase64(file);
    return { isMultimodal: true, fileBase64: b64, mimeType: 'application/pdf', fileName: file.name };
  }

  // 3. Word document (.docx)
  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer });
    return { isMultimodal: false, extractedText: res.value, fileName: file.name };
  }

  // 4. Excel spreadsheet (.xlsx, .xls)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    let textContent = '';
    workbook.SheetNames.forEach((sheet) => {
      textContent += `[Bảng ${sheet}]\n` + XLSX.utils.sheet_to_csv(workbook.Sheets[sheet]) + '\n\n';
    });
    return { isMultimodal: false, extractedText: textContent, fileName: file.name };
  }

  // 5. Plain text (.txt)
  if (fileName.endsWith('.txt')) {
    const text = await file.text();
    return { isMultimodal: false, extractedText: text, fileName: file.name };
  }

  if (fileName.endsWith('.doc')) {
    throw new Error('Định dạng .doc cũ không hỗ trợ đọc trực tiếp. Vui lòng đổi sang .docx hoặc xuất sang .pdf.');
  }

  throw new Error(`Định dạng file ${file.name} chưa được hỗ trợ. Vui lòng tải .pdf, .docx, .xlsx, .xls, ảnh hoặc .txt.`);
}

// Digitize uploaded document via AI Gemini
export async function digitizeDocumentApi(payload: {
  fileName: string;
  fileBase64?: string;
  mimeType?: string;
  extractedText?: string;
  targetGrade?: string;
}): Promise<DigitizeDocumentResult> {
  const response = await fetch('/api/digitize-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi khi số hóa tài liệu đề thi bằng AI Gemini');
  }

  const data = await response.json();
  return {
    quizData: data.quizData || [],
    exam: data.exam,
  };
}

export interface GradeEssayPayload {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  questionText: string;
  maxPoints: number;
  rubric: RubricStep[];
  studentName?: string;
  studentClass?: string;
}

export interface GenerateExamParams {
  mode?: 'prompt' | 'matrix' | 'recreate';
  grade: string;
  topic: string;
  textbook: string;
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

// 1. Generate Math Exam using Gemini (Supports Mode: prompt, matrix, recreate)
export async function generateExamApi(params: GenerateExamParams): Promise<Exam> {
  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể tạo đề thi từ AI Gemini');
  }

  const data = await response.json();
  return {
    ...data.exam,
    id: `exam-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

export { generateExamByPrompt, generateExamByMatrix, recreateExamWithVariations } from './examGenerator';

// 1.1 Parse Matrix File (.pdf, .xlsx, .docx, images)
export async function parseMatrixApi(payload: {
  fileName: string;
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
}): Promise<ExamMatrixData> {
  const response = await fetch('/api/parse-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể trích xuất ma trận');
  }

  const data = await response.json();
  return data.matrix;
}

// 2. Grade Handwritten Essay with Gemini Vision
export async function gradeEssayApi(payload: GradeEssayPayload): Promise<EssayGradingResult> {
  const response = await fetch('/api/grade-essay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi khi chấm bài tự luận');
  }

  const data = await response.json();
  return data.evaluation;
}

// 3. Simulated/Live Firebase Storage Upload
// In a full Firebase project with storageBucket, this uses uploadBytesResumable & getDownloadURL
export async function uploadToFirebaseStorage(
  fileOrBlob: File | Blob,
  path: string,
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; base64: string }> {
  // Read as Data URL (base64)
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });

  // Simulate cloud upload progress steps for realistic feedback
  if (onProgress) {
    onProgress(25);
    await new Promise((r) => setTimeout(r, 250));
    onProgress(65);
    await new Promise((r) => setTimeout(r, 300));
    onProgress(100);
  }

  // Create simulated Firebase Storage token URL or use the data url
  const randomToken = Math.random().toString(36).substring(2, 10);
  const simulatedStorageUrl = `https://firebasestorage.googleapis.com/v0/b/edumath-ai.appspot.com/o/${encodeURIComponent(path)}?alt=media&token=${randomToken}`;

  return {
    downloadUrl: simulatedStorageUrl,
    base64,
  };
}

// 4. Export Beautiful Excel Report (.xlsx)
export function exportGradebookToExcel(
  submissions: StudentSubmission[],
  exam: Exam | null,
  className: string = 'Toán 12'
) {
  // Title rows
  const headerData = [
    ['SỞ GIÁO DỤC VÀ ĐÀO TẠO - TRƯỜNG THPT CHUYÊN & CHUẨN QUỐC GIA'],
    [`BẢNG TỔNG HỢP ĐIỂM THI MÔN TOÁN - HỌC KỲ II (LỚP ${className})`],
    [`Đề thi: ${exam?.title || 'Đề Kiểm Tra Định Kỳ'} - Mã đề: ${exam?.examCode || 'TOAN12-GDPT'}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} | Đơn vị khảo thí: Hệ thống EduMath AI GDPT 2018`],
    [], // Blank line
    [
      'STT',
      'Số Báo Danh',
      'Họ và Tên Học Sinh',
      'Lớp',
      'Mã Đề',
      'Thời Gian Nộp',
      'Vi Phạm Rời Tab',
      'Điểm Trắc Nghiệm',
      'Điểm Tự Luận',
      'Tổng Điểm (Hệ 10)',
      'Xếp Loại'
    ]
  ];

  // Data rows
  const dataRows = submissions.map((sub, index) => {
    let classification = 'Yếu / Kém';
    if (sub.totalScore >= 8.5) classification = 'Giỏi / Xuất sắc';
    else if (sub.totalScore >= 6.5) classification = 'Khá';
    else if (sub.totalScore >= 5.0) classification = 'Trung bình';

    return [
      index + 1,
      sub.studentId || `SBD-${String(index + 1).padStart(2, '0')}`,
      sub.studentName,
      sub.studentClass,
      sub.examCode || exam?.examCode || 'TOAN12',
      sub.submittedAt,
      sub.tabViolations ? `${sub.tabViolations} lần` : '0',
      sub.mcScore.toFixed(2),
      sub.essayScore.toFixed(2),
      sub.totalScore.toFixed(2),
      classification
    ];
  });

  // Calculate summary statistics
  const totalStudents = submissions.length;
  const avgScore = totalStudents > 0
    ? (submissions.reduce((acc, s) => acc + s.totalScore, 0) / totalStudents).toFixed(2)
    : '0';
  const maxScore = totalStudents > 0
    ? Math.max(...submissions.map(s => s.totalScore)).toFixed(2)
    : '0';
  const minScore = totalStudents > 0
    ? Math.min(...submissions.map(s => s.totalScore)).toFixed(2)
    : '0';

  const summaryRows = [
    [],
    ['THỐNG KÊ CHẤT LƯỢNG KỲ THI'],
    ['Tổng số học sinh dự thi:', totalStudents],
    ['Điểm trung bình toàn lớp:', avgScore],
    ['Điểm cao nhất:', maxScore],
    ['Điểm thấp nhất:', minScore],
    [],
    ['Xác nhận của Tổ chuyên môn Toán', '', '', '', '', 'Giáo viên phụ trách chấm AI'],
    ['(Ký và ghi rõ họ tên)', '', '', '', '', '(Hệ thống EduMath AI)']
  ];

  const fullSheetData = [...headerData, ...dataRows, ...summaryRows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(fullSheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // STT
    { wch: 16 }, // SBD
    { wch: 28 }, // Họ tên
    { wch: 12 }, // Lớp
    { wch: 16 }, // Mã Đề
    { wch: 22 }, // Thời gian nộp
    { wch: 16 }, // Vi phạm rời tab
    { wch: 16 }, // Điểm TN
    { wch: 16 }, // Điểm TL
    { wch: 16 }, // Tổng điểm
    { wch: 18 }, // Xếp loại
  ];

  // Set row heights
  ws['!rows'] = [
    { hpt: 26 }, // Title 1
    { hpt: 30 }, // Title 2
    { hpt: 22 }, // Title 3
    { hpt: 20 }, // Title 4
    { hpt: 12 }, // Blank
    { hpt: 28 }, // Table Header
  ];

  // Merge title header cells across 11 columns (A to K)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Row 1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Row 2
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }, // Row 3
    { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } }, // Row 4
  ];

  // Define styling objects for xlsx-js-style
  const thinBorder = {
    top: { style: 'thin', color: { rgb: '94A3B8' } },
    bottom: { style: 'thin', color: { rgb: '94A3B8' } },
    left: { style: 'thin', color: { rgb: '94A3B8' } },
    right: { style: 'thin', color: { rgb: '94A3B8' } },
  };

  const doubleBottomBorder = {
    top: { style: 'thin', color: { rgb: '94A3B8' } },
    bottom: { style: 'double', color: { rgb: '1E293B' } },
    left: { style: 'thin', color: { rgb: '94A3B8' } },
    right: { style: 'thin', color: { rgb: '94A3B8' } },
  };

  // 1. Style Header Title Rows (A1:J4)
  const cellA1 = ws['A1'];
  if (cellA1) {
    cellA1.s = {
      font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  const cellA2 = ws['A2'];
  if (cellA2) {
    cellA2.s = {
      font: { name: 'Times New Roman', sz: 15, bold: true, color: { rgb: '1E40AF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: 'EFF6FF' } },
    };
  }

  const cellA3 = ws['A3'];
  if (cellA3) {
    cellA3.s = {
      font: { name: 'Times New Roman', sz: 11, italic: true, color: { rgb: '334155' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  const cellA4 = ws['A4'];
  if (cellA4) {
    cellA4.s = {
      font: { name: 'Times New Roman', sz: 10, italic: true, color: { rgb: '64748B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // 2. Style Table Header Row (Row index 5 -> Excel row 6: A6 to J6)
  const headerRowIdx = 5;
  for (let c = 0; c < 10; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A8A' } }, // Dark navy header
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder,
      };
    }
  }

  // 3. Style Data Rows
  const startDataRow = 6;
  const endDataRow = startDataRow + submissions.length;
  for (let r = startDataRow; r < endDataRow; r++) {
    const isEven = (r - startDataRow) % 2 === 1;
    const rowBgColor = isEven ? 'F8FAFC' : 'FFFFFF';

    for (let c = 0; c < 10; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) {
        // Alignment: Name (col 2) and Comment (col 9) left-aligned; others centered
        const alignH = c === 2 ? 'left' : c === 9 ? 'left' : 'center';
        const isBold = c === 6 || c === 2; // Total score and name bold
        const textColor = c === 6 ? '059669' : c === 8 && String(ws[cellRef].v).includes('CÓ') ? 'DC2626' : '0F172A';

        ws[cellRef].s = {
          font: { name: 'Times New Roman', sz: 11, bold: isBold, color: { rgb: textColor } },
          fill: { fgColor: { rgb: rowBgColor } },
          alignment: { horizontal: alignH, vertical: 'center', wrapText: true },
          border: thinBorder,
        };
      }
    }
  }

  // 4. Style Summary Statistics Section
  const summaryStartRow = endDataRow + 1; // e.g. Row 11
  const summaryHeaderCell = XLSX.utils.encode_cell({ r: summaryStartRow, c: 0 });
  if (ws[summaryHeaderCell]) {
    ws[summaryHeaderCell].s = {
      font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '1E3A8A' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  for (let r = summaryStartRow + 1; r < summaryStartRow + 5; r++) {
    const labelCell = XLSX.utils.encode_cell({ r, c: 0 });
    const valCell = XLSX.utils.encode_cell({ r, c: 1 });
    if (ws[labelCell]) {
      ws[labelCell].s = {
        font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '1E293B' } },
        border: thinBorder,
      };
    }
    if (ws[valCell]) {
      ws[valCell].s = {
        font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '059669' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder,
      };
    }
  }

  // 5. Style Signatures (2 rows below summary)
  const sigRow = summaryStartRow + 6;
  const sigLeft = XLSX.utils.encode_cell({ r: sigRow, c: 0 });
  const sigRight = XLSX.utils.encode_cell({ r: sigRow, c: 5 });
  if (ws[sigLeft]) {
    ws[sigLeft].s = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '1E293B' } },
    };
  }
  if (ws[sigRight]) {
    ws[sigRight].s = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Báo cáo Lớp ${className}`);

  // Download Excel file
  const fileName = `BangDiem_Toan_${className}_${exam?.examCode || 'TOAN12'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
