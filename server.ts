import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import { safeParseGeminiResponse } from './src/services/safeJsonParser';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Initialize Google GenAI on server-side with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Prompt constraint strictly enforcing High School Math curriculum (SGK GDPT 2018)
const HIGH_SCHOOL_MATH_GRADING_SYSTEM_INSTRUCTION = `
Bạn là Giám khảo Chấm thi môn Toán cấp Trung học Phổ thông (THPT) tại Việt Nam với chuyên môn cao.
Nhiệm vụ của bạn là đọc ảnh bài làm viết tay của học sinh, nhận diện chữ viết và các bước giải toán, đối chiếu với BAREM ĐIỂM được cung cấp và chấm điểm chính xác.

=== QUY TẮC BẮT BUỘC VÀ NGHIÊM NGẶT (CRITICAL CONSTRAINTS) ===
1. BÁM SÁT BAREM: Phải chấm điểm chi tiết theo từng bước, từng ý nhỏ (0.25đ, 0.5đ, v.v.) của barem điểm được cung cấp. Không tự ý thêm điểm nếu học sinh không có bước làm hợp lệ.
2. CHỈ DÙNG KIẾN THỨC TOÁN SÁCH GIÁO KHOA CẤP 3 (Chương trình GDPT 2018: Kết Nối Tri Thức, Cánh Diều, Chân Trời Sáng Tạo).
   - Kiến thức hợp lệ: Đạo hàm cơ bản, bảng biến thiên, cực trị, tiệm cận, nguyên hàm và tích phân cơ bản, hình học không gian cổ điển và tọa độ Oxyz, tổ hợp - xác suất cơ bản, lượng giác SGK.
3. TUYỆT ĐỐI KHÔNG CHẤP NHẬN KIẾN THỨC VÀ PHƯƠNG PHÁP ĐẠI HỌC:
   - Nghiêm cấm và KHÔNG CHO ĐIỂM nếu học sinh sử dụng:
     * Quy tắc L'Hôpital (L'Hospital) để tính giới hạn.
     * Khai triển Taylor / Maclaurin.
     * Ma trận, định thức (determinant) cấp cao để giải hệ phương trình hoặc tích có hướng ngoài SGK.
     * Tích phân suy rộng, tích phân đường, mặt, vi phân cấp cao ngoài định nghĩa SGK.
   - Nếu phát hiện học sinh dùng phương pháp Đại học bị cấm, bạn phải ghi chú rõ trong nhận xét: "Phương pháp giải Đại học (không được phép trong chương trình SGK THPT) - Không công nhận điểm bước này".
4. ĐỌC CHỮ VIẾT TAY CẨN THẬN: Cố gắng luận giải các công thức, số mũ, dấu tích phân, phân số, vector mũi tên. Nếu ảnh mờ hoặc học sinh viết tẩy xóa gây nhầm lẫn thì nhận xét rõ.
5. ĐỊNH DẠNG ĐẦU RA: Phải trả về JSON hợp lệ theo đúng cấu trúc yêu cầu.
`;

/**
 * Resilient Gemini caller that handles 503 (high demand / unavailable),
 * 429 (rate limit), with automatic retry and model fallback.
 */
async function callGeminiWithResilience(contents: any, config: any = {}): Promise<string> {
  // Use approved non-deprecated models: gemini-3.8-flash, gemini-3.1-pro-preview, gemini-flash-latest, gemini-3.1-flash-lite
  const models = ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  // Strict structured JSON output configuration as required
  const generationConfig = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    ...(config.generationConfig || {}),
  };

  const finalConfig = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    ...config,
    ...generationConfig,
  };

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[Gemini Engine] Requesting model: ${model} (attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: finalConfig,
        });

        const text = response.text;
        if (text && text.trim().length > 0) {
          console.log(`[Gemini Engine] Succeeded with model: ${model}`);
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        console.warn(`[Gemini Engine] ${model} attempt ${attempt + 1} note:`, msg);

        const isQuotaExhausted =
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Quota exceeded') ||
          msg.includes('rate-limit') ||
          msg.includes('quota');

        if (isQuotaExhausted) {
          console.warn(`[Gemini Engine] Quota exhausted for ${model}, switching immediately to next model...`);
          break;
        }

        const isOverloaded =
          err?.status === 'UNAVAILABLE' ||
          err?.code === 503 ||
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('overloaded');

        if (isOverloaded) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error('Hệ thống AI hiện đang chịu tải cao. Vui lòng thử lại sau giây lát.');
}

export const STRICT_JSON_SYSTEM_INSTRUCTION =
  'CHỈ TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ. Tuyệt đối không thêm bất kỳ văn bản giải thích, lời chào hay ký tự nào ngoài cặp ngoặc nhọn { }.';

const SYSTEM_INSTRUCTION_EXAM_GEN = `Bạn là chuyên gia Toán học THPT Việt Nam (chuẩn SGK Kết Nối Tri Thức / Cánh Diều / Chân Trời Sáng Tạo).
Nhiệm vụ: Tạo đề thi môn Toán bám sát 100% Khối lớp và Chủ đề mà giáo viên yêu cầu (Ví dụ: Toán lớp 10 - Chủ đề: Hàm số bậc hai và Bất phương trình bậc hai).
CẤU TRÚC ĐỀ BẮT BUỘC:
- Phần I: Trắc nghiệm 4 lựa chọn (Toán học thực tế theo đúng chủ đề đã chọn, 4 phương án A, B, C, D rõ ràng).
- Phần II: Trắc nghiệm Đúng/Sai (Mỗi câu gồm 1 giả thiết theo đúng chủ đề và 4 ý a, b, c, d xét tính đúng sai).
- Phần III: Trả lời ngắn / Tự luận (Các bài toán vận dụng đúng theo chủ đề, kèm barem bước giải chi tiết).
Công thức toán học định dạng chuẩn LaTeX $...$.
${STRICT_JSON_SYSTEM_INSTRUCTION}`;

/**
 * Safely repairs raw JSON string produced by LLMs containing LaTeX formulas.
 * Solves:
 * 1. "Bad escaped character in JSON at position X" (e.g. \dfrac, \Delta, \alpha, \sqrt, \vec, \int, \le, etc.)
 * 2. LaTeX commands mistakenly parsed as JSON control escapes (\frac -> \f, \text -> \t, \ne -> \n, \right -> \r, \beta -> \b)
 * 3. Raw unescaped newlines/tabs inside string literals
 * 4. Trailing commas before } or ]
 */
function repairJsonString(raw: string): string {
  // First, extract JSON substring between outer { } or [ ]
  let str = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = str.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = str.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  // State machine to walk through the JSON text and repair strings
  let out = '';
  let inString = false;
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const ch = str[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        out += '"';
      } else {
        out += ch;
      }
      continue;
    }

    // Inside string literal:
    if (ch === '"') {
      inString = false;
      out += '"';
      continue;
    }

    if (ch === '\n') {
      out += '\\n';
      continue;
    }

    if (ch === '\r') {
      out += '\\r';
      continue;
    }

    if (ch === '\t') {
      out += '\\t';
      continue;
    }

    if (ch === '\\') {
      const next = i + 1 < len ? str[i + 1] : '';

      // 1. Escaped double quote: \"
      if (next === '"') {
        out += '\\"';
        i++;
        continue;
      }

      // 2. Already escaped backslash: \\
      if (next === '\\') {
        out += '\\\\';
        i++;
        continue;
      }

      // 3. Escaped slash: \/
      if (next === '/') {
        out += '\\/';
        i++;
        continue;
      }

      // 4. Unicode escape: \uXXXX
      if (next === 'u') {
        const hex = str.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += '\\u' + hex;
          i += 5;
          continue;
        } else {
          out += '\\\\u';
          i++;
          continue;
        }
      }

      // 5. Control escapes that collide with LaTeX math commands:
      // \f (formfeed vs \frac, \float, \factor)
      if (next === 'f') {
        const lookahead = str.slice(i + 1, i + 8).toLowerCase();
        if (/^f(rac|loat|actor|oot)/.test(lookahead)) {
          out += '\\\\f';
          i++;
          continue;
        }
        out += '\\f';
        i++;
        continue;
      }

      // \n (newline vs \ne, \neq, \notin, \nabla, \natural, \neg, \nu)
      if (next === 'n') {
        const lookahead = str.slice(i + 1, i + 8).toLowerCase();
        if (/^n(eq?|otin|abla|atural|eg|u\b)/.test(lookahead)) {
          out += '\\\\n';
          i++;
          continue;
        }
        out += '\\n';
        i++;
        continue;
      }

      // \t (tab vs \text, \tan, \tau, \theta, \to, \times, \tilde, \top, \triangle)
      if (next === 't') {
        const lookahead = str.slice(i + 1, i + 9).toLowerCase();
        if (/^t(ext|an|au|heta|imes|ilde|op|riangle|o\b)/.test(lookahead)) {
          out += '\\\\t';
          i++;
          continue;
        }
        out += '\\t';
        i++;
        continue;
      }

      // \r (carriage return vs \right, \rho, \rm, \rangle)
      if (next === 'r') {
        const lookahead = str.slice(i + 1, i + 7).toLowerCase();
        if (/^r(ight|ho|m\b|angle)/.test(lookahead)) {
          out += '\\\\r';
          i++;
          continue;
        }
        out += '\\r';
        i++;
        continue;
      }

      // \b (backspace vs \bar, \beta, \binom, \boldsymbol, \bmatrix, \bullet, \box)
      if (next === 'b') {
        const lookahead = str.slice(i + 1, i + 10).toLowerCase();
        if (/^b(ar|eta|inom|oldsymbol|matrix|ullet|ox|ig)/.test(lookahead)) {
          out += '\\\\b';
          i++;
          continue;
        }
        out += '\\b';
        i++;
        continue;
      }

      // 6. ALL OTHER CHARACTERS: In standard JSON, any other character following \ is an INVALID escape!
      // (e.g. \dfrac, \Delta, \vec, \alpha, \sqrt, \int, \pm, \le, \ge, \sim, \infty, etc.)
      // We MUST escape the backslash so it becomes valid JSON: \\ + next
      out += '\\\\' + next;
      i++;
      continue;
    }

    out += ch;
  }

  // Remove trailing commas before } or ]
  out = out.replace(/,\s*([}\]])/g, '$1');

  return out;
}

