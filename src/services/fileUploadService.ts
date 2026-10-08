import mammoth from 'mammoth';
import XLSX from 'xlsx-js-style';

export interface MatrixUploadPayload {
  fileName: string;
  fileBase64?: string;
  mimeType: string;
  extractedText?: string;
  isMultimodal: boolean;
  detectedGrade: '10' | '11' | '12';
  detectedTopic: string;
}

/**
 * Auto-detect high school math grade (10, 11, or 12) from filename and text content.
 * Guarantees that files like "11.pdf", "ma_tran_11.docx", "toan11.xlsx" are immediately bound to Grade 11!
 * Absolutely eliminates any hardcoded Grade 12 fallback.
 */
export function detectGradeFromFileName(fileName: string = '', textContent: string = ''): '10' | '11' | '12' {
  const cleanName = (fileName || '').toLowerCase();
  const normalized = (cleanName + ' ' + (textContent || '')).toLowerCase();

  // 1. Grade 11 checks (Exact matches like 11.pdf, 11_de, toan11, lop 11, khoi 11)
  if (
    /(^|[^0-9])11([^0-9]|$)/.test(cleanName) ||
    cleanName.includes('11') ||
    normalized.includes('toán 11') ||
    normalized.includes('toan 11') ||
    normalized.includes('toan11') ||
    normalized.includes('lớp 11') ||
    normalized.includes('lop 11') ||
    normalized.includes('lop11') ||
    normalized.includes('khối 11') ||
    normalized.includes('khoi 11') ||
    normalized.includes('lượng giác') ||
    normalized.includes('luong giac') ||
    normalized.includes('cấp số cộng') ||
    normalized.includes('cap so cong') ||
    normalized.includes('cấp số nhân') ||
    normalized.includes('cap so nhan') ||
    normalized.includes('giới hạn') ||
    normalized.includes('gioi han') ||
    normalized.includes('dãy số') ||
    normalized.includes('day so')
  ) {
    return '11';
  }

  // 2. Grade 10 checks (Exact matches like 10.pdf, toan10, lop 10, khoi 10)
  if (
    /(^|[^0-9])10([^0-9]|$)/.test(cleanName) ||
    cleanName.includes('10') ||
    normalized.includes('toán 10') ||
    normalized.includes('toan 10') ||
    normalized.includes('toan10') ||
    normalized.includes('lớp 10') ||
    normalized.includes('lop 10') ||
    normalized.includes('lop10') ||
    normalized.includes('khối 10') ||
    normalized.includes('khoi 10') ||
    normalized.includes('hàm số bậc hai') ||
    normalized.includes('tam thức bậc hai') ||
    normalized.includes('parabol') ||
    normalized.includes('vectơ') ||
    normalized.includes('vector')
  ) {
    return '10';
  }

  // 3. Grade 12 checks
  if (
    /(^|[^0-9])12([^0-9]|$)/.test(cleanName) ||
    cleanName.includes('12') ||
    normalized.includes('toán 12') ||
    normalized.includes('toan 12') ||
    normalized.includes('toan12') ||
    normalized.includes('lớp 12') ||
    normalized.includes('lop 12') ||
    normalized.includes('lop12') ||
    normalized.includes('khối 12') ||
    normalized.includes('khoi 12') ||
    normalized.includes('nguyên hàm') ||
    normalized.includes('tích phân') ||
    normalized.includes('oxyz')
  ) {
    return '12';
  }

  // Fallback: if filename contains 11 -> 11, if 10 -> 10, otherwise default to 11 (avoid hardcoding 12!)
  if (cleanName.includes('11')) return '11';
  if (cleanName.includes('10')) return '10';
  return '11';
}

/**
 * Default topic by grade - strictly adhering to the MOET GDPT 2018 curriculum:
 * Grade 11: Lượng giác, Cấp số cộng/nhân, Giới hạn, Hình không gian (NO derivatives/integrals/calculus of Grade 12!)
 */
export function getDefaultTopicForGrade(grade: '10' | '11' | '12'): string {
  if (grade === '11') {
    return 'Lượng Giác, Dãy Số - Cấp Số Cộng/Nhân, Giới Hạn & Hình Học Không Gian';
  }
  if (grade === '10') {
    return 'Hàm Số Bậc Hai, Tam Thức & Bất Phương Trình Bậc Hai';
  }
  return 'Khảo Sát Hàm Số, Cực Trị & Tích Phân';
}

/**
 * Convert file to raw Base64 string (without data: prefix)
 */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
  });

/**
 * Extract text from document files (.docx, .xlsx, .xls, .txt, .csv)
 */
export async function extractDocumentText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();

  // Word document (.docx)
  if (lowerName.endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer });
      return res.value || '';
    } catch (e) {
      console.warn('[FileUploadService] Mammoth extract warning:', e);
      return '';
    }
  }

  // Excel spreadsheets (.xlsx, .xls) & CSV
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      let text = '';
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        text += `[Sheet: ${sheetName}]\n` + XLSX.utils.sheet_to_csv(sheet) + '\n\n';
      });
      return text;
    } catch (e) {
      console.warn('[FileUploadService] XLSX extract warning:', e);
      return '';
    }
  }

  // Plain Text (.txt)
  if (lowerName.endsWith('.txt')) {
    try {
      return await file.text();
    } catch (e) {
      return '';
    }
  }

  return '';
}

/**
 * Complete pre-processor for matrix upload files:
 * Extracts text, converts to Base64, and auto-detects grade.
 * Directly supports: .pdf, .docx, .xlsx, .xls, .png, .jpg, .jpeg, .txt
 */
export async function prepareMatrixUploadPayload(file: File): Promise<MatrixUploadPayload> {
  const lowerName = file.name.toLowerCase();
  let extractedText = '';
  let fileBase64 = '';
  let isMultimodal = false;
  let effectiveMime = file.type || 'application/octet-stream';

  if (file.type.startsWith('image/')) {
    isMultimodal = true;
    fileBase64 = await fileToBase64(file);
    effectiveMime = file.type || 'image/png';
  } else if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    isMultimodal = true;
    fileBase64 = await fileToBase64(file);
    effectiveMime = 'application/pdf';
  } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
    isMultimodal = false;
    extractedText = await extractDocumentText(file);
    fileBase64 = await fileToBase64(file);
    effectiveMime = lowerName.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : lowerName.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/plain';
  } else {
    // Other files: convert to base64
    fileBase64 = await fileToBase64(file);
    isMultimodal = true;
  }

  // Detect grade from both filename and extracted text
  const detectedGrade = detectGradeFromFileName(file.name, extractedText);
  const detectedTopic = getDefaultTopicForGrade(detectedGrade);

  return {
    fileName: file.name,
    fileBase64,
    mimeType: effectiveMime,
    extractedText,
    isMultimodal,
    detectedGrade,
    detectedTopic,
  };
}