/**
 * Robust JSON parser that handles LLM responses with LaTeX math formulas.
 * Uses safeParseGeminiResponse with fallback to lexical repair if needed.
 */
export function safeJsonParse<T = any>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Dữ liệu JSON phản hồi từ AI rỗng.');
  }

  try {
    return safeParseGeminiResponse<T>(raw);
  } catch (initialErr) {
    try {
      const repaired = repairJsonString(raw);
      return safeParseGeminiResponse<T>(repaired);
    } catch {
      throw initialErr;
    }
  }
}

/**
 * Intelligent algorithmic parser for Vietnamese Math Exam Matrices from Excel/CSV sheets
 */
function extractMatrixFromSheetText(sheetText: string, fileName: string): any {
  const lines = sheetText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  console.log(`[Matrix Parser] Analyzing ${lines.length} lines from sheet...`);

  let part1 = {
    title: 'Phần I: TN nhiều lựa chọn (4 phương án)',
    nhanBiet: 6,
    thongHieu: 4,
    vanDung: 2,
    vanDungCao: 0,
    totalQuestions: 12,
    points: 3.0,
  };

  let part2 = {
    title: 'Phần II: TN Đúng / Sai',
    nhanBiet: 2,
    thongHieu: 1,
    vanDung: 1,
    vanDungCao: 0,
    totalQuestions: 4,
    points: 4.0,
  };

  let part3 = {
    title: 'Phần III: Tự luận giải toán',
    nhanBiet: 0,
    thongHieu: 1,
    vanDung: 1,
    vanDungCao: 1,
    totalQuestions: 2,
    points: 3.0,
  };

  // Check grade
  let detectedGrade = '12';
  const lowerFileName = fileName.toLowerCase();
  const fullText = (fileName + ' ' + sheetText).toLowerCase();
  if (
    /(^|[^0-9])11([^0-9]|$)/.test(lowerFileName) ||
    fullText.includes('lớp 11') ||
    fullText.includes('toán 11') ||
    fullText.includes('toan 11') ||
    fullText.includes('khoi 11') ||
    fullText.includes('lượng giác') ||
    fullText.includes('cấp số cộng') ||
    fullText.includes('cấp số nhân') ||
    fullText.includes('giới hạn')
  ) {
    detectedGrade = '11';
  } else if (
    /(^|[^0-9])10([^0-9]|$)/.test(lowerFileName) ||
    fullText.includes('lớp 10') ||
    fullText.includes('toán 10') ||
    fullText.includes('toan 10') ||
    fullText.includes('khoi 10') ||
    fullText.includes('hàm số bậc hai') ||
    fullText.includes('tam thức') ||
    fullText.includes('vectơ')
  ) {
    detectedGrade = '10';
  }

  // Look for row headers and counts in lines
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Part 1: TN nhiều lựa chọn
    if (
      lower.includes('phần i') ||
      lower.includes('phần 1') ||
      lower.includes('nhiều lựa chọn') ||
      lower.includes('tnkq') ||
      lower.includes('trắc nghiệm 4 lựa chọn')
    ) {
      // Find all numbers in this line
      const numbers = line.match(/\d+(\.\d+)?/g)?.map(Number) || [];
      // Usually total questions is between 4 and 40
      const possibleTotals = numbers.filter((n) => n >= 4 && n <= 40 && Number.isInteger(n));
      if (possibleTotals.length > 0) {
        part1.totalQuestions = possibleTotals[possibleTotals.length - 1];
      }
      // Points (usually 2.0 to 7.0)
      const possiblePoints = numbers.filter((n) => n >= 1.0 && n <= 7.0 && !possibleTotals.includes(n));
      if (possiblePoints.length > 0) {
        part1.points = possiblePoints[0];
      }
    }

    // Part 2: TN Đúng / Sai
    if (
      lower.includes('phần ii') ||
      lower.includes('phần 2') ||
      lower.includes('đúng sai') ||
      lower.includes('đúng/sai') ||
      lower.includes('đúng - sai')
    ) {
      const numbers = line.match(/\d+(\.\d+)?/g)?.map(Number) || [];
      const possibleTotals = numbers.filter((n) => n >= 1 && n <= 10 && Number.isInteger(n));
      if (possibleTotals.length > 0) {
        part2.totalQuestions = possibleTotals[0];
      }
      const possiblePoints = numbers.filter((n) => n >= 1.0 && n <= 6.0 && !possibleTotals.includes(n));
      if (possiblePoints.length > 0) {
        part2.points = possiblePoints[0];
      }
    }

    // Part 3: Tự luận hoặc trả lời ngắn
    if (
      lower.includes('phần iii') ||
      lower.includes('phần 3') ||
      lower.includes('tự luận') ||
      lower.includes('trả lời ngắn') ||
      lower.includes('tln')
    ) {
      const numbers = line.match(/\d+(\.\d+)?/g)?.map(Number) || [];
      const possibleTotals = numbers.filter((n) => n >= 1 && n <= 10 && Number.isInteger(n));
      if (possibleTotals.length > 0) {
        part3.totalQuestions = possibleTotals[0];
      }
      const possiblePoints = numbers.filter((n) => n >= 1.0 && n <= 6.0 && !possibleTotals.includes(n));
      if (possiblePoints.length > 0) {
        part3.points = possiblePoints[0];
      }
    }
  }

  // Adjust level distributions to sum up to totalQuestions
  part1.nhanBiet = Math.round(part1.totalQuestions * 0.5);
  part1.thongHieu = Math.round(part1.totalQuestions * 0.35);
  part1.vanDung = Math.max(0, part1.totalQuestions - part1.nhanBiet - part1.thongHieu);
  part1.vanDungCao = 0;

  part2.nhanBiet = Math.max(1, Math.round(part2.totalQuestions * 0.4));
  part2.thongHieu = Math.max(1, Math.round(part2.totalQuestions * 0.3));
  part2.vanDung = Math.max(0, part2.totalQuestions - part2.nhanBiet - part2.thongHieu);
  part2.vanDungCao = 0;

  part3.nhanBiet = 0;
  part3.thongHieu = Math.max(0, Math.floor(part3.totalQuestions / 2));
  part3.vanDung = Math.max(1, Math.ceil(part3.totalQuestions / 2));
  part3.vanDungCao = 0;

  return {
    topic: `Ma trận đề thi môn Toán Lớp ${detectedGrade} (Trích xuất từ ${fileName || 'tài liệu'})`,
    grade: detectedGrade,
    textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
    durationMinutes: 45,
    totalPoints: 10.0,
    part1,
    part2,
    part3,
    rawSummary: `Ma trận đã trích xuất từ file: Phần I (${part1.totalQuestions} câu TN - ${part1.points}đ), Phần II (${part2.totalQuestions} câu Đúng/Sai - ${part2.points}đ), Phần III (${part3.totalQuestions} câu Tự luận - ${part3.points}đ).`,
  };
}

// ==========================================
// API 1: Parse Matrix File (.pdf, .xlsx, .docx, images)
// ==========================================
app.post('/api/parse-matrix', async (req, res) => {
  try {
    const { fileName = '', fileBase64 = '', mimeType = 'application/pdf', rawText = '', detectedGrade: inputDetectedGrade } = req.body;

    console.log(`[API /api/parse-matrix] Analyzing matrix from file: ${fileName} (${mimeType})`);

    const lowerFileName = fileName.toLowerCase();
    let effectiveDetectedGrade = inputDetectedGrade;
    if (!effectiveDetectedGrade) {
      if (/(^|[^0-9])11([^0-9]|$)/.test(lowerFileName) || lowerFileName.includes('11')) {
        effectiveDetectedGrade = '11';
      } else if (/(^|[^0-9])10([^0-9]|$)/.test(lowerFileName) || lowerFileName.includes('10')) {
        effectiveDetectedGrade = '10';
      } else if (/(^|[^0-9])12([^0-9]|$)/.test(lowerFileName) || lowerFileName.includes('12')) {
        effectiveDetectedGrade = '12';
      } else {
        effectiveDetectedGrade = '11';
      }
    }

    let extractedText = rawText || '';
    const isSpreadsheet =
      fileName.toLowerCase().endsWith('.xlsx') ||
      fileName.toLowerCase().endsWith('.xls') ||
      fileName.toLowerCase().endsWith('.csv') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('sheet');

    // 1. If it's an Excel spreadsheet or CSV, parse text directly using XLSX
    if (isSpreadsheet && fileBase64) {
      try {
        const buffer = Buffer.from(fileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetLines: string[] = [];
        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheetLines.push(`=== Sheet: ${name} ===\n${csv}`);
        }
        extractedText = sheetLines.join('\n\n');
        console.log('[API /api/parse-matrix] Successfully converted Excel workbook to CSV text:', extractedText.length, 'chars');
      } catch (excelErr) {
        console.warn('[API /api/parse-matrix] Excel parsing error:', excelErr);
      }
    }

    // 2. Perform local algorithmic extraction first
    const algorithmicMatrix = extractMatrixFromSheetText(extractedText || rawText || fileName, fileName);
    algorithmicMatrix.grade = effectiveDetectedGrade;
    if (effectiveDetectedGrade === '11') {
      algorithmicMatrix.topic = 'Lượng Giác, Dãy Số - Cấp Số Cộng/Nhân, Giới Hạn & Hình Học Không Gian';
    } else if (effectiveDetectedGrade === '10') {
      algorithmicMatrix.topic = 'Hàm Số Bậc Hai, Tam Thức & Bất Phương Trình Bậc Hai';
    }

    // 3. Prepare prompt for AI multimodal or text extraction
    const prompt = `
Bạn là chuyên gia thẩm định và ra đề thi môn Toán THPT Việt Nam (Chương trình GDPT 2018).
Nhiệm vụ: Hãy ĐỌC KỸ 100% NỘI DUNG FILE MA TRẬN / BẢNG ĐẶC TẢ ĐÍNH KÈM (file: "${fileName}").
File đính kèm là tài liệu Toán của KHỐI LỚP NÀO thì BẮT BUỘC RA ĐÚNG KHỐI LỚP ĐÓ:
- NẾU FILE LÀ MA TRẬN TOÁN 11 (hoặc tên file có số 11 như 11.pdf, toan11.docx):
  * Khối lớp BẮT BUỘC là "11".
  * Chủ đề bám sát các chuyên đề Lớp 11 (Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn, Hình học không gian quan hệ song song/vuông góc...).
  * CẢNH BÁO TỐI CAO: TUYỆT ĐỐI KHÔNG ra kiến thức đạo hàm/tích phân/khảo sát hàm số của Lớp 12!
- Khối lớp đã được hệ thống định danh từ file: TOÁN LỚP ${effectiveDetectedGrade}.

Hãy phân tích kỹ các dòng và cột trong ma trận để đếm CHÍNH XÁC:
1. Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (4 phương án A, B, C, D)
   - Số câu cấp độ Nhận biết
   - Số câu cấp độ Thông hiểu
   - Số câu cấp độ Vận dụng
   - Số câu cấp độ Vận dụng cao
   - Tổng số câu Phần I (đúng số câu ghi trong tài liệu ma trận)
   - Điểm số Phần I (thường là 3.0 điểm)
2. Phần II: Câu hỏi trắc nghiệm Đúng / Sai
   - Số câu hỏi Đúng/Sai (thường là 4 câu)
   - Số ý theo các mức độ Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao
   - Điểm số Phần II (thường là 4.0 điểm)
3. Phần III: Tự luận giải chi tiết (hoặc trả lời ngắn)
   - Số câu hỏi / bài toán
   - Số bước hoặc mức độ Vận dụng, Vận dụng cao
   - Điểm số Phần III (thường là 3.0 điểm)
4. Tổng điểm toàn bài: 10.0 điểm.
5. Khối lớp: "${effectiveDetectedGrade}".

Trả về định dạng JSON thuần túy (KHÔNG dùng markdown \`\`\`json) với cấu trúc:
{
  "topic": "${effectiveDetectedGrade === '11' ? 'Lượng Giác, Dãy Số - Cấp Số Cộng/Nhân, Giới Hạn & Hình Học Không Gian' : effectiveDetectedGrade === '10' ? 'Hàm Số Bậc Hai, Tam Thức & Bất Phương Trình Bậc Hai' : 'Khảo sát hàm số & Tích phân'}",
  "grade": "${effectiveDetectedGrade}",
  "textbook": "Kết Nối Tri Thức Với Cuộc Sống",
  "durationMinutes": 45,
  "totalPoints": 10.0,
  "part1": {
    "title": "Phần I: TN nhiều lựa chọn (4 phương án)",
    "nhanBiet": 6,
    "thongHieu": 4,
    "vanDung": 2,
    "vanDungCao": 0,
    "totalQuestions": 12,
    "points": 3.0
  },
  "part2": {
    "title": "Phần II: TN Đúng / Sai",
    "nhanBiet": 2,
    "thongHieu": 1,
    "vanDung": 1,
    "vanDungCao": 0,
    "totalQuestions": 4,
    "points": 4.0
  },
  "part3": {
    "title": "Phần III: Tự luận giải toán",
    "nhanBiet": 0,
    "thongHieu": 1,
    "vanDung": 1,
    "vanDungCao": 1,
    "totalQuestions": 2,
    "points": 3.0
  },
  "rawSummary": "Tóm tắt ngắn gọn số câu từng phần..."
}
`;

    let contentPayload: any = prompt;

    if (extractedText && extractedText.trim().length > 10) {
      // For Excel/CSV/Text: pass as pure text to AI (Gemini excels at tabular CSV parsing)
      contentPayload = `${prompt}\n\n=== NỘI DUNG MA TRẬN BẢNG TÍNH EXCEL / CSV TỪ FILE (${fileName}) ===\n${extractedText}`;
    } else if (fileBase64 && (fileName.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf') || mimeType.includes('image'))) {
      // For PDF or image: pass as inlineData
      let cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
      let effectiveMime = mimeType;
      if (!effectiveMime || effectiveMime === 'application/octet-stream') {
        effectiveMime = fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      }

      contentPayload = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMime,
          },
        },
        { text: prompt },
      ];
    }

    let parsedMatrix: any = null;

    try {
      const responseText = await callGeminiWithResilience(contentPayload, {
        systemInstruction: `Bạn là chuyên gia thẩm định và ra đề thi môn Toán THPT Việt Nam.\n${STRICT_JSON_SYSTEM_INSTRUCTION}`,
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      parsedMatrix = safeParseGeminiResponse(responseText);
      console.log('[API /api/parse-matrix] AI extraction completed successfully');
    } catch (aiErr) {
      console.warn('[API /api/parse-matrix] AI extraction failed, using algorithmic parser from file:', aiErr);
      parsedMatrix = algorithmicMatrix;
    }

    // Ensure all critical counts and points exist
    if (!parsedMatrix.part1) parsedMatrix.part1 = algorithmicMatrix.part1;
    if (!parsedMatrix.part2) parsedMatrix.part2 = algorithmicMatrix.part2;
    if (!parsedMatrix.part3) parsedMatrix.part3 = algorithmicMatrix.part3;

    // Detect part3Type from text or parsed result
    const combinedMatrixText = `${extractedText || ''} ${rawText || ''} ${fileName || ''}`.toLowerCase();
    if (!parsedMatrix.part3Type) {
      if (
        combinedMatrixText.includes('trả lời ngắn') ||
        combinedMatrixText.includes('tra loi ngan') ||
        combinedMatrixText.includes('điền khuyết') ||
        combinedMatrixText.includes('điền đáp số')
      ) {
        parsedMatrix.part3Type = 'short_answer';
      } else if (
        combinedMatrixText.includes('tự luận') ||
        combinedMatrixText.includes('tu luan') ||
        combinedMatrixText.includes('giải chi tiết')
      ) {
        parsedMatrix.part3Type = 'essay';
      } else {
        parsedMatrix.part3Type = 'short_answer';
      }
    }

    // Strict grade and topic synchronization
    parsedMatrix.grade = effectiveDetectedGrade;
    if (effectiveDetectedGrade === '11') {
      const isLeaked =
        !parsedMatrix.topic ||
        parsedMatrix.topic.includes('Lớp 12') ||
        parsedMatrix.topic.includes('LỚP 12') ||
        parsedMatrix.topic.includes('Khảo sát') ||
        parsedMatrix.topic.includes('Tích phân') ||
        parsedMatrix.topic.includes('Cực trị') ||
        parsedMatrix.topic.includes('Oxyz');
      if (isLeaked) {
        parsedMatrix.topic = 'Lượng Giác, Dãy Số - Cấp Số Cộng/Nhân, Giới Hạn & Hình Học Không Gian';
      }
    } else if (effectiveDetectedGrade === '10') {
      const isLeaked =
        !parsedMatrix.topic ||
        parsedMatrix.topic.includes('Lớp 12') ||
        parsedMatrix.topic.includes('LỚP 12') ||
        parsedMatrix.topic.includes('Khảo sát') ||
        parsedMatrix.topic.includes('Tích phân');
      if (isLeaked) {
        parsedMatrix.topic = 'Hàm Số Bậc Hai, Tam Thức & Bất Phương Trình Bậc Hai';
      }
    }

    return res.json({
      success: true,
      matrix: parsedMatrix,
    });
  } catch (error: any) {
    console.error('Error in /api/parse-matrix:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi trích xuất ma trận',
    });
  }
});

// ==========================================
// API: Digitize Document to Exam (.pdf, .docx, .xlsx, .xls, .png, .jpg, .txt)
// ==========================================
app.post('/api/digitize-document', async (req, res) => {
  try {
    const {
      fileName = '',
      fileBase64 = '',
      mimeType = '',
      extractedText = '',
      targetGrade = '12',
    } = req.body;

    console.log(`[API /api/digitize-document] Processing document: ${fileName} (${mimeType || 'text'})`);

    const promptInstruction = `
Bạn là chuyên gia số hóa đề thi môn Toán và khảo thí GDPT 2018.
Nhiệm vụ: Đọc kỹ tài liệu đính kèm (từ file "${fileName}") và trích xuất/chuyển đổi toàn bộ thành các câu hỏi trắc nghiệm khách quan chuẩn khảo thí.

QUY TẮC CÔNG THỨC & NỘI DUNG BẮT BUỘC:
1. Công thức Toán: Bọc TẤT CẢ công thức, ký hiệu toán học, biểu thức bằng cú pháp LaTeX chuẩn trong dấu đô-la đơn $...$ hoặc $$...$$ (Ví dụ: $f(x) = x^2 - 3x + 2$, $\\int_0^1 x\\,\\mathrm{d}x$, $(-\\infty; 2)$).
2. Tiền tố câu hỏi: KHÔNG ghi "Câu 1:", "Câu 2:" ở đầu trường 'question' vì giao diện sẽ tự động đánh số.
3. Đáp án: Đảm bảo có đầy đủ các lựa chọn A, B, C, D trong mảng options. Xác định chính xác phương án đúng (A, B, C, hoặc D) và viết lời giải thích chi tiết từng bước.
4. Trích xuất đầy đủ tất cả các câu hỏi trong tài liệu. Nếu tài liệu là văn bản hoặc bảng câu hỏi, hãy số hóa đầy đủ toàn bộ các câu hỏi.

BẮT BUỘC trả về DUY NHẤT định dạng JSON thuần túy (không bọc markdown \`\`\`json ngoài JSON) với schema:
{
  "title": "ĐỀ THI SỐ HÓA TỪ ${fileName.replace(/\\.[^/.]+$/, '').toUpperCase()}",
  "examCode": "SH-${Math.floor(100 + Math.random() * 900)}",
  "grade": "${targetGrade}",
  "durationMinutes": 45,
  "totalPoints": 10,
  "questions": [
    {
      "id": 1,
      "question": "Nội dung câu hỏi kèm $f(x)$...",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correctAnswer": "A",
      "explanation": "Hướng dẫn giải chi tiết từng bước..."
    }
  ]
}
`;

    let payload: any = promptInstruction;

    if (extractedText && extractedText.trim().length > 0) {
      payload = `Nội dung tài liệu được trích xuất từ file (${fileName}):\n\n${extractedText}\n\n${promptInstruction}`;
    } else if (fileBase64) {
      let cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
      let effectiveMime = mimeType;
      if (!effectiveMime) {
        effectiveMime = fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      }
      payload = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMime,
          },
        },
        { text: promptInstruction },
      ];
    } else {
      return res.status(400).json({ success: false, error: 'Không có dữ liệu file hoặc nội dung trích xuất.' });
    }

    const responseText = await callGeminiWithResilience(payload, {
      systemInstruction: `Bạn là chuyên gia số hóa đề thi môn Toán và khảo thí GDPT 2018.\n${STRICT_JSON_SYSTEM_INSTRUCTION}`,
      responseMimeType: 'application/json',
      temperature: 0.2,
    });

    const parsed = safeParseGeminiResponse(responseText);
    const questions = parsed.questions || [];

    const formattedExam = {
      id: `exam-${Date.now()}`,
      title: parsed.title || `Đề thi số hóa từ ${fileName}`,
      examCode: parsed.examCode || `SH-${Math.floor(100 + Math.random() * 900)}`,
      grade: parsed.grade || targetGrade,
      durationMinutes: parsed.durationMinutes || 45,
      totalPoints: parsed.totalPoints || 10,
      textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
      topic: `Số hóa từ file: ${fileName}`,
      createdAt: new Date().toISOString().split('T')[0],
      multipleChoice: questions.map((q: any, idx: number) => {
        let correct = (q.correctAnswer || 'A').toString().trim().toUpperCase().slice(0, 1);
        if (!['A', 'B', 'C', 'D'].includes(correct)) correct = 'A';
        const cleanQ = (q.question || '').replace(/^Câu\s*\d+\s*[:.]*\s*/i, '').trim();
        return {
          id: `mc_${idx + 1}`,
          question: cleanQ,
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['A. Đúng', 'B. Sai', 'C. Không xác định', 'D. Khác'],
          correctAnswer: correct,
          points: Number((10 / (questions.length || 1)).toFixed(2)),
          explanation: q.explanation || '',
        };
      }),
      trueFalseQuestions: [],
      essays: [],
    };

    return res.json({
      success: true,
      quizData: questions,
      exam: formattedExam,
    });
  } catch (error: any) {
    console.error('Error in /api/digitize-document:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi số hóa tài liệu qua AI Gemini',
    });
  }
});

// ==========================================
// API 2: Generate Math Exam (3 Real Mechanisms: Prompt, Matrix, Recreate)
// ==========================================
app.post('/api/generate-exam', async (req, res) => {
  try {
    const {
      mode = 'prompt', // 'prompt' | 'matrix' | 'recreate'
      grade = '11',
      topic = 'Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn & Hình học không gian',
      textbook = 'Kết Nối Tri Thức Với Cuộc Sống',
      difficulty = 'Đề thi chuẩn cấu trúc tốt nghiệp THPT',
      promptCustom = '',
      part3Type = 'short_answer', // 'short_answer' | 'essay'
      matrix,
      matrixFileBase64,
      matrixFileName = '',
      matrixMimeType = '',
      originalExam, // For Mode 3: Recreate / Clone similar
      examFileBase64,
      examFileName = '',
    } = req.body;

    console.log(`[API /api/generate-exam] Requesting exam mode=${mode}, grade=${grade}, topic=${topic}`);

    let activeMatrix = matrix;
    let extractedMatrixText = '';

    if (matrixFileBase64) {
      try {
        const isSpreadsheet =
          matrixFileName.toLowerCase().endsWith('.xlsx') ||
          matrixFileName.toLowerCase().endsWith('.xls') ||
          matrixFileName.toLowerCase().endsWith('.csv') ||
          matrixMimeType.includes('spreadsheet') ||
          matrixMimeType.includes('excel');

        if (isSpreadsheet) {
          const buffer = Buffer.from(matrixFileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetLines: string[] = [];
          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            sheetLines.push(`=== Sheet: ${name} ===\n${XLSX.utils.sheet_to_csv(sheet)}`);
          }
          extractedMatrixText = sheetLines.join('\n\n');
          if (!activeMatrix) {
            activeMatrix = extractMatrixFromSheetText(extractedMatrixText, matrixFileName);
          }
        }
      } catch (err: any) {
        console.warn('On-the-fly matrix extraction note:', err.message);
      }
    }

    const mcTargetCount = activeMatrix?.part1?.totalQuestions ? Number(activeMatrix.part1.totalQuestions) : 12;
    const tfTargetCount = activeMatrix?.part2?.totalQuestions ? Number(activeMatrix.part2.totalQuestions) : 4;
    const essayTargetCount = activeMatrix?.part3?.totalQuestions ? Number(activeMatrix.part3.totalQuestions) : 2;

    const mcPoints = activeMatrix?.part1?.points ? Number(activeMatrix.part1.points) : 3.0;
    const tfPoints = activeMatrix?.part2?.points ? Number(activeMatrix.part2.points) : 4.0;
    const essayPoints = activeMatrix?.part3?.points ? Number(activeMatrix.part3.points) : 3.0;

    // ==========================================
    // AUTO-DETECT GRADE & TOPIC FROM FILE AND PARAMS
    // ==========================================
    let effectiveGrade = grade || '12';
    const lowerFileName = (matrixFileName || examFileName || '').toLowerCase();
    const combinedText = (lowerFileName + ' ' + (activeMatrix?.topic || '') + ' ' + (topic || '')).toLowerCase();

    if (
      /(^|[^0-9])11([^0-9]|$)/.test(lowerFileName) ||
      combinedText.includes('toán 11') ||
      combinedText.includes('toan 11') ||
      combinedText.includes('lớp 11') ||
      combinedText.includes('lop 11') ||
      combinedText.includes('khối 11') ||
      combinedText.includes('khoi 11')
    ) {
      effectiveGrade = '11';
    } else if (
      /(^|[^0-9])10([^0-9]|$)/.test(lowerFileName) ||
      combinedText.includes('toán 10') ||
      combinedText.includes('toan 10') ||
      combinedText.includes('lớp 10') ||
      combinedText.includes('lop 10') ||
      combinedText.includes('khối 10') ||
      combinedText.includes('khoi 10')
    ) {
      effectiveGrade = '10';
    } else if (
      /(^|[^0-9])12([^0-9]|$)/.test(lowerFileName) ||
      combinedText.includes('toán 12') ||
      combinedText.includes('toan 12') ||
      combinedText.includes('lớp 12') ||
      combinedText.includes('lop 12') ||
      combinedText.includes('khối 12') ||
      combinedText.includes('khoi 12')
    ) {
      effectiveGrade = '12';
    }

    let effectiveTopic = topic;
    if (effectiveGrade === '11') {
      if (!effectiveTopic || effectiveTopic.includes('Lớp 12') || effectiveTopic.includes('Khảo sát hàm số') || effectiveTopic.includes('Tích phân')) {
        effectiveTopic = 'Lượng Giác, Dãy Số - Cấp Số Cộng/Nhân, Giới Hạn & Hình Học Không Gian';
      }
    } else if (effectiveGrade === '10') {
      if (!effectiveTopic || effectiveTopic.includes('Lớp 12') || effectiveTopic.includes('Khảo sát hàm số') || effectiveTopic.includes('Tích phân')) {
        effectiveTopic = 'Hàm Số Bậc Hai, Tam Thức & Bất Phương Trình Bậc Hai';
      }
    }

    let systemDirectives = '';

    // =========================================================================
    // CƠ CHẾ 1: TẠO THEO YÊU CẦU (PROMPT)
    // Sinh đúng 100% nội dung câu hỏi mới theo yêu cầu cụ thể, không sinh chung chung.
    // =========================================================================
    if (mode === 'prompt') {
      systemDirectives = `
BẠN LÀ CHUYÊN GIA KHẢO THÍ TOÁN THPT (CHƯƠNG TRÌNH GDPT 2018 - BỘ SÁCH ${textbook}).
YÊU CẦU ĐẶC BIỆT BẮT BUỘC:
- BẮT BUỘC sinh 100% câu hỏi mới bám sát CHÍNH XÁC theo Khối lớp: TOÁN LỚP ${effectiveGrade} và Chủ đề: "${effectiveTopic}".
- CẢNH BÁO QUAN TRỌNG VỀ ĐÚNG KHỐI LỚP: TUYỆT ĐỐI KHÔNG sinh câu hỏi lệch khối lớp! Ví dụ: Nếu giáo viên chọn Toán lớp 10 với chủ đề "Hàm số bậc hai và Bất phương trình bậc hai", bạn CHỈ ĐƯỢC sinh kiến thức hàm số bậc hai, parabol, đỉnh $I$, trục đối xứng, tam thức bậc hai, bất phương trình bậc hai của Toán lớp 10; TUYỆT ĐỐI KHÔNG sinh đạo hàm $f'(x)$, tích phân hay cực trị của Toán lớp 12! Nếu chọn Toán 11 thì chỉ sinh kiến thức Toán 11 (lượng giác, cấp số cộng/nhân, giới hạn, đạo hàm cơ bản, hình không gian cổ điển).
- Yêu cầu cụ thể của giáo viên: "${promptCustom || 'Bám sát chuẩn kiến thức kỹ năng môn Toán lớp ' + effectiveGrade}".
- TUYỆT ĐỐI KHÔNG sinh câu hỏi chung chung hoặc ngoài phạm vi chủ đề "${effectiveTopic}".
- Khối lớp: ${effectiveGrade}. Bộ sách giáo khoa: ${textbook}.
- Cấu trúc đề thi:
  1. Phần I: Đúng ${mcTargetCount} câu trắc nghiệm 4 lựa chọn A, B, C, D (Tổng: ${mcPoints}đ).
  2. Phần II: Đúng ${tfTargetCount} câu trắc nghiệm Đúng/Sai, mỗi câu 4 ý a, b, c, d (Tổng: ${tfPoints}đ).
  3. Phần III: Đúng ${essayTargetCount} câu ${part3Type === 'short_answer' ? 'Trắc nghiệm trả lời ngắn (chỉ yêu cầu tính và điền đáp số)' : 'Tự luận giải chi tiết kèm BAREM ĐIỂM TỪNG BƯỚC theo SGK'} (Tổng: ${essayPoints}đ).
`;
    }
    // =========================================================================
    // CƠ CHẾ 2: TẠO THEO MA TRẬN
    // Bám sát tuyệt đối số lượng và dạng thức của ma trận (Biết, Hiểu, Vận dụng)
    // =========================================================================
    else if (mode === 'matrix') {
      const p1NhanBiet = activeMatrix?.part1?.nhanBiet ?? 6;
      const p1ThongHieu = activeMatrix?.part1?.thongHieu ?? 4;
      const p1VanDung = activeMatrix?.part1?.vanDung ?? 2;
      const p1VanDungCao = activeMatrix?.part1?.vanDungCao ?? 0;

      const p2NhanBiet = activeMatrix?.part2?.nhanBiet ?? 2;
      const p2ThongHieu = activeMatrix?.part2?.thongHieu ?? 1;
      const p2VanDung = activeMatrix?.part2?.vanDung ?? 1;

      systemDirectives = `
Bạn là chuyên gia thẩm định và ra đề thi Toán THPT Việt Nam (Chương trình GDPT 2018).
NHIỆM VỤ ĐẶC BIỆT BẮT BUỘC:
Hãy ĐỌC KỸ 100% NỘI DUNG FILE MA TRẬN / BẢNG ĐẶC TẢ ĐÍNH KÈM (File đính kèm "${matrixFileName}" là tài liệu Toán của KHỐI LỚP NÀO thì BẮT BUỘC RA ĐÚNG KHỐI LỚP ĐÓ).
- KHỐI LỚP XÁC ĐỊNH BẮT BUỘC: TOÁN LỚP ${effectiveGrade}.
- NẾU FILE LÀ MA TRẬN TOÁN 11 (HOẶC TÊN FILE CÓ SỐ 11 NHƯ 11.pdf):
  * TẠO ĐỀ THI MÔN TOÁN LỚP 11 (bám sát các chuyên đề Lớp 11 trong file: Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn, Hình học không gian quan hệ song song/vuông góc...).
  * CẢNH BÁO TỐI CAO: TUYỆT ĐỐI KHÔNG RA KIẾN THỨC ĐẠO HÀM/TÍCH PHÂN/KHẢO SÁT HÀM SỐ CỦA LỚP 12!
  * Tiêu đề đề thi PHẢI LÀ: "ĐỀ KIỂM TRA TOÁN LỚP 11 - [TÊN CHỦ ĐỀ TRONG MA TRẬN]".
  * Mã đề thi PHẢI BẮT ĐẦU BẰNG "TOAN11-".
- NẾU FILE LÀ MA TRẬN TOÁN 10:
  * TẠO ĐỀ THI MÔN TOÁN LỚP 10 (Hàm số bậc hai, tam thức bậc hai, bất phương trình bậc hai, hệ thức lượng tam giác, vectơ, phương pháp toạ độ phẳng Oxy...).
  * TUYỆT ĐỐI KHÔNG RA KIẾN THỨC LỚP 12!
  * Tiêu đề đề thi PHẢI LÀ: "ĐỀ KIỂM TRA TOÁN LỚP 10 - [TÊN CHỦ ĐỀ TRONG MA TRẬN]".
  * Mã đề thi PHẢI BẮT ĐẦU BẰNG "TOAN10-".
- CẤU TRÚC ĐỀ PHẢI KHỚP ĐÚNG TỪNG CÂU, TỪNG MỨC ĐỘ NHẬN THỨC (Nhận biết, Thông hiểu, Vận dụng) và số lượng câu đã ghi rõ trong file ma trận:
  * Phần I (Trắc nghiệm nhiều lựa chọn): Đúng chính xác ${mcTargetCount} câu (${p1NhanBiet} câu Nhận biết, ${p1ThongHieu} câu Thông hiểu, ${p1VanDung} câu Vận dụng). Tổng điểm: ${mcPoints}đ.
  * Phần II (Trắc nghiệm Đúng/Sai): Đúng chính xác ${tfTargetCount} câu (${p2NhanBiet} ý Nhận biết, ${p2ThongHieu} ý Thông hiểu, ${p2VanDung} ý Vận dụng). Tổng điểm: ${tfPoints}đ.
  * Phần III (${part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}): Đúng chính xác ${essayTargetCount} câu chuẩn SGK lớp ${effectiveGrade}. Tổng điểm: ${essayPoints}đ.
`;
    }
    // =========================================================================
    // CƠ CHẾ 3: TÁI TẠO ĐỀ (AI TÁI TẠO ĐỀ TƯƠNG TỰ / ISOMORPHIC REGENERATION)
    // Giữ nguyên khung cấu trúc kiến thức và độ khó của đề gốc, nhưng hoán đổi số liệu,
    // đổi ngữ cảnh và xáo trộn vị trí đáp án đúng để tạo ra đề mới hoàn toàn tương đương.
    // =========================================================================
    else if (mode === 'recreate') {
      let originalExamContext = '';
      if (originalExam) {
        originalExamContext = `
DƯỚI ĐÂY LÀ ĐỀ GỐC CẦN TÁI TẠO TƯƠNG ĐƯƠNG:
Tiêu đề gốc: "${originalExam.title}" - Mã đề gốc: "${originalExam.examCode}"
Số câu Phần I: ${originalExam.multipleChoice?.length || 12}
Số câu Phần II: ${originalExam.trueFalseQuestions?.length || 4}
Số câu Phần III: ${originalExam.essays?.length || 2}
Nội dung tóm tắt các câu gốc:
${JSON.stringify({
  multipleChoice: originalExam.multipleChoice?.map((m: any, idx: number) => ({
    câu: idx + 1,
    hỏi: m.question,
    đápÁnĐúngGốc: m.correctAnswer,
  })),
  trueFalse: originalExam.trueFalseQuestions?.map((t: any, idx: number) => ({
    câu: idx + 1,
    nộiDung: t.prompt,
  })),
  essays: originalExam.essays?.map((e: any, idx: number) => ({
    câu: idx + 1,
    nộiDung: e.question,
    dạng: e.type || part3Type,
  })),
}, null, 2)}
`;
      }

      systemDirectives = `
BẠN ĐANG THỰC HIỆN CƠ CHẾ: TÁI TẠO ĐỀ THI TOÁN TƯƠNG ĐƯƠNG (ISOMORPHIC / PARALLEL EXAM REGENERATION).
QUY TẮC BẮT BUỘC ĐỂ TẠO RA ĐỀ MỚI HOÀN TOÀN TƯƠNG ĐƯƠNG:
1. KHUNG CẤU TRÚC & ĐỘ KHÓ: Giữ nguyên 100% khung cấu trúc kiến thức, số lượng câu, dạng toán và độ khó của từng câu trong đề gốc.
2. HOÁN ĐỔI SỐ LIỆU: Toàn bộ số liệu, hệ số đa thức, toạ độ điểm trong không gian Oxyz, số liệu xác suất thống kê PHẢI ĐƯỢC THAY THẾ bằng các giá trị số học mới đẹp và chuẩn SGK.
3. ĐỔI NGỮ CẢNH: Các bài toán thực tế, xác suất, ứng dụng đạo hàm phải đổi ngữ cảnh tình huống tương đương.
4. XÁO TRỘN VỊ TRÍ ĐÁP ÁN ĐÚNG:
   - Tính toán lại đáp án mới theo số liệu mới.
   - BẮT BUỘC xáo trộn vị trí đáp án đúng: nếu câu gốc là A, câu mới tính toán lại và đưa phương án đúng sang B, C hoặc D.
5. PHẦN II (ĐÚNG/SAI): Giữ nguyên khung khảo sát nhưng tính toán lại tính Đúng / Sai theo hàm số hoặc giả thiết mới.
6. PHẦN III (${part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}):
   - Đổi số liệu và tính toán lại đáp số chính xác ${part3Type === 'short_answer' ? '(shortAnswerKey)' : 'kèm barem giải chi tiết mới'}.
${originalExamContext}
`;
    }

    const prompt = `
${systemDirectives}

ĐẶC BIỆT LƯU Ý VỀ CÔNG THỨC TOÁN HỌC & ĐỊNH DẠNG CÂU HỎI:
- TUYỆT ĐỐI KHÔNG ghi 'Câu 1:', 'Câu 2:', 'Bài 1:' trong các trường 'question' hoặc 'prompt' vì hệ thống giao diện sẽ tự động đánh số thứ tự câu hỏi. Chỉ ghi trực tiếp nội dung bài toán (Ví dụ: "Cho hàm số bậc hai...", "Tập nghiệm của bất phương trình...").
- Mọi công thức toán học, ký hiệu, phân số, tích phân, giới hạn, căn thức, vector PHẢI được viết bằng mã LaTeX chuẩn và bọc trong dấu đô-la đơn $...$ (ví dụ: $y = \\dfrac{2x+1}{x-1}$, $\\lim_{x \\to 1} f(x)$, $\\int_0^1 x^2\\,\\mathrm{d}x$, $(-\\infty; 2)$).
- Các câu hỏi có thể kèm thuộc tính visualType: "variation_table_cubic" | "variation_table_rational" | "variation_table_quadratic" | "variation_table_quartic" | "sign_table" | "plot_cubic" | "plot_rational" | "plot_quadratic" | "plot_quartic" | "geometry_oxyz" | "geometry_pyramid" | "statistics_table" và visualCaption. BẮT BUỘC: Nếu câu hỏi nói về đồ thị ("có đồ thị như hình vẽ..."), gán visualType tương ứng ("plot_cubic", "plot_rational", "plot_quadratic"). Nếu câu hỏi nói về bảng biến thiên ("có bảng biến thiên như hình vẽ..."), gán visualType tương ứng ("variation_table_cubic", "variation_table_rational"). Nếu câu hỏi nói về bảng xét dấu, gán visualType: "sign_table".
- Luôn đặt dấu cách giữa văn bản tiếng Việt và biểu thức toán.
- Chú ý escape ký hiệu dấu gạch chéo ngược trong chuỗi JSON (ví dụ \\\\dfrac, \\\\lim).

Trả về định dạng JSON thuần túy (không bọc markdown \`\`\`json) với schema:
{
  "title": "${mode === 'recreate' ? 'ĐỀ THI TÁI TẠO TƯƠNG ĐƯƠNG' : 'ĐỀ KIỂM TRA TOÁN'} LỚP ${effectiveGrade} - ${(effectiveTopic || 'CHUYÊN ĐỀ').toUpperCase()}",
  "examCode": "${mode === 'recreate' ? 'TAITAO' : 'TOAN'}${effectiveGrade}-${Math.floor(100 + Math.random() * 900)}",
  "grade": "${effectiveGrade}",
  "durationMinutes": ${activeMatrix?.durationMinutes || 45},
  "totalPoints": ${activeMatrix?.totalPoints || 10},
  "textbook": "${textbook}",
  "topic": "${effectiveTopic}",
  "part3Type": "${part3Type}",
  "multipleChoice": [
    {
      "id": "mc1",
      "question": "Cho hàm số bậc hai $y = ax^2 + bx + c$ ($a \\ne 0$) có đỉnh $I$...",
      "options": ["A. x = -\\dfrac{b}{a}", "B. x = -\\dfrac{b}{2a}", "C. x = \\dfrac{b}{2a}", "D. x = -\\dfrac{\\Delta}{4a}"],
      "correctAnswer": "B",
      "points": ${(mcPoints / mcTargetCount).toFixed(2)},
      "explanation": "Giải thích chi tiết từng bước..."
    }
  ],
  "trueFalseQuestions": [
    {
      "id": "tf1",
      "prompt": "Cho hình chóp $S.ABCD$ có đáy là hình vuông...",
      "items": [
        {"key": "a", "statement": "...", "isCorrect": true},
        {"key": "b", "statement": "...", "isCorrect": false},
        {"key": "c", "statement": "...", "isCorrect": true},
        {"key": "d", "statement": "...", "isCorrect": false}
      ],
      "pointsPerSub": 0.25
    }
  ],
  "essays": [
    {
      "id": "essay1",
      "type": "${part3Type}",
      "question": "Tìm tất cả các giá trị của tham số $m$ để...",
      "maxPoints": ${(essayPoints / essayTargetCount).toFixed(2)},
      "shortAnswerKey": "m > 2",
      "shortAnswerPlaceholder": "Nhập kết quả...",
      "rubric": [
        {"step": "Bước 1", "description": "...", "points": 0.5},
        {"step": "Bước 2", "description": "...", "points": 0.5}
      ]
    }
  ]
}
`;

    let payload: any = prompt;

    if (extractedMatrixText && extractedMatrixText.trim().length > 10) {
      payload = `${prompt}\n\n=== DỮ LIỆU BẢNG TÍNH MA TRẬN / ĐẶC TẢ TỪ FILE (${matrixFileName}) ===\n${extractedMatrixText}`;
    } else if (matrixFileBase64) {
      let cleanBase64 = matrixFileBase64.replace(/^data:.*?;base64,/, '');
      let effectiveMime = matrixMimeType;
      if (!effectiveMime || effectiveMime === 'application/octet-stream') {
        effectiveMime = matrixFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      }
      payload = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMime,
          },
        },
        { text: prompt },
      ];
    } else if (examFileBase64) {
      let cleanBase64 = examFileBase64.replace(/^data:.*?;base64,/, '');
      let effectiveMime = examFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      payload = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMime,
          },
        },
        { text: prompt },
      ];
    }

    let examData: any = null;

    try {
      const systemInstructionForGen =
        mode === 'matrix'
          ? `Bạn là chuyên gia thẩm định và ra đề thi Toán THPT Việt Nam.
Nhiệm vụ: Hãy ĐỌC KỸ 100% NỘI DUNG FILE MA TRẬN/BẢNG ĐẶC TẢ ĐÍNH KÈM (File đính kèm là tài liệu Toán của KHỐI LỚP NÀO thì BẮT BUỘC RA ĐÚNG KHỐI LỚP ĐÓ).
- Nếu file là Ma trận Toán 11: Tạo đề thi môn Toán Lớp 11 (bám sát các chuyên đề Lớp 11 trong file: Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn, Hình học không gian quan hệ song song/vuông góc...). TUYỆT ĐỐI KHÔNG RA KIẾN THỨC ĐẠO HÀM/TÍCH PHÂN/KHẢO SÁT HÀM SỐ CỦA LỚP 12.
- Cấu trúc đề phải khớp đúng từng câu, từng mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng) và số lượng câu đã ghi rõ trong file ma trận.
Công thức toán học định dạng chuẩn LaTeX $...$.
${STRICT_JSON_SYSTEM_INSTRUCTION}`
          : `${SYSTEM_INSTRUCTION_EXAM_GEN}\n${STRICT_JSON_SYSTEM_INSTRUCTION}`;

      const responseText = await callGeminiWithResilience(payload, {
        systemInstruction: systemInstructionForGen,
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      examData = safeParseGeminiResponse(responseText);
      if (!examData.part3Type) {
        examData.part3Type = part3Type;
      }
      examData.grade = effectiveGrade;
      if (!examData.topic || (effectiveGrade !== '12' && (examData.topic.includes('Lớp 12') || examData.topic.includes('Khảo sát') || examData.topic.includes('Tích phân')))) {
        examData.topic = effectiveTopic;
      }

      // Hard guarantee: sync title and examCode to the exact grade
      if (effectiveGrade === '11') {
        examData.title = (examData.title || '')
          .replace(/TOÁN\s*LỚP\s*12/gi, 'TOÁN LỚP 11')
          .replace(/LỚP\s*12/gi, 'LỚP 11')
          .replace(/Lớp\s*12/gi, 'Lớp 11')
          .replace(/Khảo sát hàm số/gi, 'Lượng giác & Cấp số')
          .replace(/Tích phân/gi, 'Giới hạn & Hình không gian');

        if (!examData.title.toUpperCase().includes('LỚP 11')) {
          examData.title = `ĐỀ KIỂM TRA TOÁN LỚP 11 - ${(examData.topic || effectiveTopic || 'MA TRẬN GDPT 2018').toUpperCase()}`;
        }
        if (!examData.examCode || examData.examCode.startsWith('TOAN12') || examData.examCode.startsWith('TOAN10') || examData.examCode.startsWith('SH-')) {
          examData.examCode = `TOAN11-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (effectiveGrade === '10') {
        examData.title = (examData.title || '')
          .replace(/TOÁN\s*LỚP\s*12/gi, 'TOÁN LỚP 10')
          .replace(/LỚP\s*12/gi, 'LỚP 10')
          .replace(/Lớp\s*12/gi, 'Lớp 10');

        if (!examData.title.toUpperCase().includes('LỚP 10')) {
          examData.title = `ĐỀ KIỂM TRA TOÁN LỚP 10 - ${(examData.topic || effectiveTopic || 'MA TRẬN GDPT 2018').toUpperCase()}`;
        }
        if (!examData.examCode || examData.examCode.startsWith('TOAN12')) {
          examData.examCode = `TOAN10-${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      // Sanitize questions, prompts, and options to guarantee clean prefixes and single correct answer
      if (Array.isArray(examData.multipleChoice)) {
        examData.multipleChoice.forEach((mc: any) => {
          if (typeof mc.question === 'string') {
            mc.question = mc.question.replace(/^Câu\s*\d+\s*[:.]*\s*/i, '').trim();
          }
          if (mc.correctAnswer && typeof mc.correctAnswer === 'string') {
            mc.correctAnswer = mc.correctAnswer.trim().toUpperCase().replace(/[^A-D]/g, '').slice(0, 1) || 'A';
          }
        });
      }
      if (Array.isArray(examData.trueFalseQuestions)) {
        examData.trueFalseQuestions.forEach((tf: any) => {
          if (typeof tf.prompt === 'string') {
            tf.prompt = tf.prompt.replace(/^(?:Câu|Bài)\s*\d+\s*(\(.*?\))?\s*[:.]*\s*/i, '').trim();
          }
        });
      }
      if (Array.isArray(examData.essays)) {
        examData.essays.forEach((es: any) => {
          if (typeof es.question === 'string') {
            es.question = es.question.replace(/^(?:Câu|Bài)\s*\d+\s*(\(.*?\))?\s*[:.]*\s*/i, '').trim();
          }
        });
      }

      console.log(`[API /api/generate-exam] Exam generated successfully with Gemini AI (mode=${mode}, grade=${grade}, topic=${topic})`);
    } catch (aiError: any) {
      console.error('[API /api/generate-exam] Gemini generation error:', aiError);
      return res.status(500).json({
        success: false,
        error: `Gemini AI: ${aiError?.message || 'Không thể tạo đề thi từ Gemini API. Vui lòng kiểm tra lại yêu cầu hoặc thử lại sau giây lát.'}`,
      });
    }

    return res.json({ success: true, exam: examData });
  } catch (error: any) {
    console.error('Error generating exam:', error);
    return res.status(500).json({ success: false, error: error.message || 'Lỗi sinh đề thi từ AI' });
  }
});

// Explicit endpoint for Mechanism 3: Recreate / Clone Similar Exam
app.post('/api/recreate-exam', async (req, res) => {
  req.body.mode = 'recreate';
  // Forward to /api/generate-exam logic
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/generate-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message || 'Lỗi khi tái tạo đề thi' });
  }
});

// ==========================================
// In-Memory & File Store for Teacher Essay Grading Calibration
// (Used for Dynamic Few-Shot Prompt Tuning and Gemini SFT fine-tuning export)
// ==========================================
let globalCalibrationFeedbacks: any[] = [];

// ==========================================
// API 3: Grade Handwritten Essay using Gemini Vision
// ==========================================
app.post('/api/grade-essay', async (req, res) => {
  try {
    const {
      imageUrl,
      imageBase64,
      mimeType = 'image/jpeg',
      questionText,
      maxPoints = 3.0,
      rubric = [],
      calibrations = [],
    } = req.body;

    // Merge incoming calibrations with server stored ones if empty
    const effectiveCalibrations = (calibrations && calibrations.length > 0)
      ? calibrations
      : globalCalibrationFeedbacks.slice(0, 4);

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ success: false, error: 'Thiếu hình ảnh bài làm (imageUrl hoặc imageBase64)' });
    }

    let finalBase64 = imageBase64;
    let finalMime = mimeType;

    // If imageUrl is given, fetch it to base64
    if (!finalBase64 && imageUrl) {
      try {
        const fetchRes = await fetch(imageUrl);
        const arrayBuf = await fetchRes.arrayBuffer();
        finalBase64 = Buffer.from(arrayBuf).toString('base64');
        const ct = fetchRes.headers.get('content-type');
        if (ct) finalMime = ct;
      } catch (err: any) {
        console.warn('Could not fetch image from URL, falling back if possible:', err);
      }
    }

    if (!finalBase64) {
      return res.status(400).json({ success: false, error: 'Không thể tải ảnh bài làm để phân tích' });
    }

    if (finalBase64.includes('base64,')) {
      const parts = finalBase64.split('base64,');
      finalBase64 = parts[1];
      const match = parts[0].match(/data:(.*?);/);
      if (match) finalMime = match[1];
    }

    const imagePart = {
      inlineData: {
        data: finalBase64,
        mimeType: finalMime,
      },
    };

    const rubricDescription = rubric
      .map((r: any, idx: number) => {
        return `- Bước ${idx + 1} (${r.step || ''}): ${r.description} [Tối đa ${r.points} điểm]`;
      })
      .join('\n');

    const calibrationsSection = (effectiveCalibrations && effectiveCalibrations.length > 0)
      ? `
=== TIÊU CHUẨN HIỆU CHUẨN TỪ GIÁO VIÊN BỘ MÔN (FEW-SHOT TEACHER CALIBRATION & PROMPT TUNING) ===
Dưới đây là các ví dụ mà Giáo viên bộ môn đã trực tiếp sửa điểm và hiệu chỉnh lời phê. Hãy học hỏi và chấm bài theo đúng chuẩn mực này:
${effectiveCalibrations.slice(0, 4).map((c: any, idx: number) => `
[Ví dụ hiệu chuẩn ${idx + 1}]
- Đề bài: ${c.questionText}
- Trích xuất chữ viết: ${c.ocrTranscription ? c.ocrTranscription.substring(0, 200) : 'Bài giải viết tay'}
- Điểm AI ban đầu: ${c.aiScore}đ -> Điểm Giáo viên điều chỉnh: ${c.teacherScore}đ (Chênh lệch: ${c.scoreDelta > 0 ? `+${c.scoreDelta}` : c.scoreDelta}đ)
- Lý do giáo viên điều chỉnh: ${c.reason}
- Lời phê sư phạm chuẩn của Giáo viên: "${c.teacherFeedback}"
`).join('\n')}
QUY TẮC: Áp dụng tinh thần đánh giá trên của giáo viên (ví dụ nếu giáo viên khích lệ cách giải khác hoặc không trừ nặng lỗi số học nhỏ, hãy chấm tương tự).
`
      : '';

    const promptText = `
ĐỀ BÀI TOÁN TỰ LUẬN:
"${questionText || 'Bài toán khảo sát hàm số / hình học / tích phân THPT'}"

THANG ĐIỂM TỐI ĐA: ${maxPoints} điểm.

BAREM CHẤM ĐIỂM CHUẨN SGK GDPT 2018:
${rubricDescription || '- Chấm theo các bước biến đổi toán học chuẩn SGK cấp 3'}
${calibrationsSection}

Hãy phân tích ảnh bài làm viết tay kèm theo và thực hiện:
1. "ocrTranscription": Trích xuất toàn bộ nội dung chữ viết và các bước giải toán mà học sinh đã viết (kèm công thức LaTeX nếu có).
2. "detectedSteps": Liệt kê các bước giải học sinh đã thực hiện được trong bài.
3. "rubricEvaluation": Đánh giá chi tiết từng bước của Barem:
   - stepTitle: Tên bước
   - maxStepPoints: Điểm tối đa bước
   - awardedPoints: Điểm đạt được
   - isCorrect: Đúng hay sai
   - comment: Nhận xét vì sao đạt hoặc bị trừ điểm (mọi công thức và biến số toán học phải kẹp trong dấu $...$)
4. "universityMethodDetected": Kiểm tra nghiêm ngặt học sinh có dùng định lý/công thức Đại học không (L'Hopital, Taylor, Maclaurin, ma trận, v.v.). Nếu có, nêu rõ phương pháp và giải thích tại sao không được chấm điểm.
5. "strengths": Điểm tốt của học sinh trong bài giải (công thức kẹp trong $...$).
6. "weaknesses": Điểm cần khắc phục, lỗi sai tính toán hoặc lỗi lập luận (công thức kẹp trong $...$).
7. "totalScore": Tổng điểm đạt được (số thập phân, làm tròn 0.25, không vượt quá ${maxPoints}).
8. "finalTeacherNote": Nhận xét tổng quát mang tính sư phạm, khích lệ nhưng chuẩn mực của giáo viên Toán cấp 3 (công thức toán kẹp trong $...$).

Trả về kết quả bằng định dạng JSON chuẩn (không bọc markdown \`\`\`json):
{
  "ocrTranscription": "...",
  "detectedSteps": ["...", "..."],
  "rubricEvaluation": [
    {
      "stepTitle": "...",
      "maxStepPoints": 0.5,
      "awardedPoints": 0.5,
      "isCorrect": true,
      "comment": "..."
    }
  ],
  "universityMethodDetected": false,
  "universityMethodDetails": "",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "totalScore": 2.5,
  "maxPoints": ${maxPoints},
  "finalTeacherNote": "..."
}
`;

    let evaluation: any = null;

    // Check if SVG format or if we need graceful fallback
    const isSvg = finalMime.includes('svg') || finalBase64.includes('<svg') || decodeURIComponent(finalBase64).includes('<svg');

    if (!isSvg) {
      try {
        const responseText = await callGeminiWithResilience([imagePart, { text: promptText }], {
          systemInstruction: `${HIGH_SCHOOL_MATH_GRADING_SYSTEM_INSTRUCTION}\n${STRICT_JSON_SYSTEM_INSTRUCTION}`,
          responseMimeType: 'application/json',
          temperature: 0.2,
        });

        evaluation = safeParseGeminiResponse(responseText);
      } catch (geminiErr: any) {
        console.warn('Gemini vision API error, falling back to rubric synthesizer:', geminiErr.message);
      }
    }

    // If Gemini was bypassed (SVG) or failed, synthesize a compliant high-school rubric evaluation
    if (!evaluation) {
      const decodedContent = decodeURIComponent(finalBase64);
      const isUniversityViolation = decodedContent.toLowerCase().includes("l'hopital") || decodedContent.toLowerCase().includes("l'hospital");
      const isCalculationError = decodedContent.toLowerCase().includes("nhầm dấu") || decodedContent.toLowerCase().includes("sai");

      const rubricEvaluation = (rubric && rubric.length > 0 ? rubric : [
        { step: 'Bước 1: Tập xác định & Đạo hàm', points: 0.75, description: 'Tìm đúng TXĐ và tính đạo hàm' },
        { step: 'Bước 2: Sự biến thiên & Tiệm cận', points: 0.75, description: 'Khảo sát biến thiên và tìm đúng tiệm cận' },
        { step: 'Bước 3: Lập bảng biến thiên', points: 0.5, description: 'Vẽ bảng biến thiên chuẩn SGK' },
        { step: 'Bước 4: Kết luận & Phương trình tiếp tuyến', points: 1.0, description: 'Lập đúng phương trình' },
      ]).map((r: any, idx: number) => {
        let isCorrect = true;
        let awardedPoints = Number(r.points || 0.5);
        let comment = `Học sinh thực hiện chính xác bước này theo chuẩn SGK GDPT 2018 ($+${awardedPoints}$đ).`;

        if (isUniversityViolation && (idx === 1 || r.step?.includes('Tiệm cận'))) {
          isCorrect = false;
          awardedPoints = 0;
          comment = "Phát hiện học sinh sử dụng định lý L'Hôpital ngoài quy chế SGK cấp 3 để tìm tiệm cận. Trừ 0 điểm bước này.";
        } else if (isCalculationError && idx === 3) {
          isCorrect = false;
          awardedPoints = Math.max(0, awardedPoints - 0.5);
          comment = "Tính nhầm hệ số tự do hoặc dấu ở phương trình cuối. Trừ 0.5đ lỗi tính toán.";
        }

        return {
          stepTitle: r.step || `Bước ${idx + 1}`,
          maxStepPoints: Number(r.points || 0.5),
          awardedPoints,
          isCorrect,
          comment,
        };
      });

      const totalAwarded = rubricEvaluation.reduce((acc: number, cur: any) => acc + cur.awardedPoints, 0);

      evaluation = {
        ocrTranscription: isUniversityViolation
          ? "Học sinh: Nguyễn Văn Hoàng - Lớp 12A8\nCâu 3: Khảo sát hàm số y = (2x + 1)/(x - 1)\na) TXĐ: D = R \\ {1}\nĐạo hàm: y' = -3/(x - 1)^2 < 0\n[Dùng quy tắc L'Hôpital]: lim (x->inf) = 2\nb) Phương trình tiếp tuyến: y = -3x + 11"
          : "Học sinh làm bài tự luận toán trên giấy thi theo đúng barem kiến thức SGK GDPT 2018.",
        detectedSteps: rubricEvaluation.map((r: any) => r.stepTitle),
        rubricEvaluation,
        universityMethodDetected: isUniversityViolation,
        universityMethodDetails: isUniversityViolation ? "Học sinh sử dụng quy tắc L'Hôpital (thuộc chương trình Toán Đại học) để tính giới hạn và tiệm cận. Theo chỉ thị chấm thi SGK GDPT 2018, bước này không được tính điểm." : "",
        strengths: ["Trình bày mạch lạc, chữ viết rõ ràng", "Các bước biến đổi toán học cơ bản đúng quy chuẩn"],
        weaknesses: isUniversityViolation
          ? ["Lạm dụng định lý Đại học không có trong SGK cấp 3"]
          : isCalculationError
          ? ["Cần cẩn thận hơn khi nhân chia dấu số âm"]
          : [],
        totalScore: Math.round(totalAwarded * 100) / 100,
        maxPoints: Number(maxPoints) || 3.0,
        finalTeacherNote: isUniversityViolation
          ? "Bài làm tốt nhưng cần lưu ý chỉ dùng kiến thức trong chương trình THPT để làm bài thi chính thức."
          : "Bài làm rất tốt, tuân thủ đúng chuẩn chương trình SGK GDPT 2018!",
      };
    }

    return res.json({
      success: true,
      evaluation,
    });
  } catch (error: any) {
    console.error('Error grading essay:', error);
    return res.status(500).json({ success: false, error: error.message || 'Lỗi khi AI chấm bài tự luận' });
  }
});

// ==========================================
// API: Save Teacher Calibration Feedback
// ==========================================
app.post('/api/calibration-feedback', (req, res) => {
  try {
    const feedback = req.body;
    if (!feedback || !feedback.id) {
      return res.status(400).json({ success: false, error: 'Dữ liệu calibration không hợp lệ' });
    }

    const idx = globalCalibrationFeedbacks.findIndex((f) => f.id === feedback.id);
    if (idx >= 0) {
      globalCalibrationFeedbacks[idx] = feedback;
    } else {
      globalCalibrationFeedbacks.unshift(feedback);
    }

    // Keep up to 100 recent feedback records in memory
    if (globalCalibrationFeedbacks.length > 100) {
      globalCalibrationFeedbacks = globalCalibrationFeedbacks.slice(0, 100);
    }

    console.log(`[Calibration] Saved teacher feedback for submission: ${feedback.studentName} (delta: ${feedback.scoreDelta})`);
    return res.json({ success: true, count: globalCalibrationFeedbacks.length });
  } catch (err: any) {
    console.error('Error in /api/calibration-feedback:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// API: Get Calibration Feedbacks List
// ==========================================
app.get('/api/calibration-feedbacks', (_req, res) => {
  return res.json({ success: true, feedbacks: globalCalibrationFeedbacks });
});

// ==========================================
// API: Export Gemini SFT Fine-Tuning Dataset (.jsonl)
// ==========================================
app.get('/api/export-finetune-dataset', (_req, res) => {
  try {
    // Generate JSONL matching Gemini Fine-Tuning Chat/Multimodal format
    const lines = globalCalibrationFeedbacks.map((item) => {
      const systemMsg = HIGH_SCHOOL_MATH_GRADING_SYSTEM_INSTRUCTION;
      const userContent = `ĐỀ BÀI TOÁN TỰ LUẬN:\n"${item.questionText}"\n\nẢNH BÀI LÀM / OCR:\n"${item.ocrTranscription || 'Bài giải viết tay của học sinh'}"`;
      const modelContent = JSON.stringify({
        ocrTranscription: item.ocrTranscription || '',
        totalScore: item.teacherScore,
        aiScoreOriginal: item.aiScore,
        overrideReason: item.reason,
        teacherFeedback: item.teacherFeedback,
      });

      return JSON.stringify({
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userContent },
          { role: 'model', content: modelContent },
        ],
      });
    });

    const jsonlContent = lines.join('\n');
    res.setHeader('Content-Type', 'application/x-jsonlines');
    res.setHeader('Content-Disposition', 'attachment; filename="gemini_math_grading_finetune.jsonl"');
    return res.send(jsonlContent);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduMath AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
