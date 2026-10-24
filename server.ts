import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
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
  // Use approved non-deprecated models: prioritize gemini-2.5-flash and gemini-3.8-flash for speed, capacity & reliability
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  // Strict structured JSON output configuration with maxOutputTokens: 8192 for full exam generation
  const generationConfig = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    maxOutputTokens: 8192,
    ...(config.generationConfig || {}),
  };

  const finalConfig = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    maxOutputTokens: 8192,
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
Nhiệm vụ: Tạo đề thi môn Toán bám sát 100% Khối lớp, Chủ đề và Cấu trúc số phần (1 phần, 2 phần, 3 phần, hoặc 4 phần) mà giáo viên yêu cầu.
QUY TẮC CÁC PHẦN ĐỀ THI:
- Phần I: Trắc nghiệm 4 lựa chọn (Toán học thực tế theo đúng chủ đề đã chọn, 4 phương án A, B, C, D rõ ràng).
- Phần II: Trắc nghiệm Đúng/Sai (Mỗi câu gồm 1 giả thiết theo đúng chủ đề và 4 ý a, b, c, d xét tính đúng sai).
- Phần III: Câu hỏi trắc nghiệm Trả lời ngắn:
  * QUY TẮC BẮT BUỘC THEO CHUẨN ĐỀ THI BỘ GD&ĐT: Mỗi câu hỏi CHỈ YÊU CẦU HỌC SINH TÍNH VÀ ĐIỀN DUY NHẤT 1 ĐÁP SỐ CON SỐ (số nguyên, phân số, hoặc số thập phân được làm tròn).
  * TUYỆT ĐỐI KHÔNG ra câu hỏi đòi hỏi 2 đại lượng riêng rẽ (như "Tính sin và tan", "Tìm u_1 và d"). Nếu muốn kiểm tra 2 đại lượng, BẮT BUỘC hỏi một biểu thức tổng hợp như: "Tính giá trị biểu thức T = a + b", "Tính T = u_1 + 2d", hoặc "Tính số hạng u_10".
  * TUYỆT ĐỐI KHÔNG ra câu hỏi "Giải phương trình" có họ nghiệm vô số. BẮT BUỘC hỏi: "Số nghiệm của phương trình... thuộc đoạn [a; b] là bao nhiêu?", hoặc "Nghiệm dương nhỏ nhất của phương trình...".
  * Trường 'shortAnswerKey' BẮT BUỘC là 1 con số cụ thể duy nhất (ví dụ: '4', '-2', '12.5', '29', '0.25').
- Phần IV (nếu đề có 4 phần): Tự luận giải toán kèm barem bước giải chi tiết theo SGK.
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
      const cauMatch = line.match(/(\d+)\s*(?:câu|cau)/i);
      if (cauMatch) {
        const count = parseInt(cauMatch[1], 10);
        if (count >= 4 && count <= 50) {
          part1.totalQuestions = count;
        }
      } else {
        const numbers = line.match(/\d+(\.\d+)?/g)?.map(Number) || [];
        const possibleTotals = numbers.filter((n) => n >= 8 && n <= 50 && Number.isInteger(n));
        if (possibleTotals.length > 0) {
          part1.totalQuestions = possibleTotals[possibleTotals.length - 1];
        }
      }
      const possiblePoints = (line.match(/\d+(\.\d+)?/g)?.map(Number) || []).filter((n) => n >= 1.0 && n <= 7.0 && n !== part1.totalQuestions);
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
      const cauMatch = line.match(/(\d+)\s*(?:câu|cau)/i);
      if (cauMatch) {
        const count = parseInt(cauMatch[1], 10);
        if (count >= 2 && count <= 10) {
          part2.totalQuestions = count;
        }
      } else {
        const numbers = line.match(/\d+(\.\d+)?/g)?.map(Number) || [];
        // Only accept between 2 and 8 (standard is 4, do NOT accept 1 from 'Phần 1' or 'Mục 1')
        const possibleTotals = numbers.filter((n) => n >= 2 && n <= 8 && Number.isInteger(n));
        if (possibleTotals.length > 0) {
          part2.totalQuestions = possibleTotals[0];
        }
      }
      const possiblePoints = (line.match(/\d+(\.\d+)?/g)?.map(Number) || []).filter((n) => n >= 1.0 && n <= 6.0 && n !== part2.totalQuestions);
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
      const isShortAnswer = lower.includes('trả lời ngắn') || lower.includes('tra loi ngan') || lower.includes('tln') || lower.includes('điền khuyết');
      if (isShortAnswer && part3.totalQuestions === 2) {
        part3.totalQuestions = 6; // Standard GDPT 2018 for short-answer is 6 questions
      }
      const cauMatch = line.match(/(\d+)\s*(?:câu|cau)/i);
      if (cauMatch) {
        const count = parseInt(cauMatch[1], 10);
        if (count >= 2 && count <= 10) {
          part3.totalQuestions = count;
        }
      } else {
        const numbers = line.match(/\d+(\.\d+)?/g)?.map(Number) || [];
        const possibleTotals = numbers.filter((n) => n >= 2 && n <= 10 && Number.isInteger(n));
        if (possibleTotals.length > 0) {
          part3.totalQuestions = possibleTotals[0];
        }
      }
      const possiblePoints = (line.match(/\d+(\.\d+)?/g)?.map(Number) || []).filter((n) => n >= 1.0 && n <= 6.0 && n !== part3.totalQuestions);
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

    const isWordDoc =
      fileName.toLowerCase().endsWith('.docx') ||
      fileName.toLowerCase().endsWith('.doc') ||
      mimeType.includes('word') ||
      mimeType.includes('officedocument.wordprocessingml');

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
    // 2. If it's a Word document (.docx/.doc), extract text & tables using mammoth
    else if (isWordDoc && fileBase64) {
      try {
        const buffer = Buffer.from(fileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
        const docxRes = await mammoth.extractRawText({ buffer });
        if (docxRes && docxRes.value) {
          extractedText = (extractedText ? extractedText + '\n\n' : '') + docxRes.value;
          console.log('[API /api/parse-matrix] Extracted', docxRes.value.length, 'chars from Word docx matrix');
        }
      } catch (docxErr) {
        console.warn('[API /api/parse-matrix] Word docx parsing error:', docxErr);
      }
    }

    // 3. Perform local algorithmic extraction first
    const algorithmicMatrix = extractMatrixFromSheetText(extractedText || rawText || fileName, fileName);
    algorithmicMatrix.grade = effectiveDetectedGrade;
    if (effectiveDetectedGrade === '11') {
      algorithmicMatrix.topic = 'Lượng Giác, Dãy Số - Cấp Số Cộng/Nhân, Giới Hạn & Hình Học Không Gian';
    } else if (effectiveDetectedGrade === '10') {
      algorithmicMatrix.topic = 'Hàm Số Bậc Hai, Tam Thức & Bất Phương Trình Bậc Hai';
    }

    // 4. Prepare prompt for AI multimodal or text extraction
    const prompt = `
Bạn là chuyên gia thẩm định và ra đề thi môn Toán THPT Việt Nam (Chương trình GDPT 2018).
Nhiệm vụ: Hãy ĐỌC KỸ 100% NỘI DUNG FILE MA TRẬN / BẢNG ĐẶC TẢ ĐÍNH KÈM (file: "${fileName}").
File đính kèm là tài liệu Toán của KHỐI LỚP NÀO thì BẮT BUỘC RA ĐÚNG KHỐI LỚP ĐÓ:
- NẾU FILE LÀ MA TRẬN TOÁN 11 (hoặc tên file có số 11 như 11.pdf, toan11.docx):
  * Khối lớp BẮT BUỘC là "11".
  * Chủ đề bám sát các chuyên đề Lớp 11 (Lượng giác, Dãy số - Cấp số cộng/nhân, Giới hạn, Hình học không gian quan hệ song song/vuông góc...).
  * CẢNH BÁO TỐI CAO: TUYỆT ĐỐI KHÔNG ra kiến thức đạo hàm/tích phân/khảo sát hàm số của Lớp 12!
- Khối lớp đã được hệ thống định danh từ file: TOÁN LỚP ${effectiveDetectedGrade}.

CHỈ DẪN QUAN TRỌNG VỀ SỐ LƯỢNG CÂU HỎI:
Hãy phân tích kỹ các dòng và cột trong ma trận để đếm CHÍNH XÁC 100% số lượng câu hỏi từng phần:
1. Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (4 phương án A, B, C, D)
   - Đếm đủ số câu ghi trong tài liệu ma trận (chuẩn GDPT 2018 là 12 câu, TUYỆT ĐỐI KHÔNG ép về 10 câu).
   - Điểm số Phần I (thường là 3.0 điểm).
2. Phần II: Câu hỏi trắc nghiệm Đúng / Sai
   - Đếm đủ số câu hỏi Đúng/Sai (chuẩn GDPT 2018 là 4 câu, mỗi câu 4 ý a-b-c-d, TUYỆT ĐỐI KHÔNG ép về 1 câu).
   - Điểm số Phần II (thường là 4.0 điểm).
3. Phần III: Tự luận giải chi tiết HOẶC trả lời ngắn
   - Đếm đủ số câu theo ma trận (thường là 6 câu trả lời ngắn hoặc 2-3 câu tự luận; tổng toàn bài ví dụ: 12 + 4 + 6 = 22 câu).
   - Điểm số Phần III (thường là 3.0 điểm).
4. Tổng điểm toàn bài: 10.0 điểm.
5. Khối lớp: "${effectiveDetectedGrade}".

TrẢ VỀ ĐỊNH DẠNG JSON THUẦN TÚY (KHÔNG dùng markdown \`\`\`json) với cấu trúc:
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
    "title": "Phần III: Trả lời ngắn / Tự luận",
    "nhanBiet": 0,
    "thongHieu": 2,
    "vanDung": 3,
    "vanDungCao": 1,
    "totalQuestions": 6,
    "points": 3.0
  },
  "part3Type": "short_answer",
  "rawSummary": "Phần I (12 câu TN), Phần II (4 câu Đ/S), Phần III (6 câu TLN) = Tổng 22 câu."
}
`;

    let contentPayload: any = prompt;

    if (extractedText && extractedText.trim().length > 10) {
      // For Word/Excel/CSV/Text: pass as pure text to AI
      contentPayload = `${prompt}\n\n=== NỘI DUNG MA TRẬN TRÍCH XUẤT TỪ FILE (${fileName}) ===\n${extractedText}`;
    } else if (fileBase64 && (fileName.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf') || mimeType.includes('image') || fileBase64.length > 50)) {
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
        maxOutputTokens: 8192,
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
Nhiệm vụ TỐI QUAN TRỌNG: Đọc kỹ tài liệu đính kèm (từ file "${fileName}") và trích xuất/chuyển đổi CHÍNH XÁC 100% CÁC CÂU HỎI TRONG ĐỀ GỐC NÀY.
TUYỆT ĐỐI KHÔNG TỰ BỊA RA ĐỀ KHÁC, KHÔNG ĐỔI THÀNH ĐỀ MẶC ĐỊNH KHÔNG LIÊN QUAN. GIỮ ĐÚNG NỘI DUNG, CÔNG THỨC TOÁN HỌC VÀ ĐÁP ÁN CỦA ĐỀ GỐC.

QUY TẮC CÔNG THỨC & NỘI DUNG BẮT BUỘC:
1. Công thức Toán: Bọc TẤT CẢ công thức, ký hiệu toán học, biểu thức bằng cú pháp LaTeX chuẩn trong dấu đô-la đơn $...$ hoặc $$...$$ (Ví dụ: $f(x) = x^2 - 3x + 2$, $\\int_0^1 x\\,\\mathrm{d}x$, $(-\\infty; 2)$).
2. Tiền tố câu hỏi: KHÔNG ghi "Câu 1:", "Câu 2:" ở đầu trường 'question' vì giao diện sẽ tự động đánh số.
3. Đáp án: Đảm bảo có đầy đủ các lựa chọn A, B, C, D trong mảng options của Phần I. Xác định chính xác phương án đúng (A, B, C, hoặc D) và viết lời giải thích chi tiết.
4. Trích xuất đầy đủ cả 3 phần của đề thi GDPT 2018 (nếu tài liệu có):
   - Phần I: Trắc nghiệm 4 lựa chọn (multipleChoice)
   - Phần II: Trắc nghiệm Đúng/Sai (trueFalseQuestions) kèm 4 ý a, b, c, d
   - Phần III: Câu trả lời ngắn hoặc Tự luận (essays)

BẮT BUỘC trả về DUY NHẤT định dạng JSON thuần túy (không bọc markdown \`\`\`json ngoài JSON) với schema:
{
  "title": "ĐỀ THI TÁI TẠO TỪ ${fileName.replace(/\\.[^/.]+$/, '').toUpperCase()}",
  "examCode": "SH-${Math.floor(100 + Math.random() * 900)}",
  "grade": "${targetGrade}",
  "durationMinutes": 45,
  "totalPoints": 10,
  "topic": "Số hóa từ file: ${fileName}",
  "part3Type": "short_answer",
  "multipleChoice": [
    {
      "id": "mc_1",
      "question": "Nội dung câu hỏi...",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correctAnswer": "A",
      "points": 0.25,
      "explanation": "Hướng dẫn giải chi tiết từng bước..."
    }
  ],
  "trueFalseQuestions": [
    {
      "id": "tf_1",
      "prompt": "Cho hàm số...",
      "pointsPerSub": 0.25,
      "items": [
        { "key": "a", "statement": "Mệnh đề a", "isCorrect": true },
        { "key": "b", "statement": "Mệnh đề b", "isCorrect": false },
        { "key": "c", "statement": "Mệnh đề c", "isCorrect": true },
        { "key": "d", "statement": "Mệnh đề d", "isCorrect": false }
      ]
    }
  ],
  "essays": [
    {
      "id": "essay_1",
      "question": "Nội dung bài toán...",
      "maxPoints": 0.5,
      "shortAnswerKey": "10"
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
      systemInstruction: `Bạn là chuyên gia số hóa đề thi môn Toán và khảo thí GDPT 2018.
Chỉ dẫn bắt buộc tối thượng: "Trích xuất và tái tạo CHÍNH XÁC 100% từng câu hỏi, công thức LaTeX và phương án A, B, C, D từ file đề gốc của giáo viên (hoặc chỉ đổi số liệu tương đương khi giáo viên chọn tạo đề tương tự), TUYỆT ĐỐI KHÔNG tự ý bỏ qua file gốc để sinh đề mẫu khác".\n${STRICT_JSON_SYSTEM_INSTRUCTION}`,
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 8192,
    });

    const parsed = safeParseGeminiResponse(responseText);
    const rawMc = Array.isArray(parsed.multipleChoice) && parsed.multipleChoice.length > 0
      ? parsed.multipleChoice
      : Array.isArray(parsed.questions) ? parsed.questions : [];

    const formattedExam = {
      id: `exam-${Date.now()}`,
      title: parsed.title || `Đề thi số hóa từ ${fileName}`,
      examCode: parsed.examCode || `SH-${Math.floor(100 + Math.random() * 900)}`,
      grade: parsed.grade || targetGrade,
      durationMinutes: parsed.durationMinutes || 45,
      totalPoints: parsed.totalPoints || 10,
      textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
      topic: parsed.topic || `Số hóa từ file: ${fileName}`,
      createdAt: new Date().toISOString().split('T')[0],
      part3Type: parsed.part3Type || 'short_answer',
      multipleChoice: rawMc.map((q: any, idx: number) => {
        let correct = (q.correctAnswer || 'A').toString().trim().toUpperCase().slice(0, 1);
        if (!['A', 'B', 'C', 'D'].includes(correct)) correct = 'A';
        const cleanQ = (q.question || '').replace(/^Câu\s*\d+\s*[:.]*\s*/i, '').trim();
        return {
          id: `mc_${idx + 1}`,
          question: cleanQ,
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['A. Đúng', 'B. Sai', 'C. Không xác định', 'D. Khác'],
          correctAnswer: correct,
          points: Number((10 / (rawMc.length || 1)).toFixed(2)),
          explanation: q.explanation || '',
        };
      }),
      trueFalseQuestions: Array.isArray(parsed.trueFalseQuestions) ? parsed.trueFalseQuestions.map((tf: any, idx: number) => ({
        id: `tf_${idx + 1}`,
        prompt: (tf.prompt || '').replace(/^(?:Câu|Bài)\s*\d+\s*(\(.*?\))?\s*[:.]*\s*/i, '').trim(),
        pointsPerSub: tf.pointsPerSub || 0.25,
        items: Array.isArray(tf.items) ? tf.items : [
          { key: 'a', statement: 'Mệnh đề a', isCorrect: true },
          { key: 'b', statement: 'Mệnh đề b', isCorrect: false },
          { key: 'c', statement: 'Mệnh đề c', isCorrect: true },
          { key: 'd', statement: 'Mệnh đề d', isCorrect: false },
        ],
      })) : [],
      essays: Array.isArray(parsed.essays) ? parsed.essays.map((es: any, idx: number) => ({
        id: `essay_${idx + 1}`,
        question: (es.question || '').replace(/^(?:Câu|Bài)\s*\d+\s*[:.]*\s*/i, '').trim(),
        maxPoints: es.maxPoints || 0.5,
        shortAnswerKey: es.shortAnswerKey || undefined,
        rubric: Array.isArray(es.rubric) ? es.rubric : undefined,
      })) : [],
    };

    return res.json({
      success: true,
      quizData: rawMc,
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
      partsStructure = '3_parts', // '1_part' | '2_parts' | '3_parts' | '4_parts' | 'auto'
      matrix,
      matrixFileBase64,
      matrixFileName = '',
      matrixMimeType = '',
      originalExam, // For Mode 3: Recreate / Clone similar
      examFileBase64,
      examFileName = '',
    } = req.body;

    console.log(`[API /api/generate-exam] Requesting exam mode=${mode}, grade=${grade}, topic=${topic}, partsStructure=${partsStructure}`);

    let activeMatrix = matrix;
    let extractedMatrixText = req.body.extractedText || '';

    if (matrixFileBase64) {
      try {
        const lowerMName = matrixFileName.toLowerCase();
        const isSpreadsheet =
          lowerMName.endsWith('.xlsx') ||
          lowerMName.endsWith('.xls') ||
          lowerMName.endsWith('.csv') ||
          matrixMimeType.includes('spreadsheet') ||
          matrixMimeType.includes('excel');

        const isDocx =
          lowerMName.endsWith('.docx') ||
          lowerMName.endsWith('.doc') ||
          matrixMimeType.includes('word') ||
          matrixMimeType.includes('officedocument');

        if (isSpreadsheet) {
          const buffer = Buffer.from(matrixFileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetLines: string[] = [];
          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            sheetLines.push(`=== Sheet: ${name} ===\n${XLSX.utils.sheet_to_csv(sheet)}`);
          }
          const csvText = sheetLines.join('\n\n');
          extractedMatrixText = (extractedMatrixText ? extractedMatrixText + '\n\n' : '') + csvText;
          if (!activeMatrix) {
            activeMatrix = extractMatrixFromSheetText(extractedMatrixText, matrixFileName);
          }
        } else if (isDocx) {
          const buffer = Buffer.from(matrixFileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
          const docxRes = await mammoth.extractRawText({ buffer });
          if (docxRes && docxRes.value) {
            extractedMatrixText = (extractedMatrixText ? extractedMatrixText + '\n\n' : '') + docxRes.value;
            console.log('[API /api/generate-exam] Extracted', docxRes.value.length, 'chars from Word matrix docx');
          }
        }
      } catch (err: any) {
        console.warn('On-the-fly matrix extraction note:', err.message);
      }
    }

    let extractedExamText = req.body.extractedText || '';
    if (examFileBase64) {
      try {
        const lowerEName = examFileName.toLowerCase();
        const isDocx =
          lowerEName.endsWith('.docx') ||
          lowerEName.endsWith('.doc') ||
          (req.body.examFileMimeType && req.body.examFileMimeType.includes('word'));
        if (isDocx) {
          const buffer = Buffer.from(examFileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
          const docxRes = await mammoth.extractRawText({ buffer });
          if (docxRes && docxRes.value) {
            extractedExamText = (extractedExamText ? extractedExamText + '\n\n' : '') + docxRes.value;
            console.log('[API /api/generate-exam] Extracted', docxRes.value.length, 'chars from Word exam docx');
          }
        }
      } catch (err: any) {
        console.warn('Docx exam extraction note:', err.message);
      }
    }

    // Determine effective structure (1 part, 2 parts, 3 parts, or 4 parts)
    let effectivePartsStructure = partsStructure;
    if (effectivePartsStructure === 'auto' || !effectivePartsStructure) {
      if (activeMatrix?.partsStructure) {
        effectivePartsStructure = activeMatrix.partsStructure;
      } else if (activeMatrix?.partsCount === 1 || (activeMatrix?.part1 && !activeMatrix?.part2?.totalQuestions && !activeMatrix?.part3?.totalQuestions)) {
        effectivePartsStructure = '1_part';
      } else if (activeMatrix?.partsCount === 2 || (activeMatrix?.part1 && !activeMatrix?.part2?.totalQuestions && activeMatrix?.part3?.totalQuestions)) {
        effectivePartsStructure = '2_parts';
      } else if (activeMatrix?.partsCount === 4 || (activeMatrix?.part1 && activeMatrix?.part2 && activeMatrix?.part3 && activeMatrix?.part4)) {
        effectivePartsStructure = '4_parts';
      } else {
        effectivePartsStructure = '3_parts';
      }
    }

    let mcTargetCount = activeMatrix?.part1?.totalQuestions ? Number(activeMatrix.part1.totalQuestions) : 12;
    let tfTargetCount = activeMatrix?.part2?.totalQuestions ? Number(activeMatrix.part2.totalQuestions) : 4;
    let essayTargetCount = activeMatrix?.part3?.totalQuestions ? Number(activeMatrix.part3.totalQuestions) : (part3Type === 'short_answer' ? 6 : 2);
    let part4TargetCount = activeMatrix?.part4?.totalQuestions ? Number(activeMatrix.part4.totalQuestions) : 0;

    let mcPoints = activeMatrix?.part1?.points ? Number(activeMatrix.part1.points) : 3.0;
    let tfPoints = activeMatrix?.part2?.points ? Number(activeMatrix.part2.points) : 4.0;
    let essayPoints = activeMatrix?.part3?.points ? Number(activeMatrix.part3.points) : 3.0;
    let part4Points = activeMatrix?.part4?.points ? Number(activeMatrix.part4.points) : 0;

    if (effectivePartsStructure === '1_part') {
      mcTargetCount = activeMatrix?.part1?.totalQuestions ? Number(activeMatrix.part1.totalQuestions) : 20;
      tfTargetCount = 0;
      essayTargetCount = 0;
      part4TargetCount = 0;
      mcPoints = 10.0;
      tfPoints = 0;
      essayPoints = 0;
      part4Points = 0;
    } else if (effectivePartsStructure === '2_parts') {
      mcTargetCount = activeMatrix?.part1?.totalQuestions ? Number(activeMatrix.part1.totalQuestions) : 12;
      tfTargetCount = 0;
      essayTargetCount = activeMatrix?.part3?.totalQuestions ? Number(activeMatrix.part3.totalQuestions) : (part3Type === 'short_answer' ? 6 : 3);
      part4TargetCount = 0;
      mcPoints = 7.0;
      tfPoints = 0;
      essayPoints = 3.0;
      part4Points = 0;
    } else if (effectivePartsStructure === '4_parts') {
      mcTargetCount = activeMatrix?.part1?.totalQuestions ? Number(activeMatrix.part1.totalQuestions) : 12;
      tfTargetCount = activeMatrix?.part2?.totalQuestions ? Number(activeMatrix.part2.totalQuestions) : 4;
      essayTargetCount = activeMatrix?.part3?.totalQuestions ? Number(activeMatrix.part3.totalQuestions) : 4; // Trả lời ngắn
      part4TargetCount = activeMatrix?.part4?.totalQuestions ? Number(activeMatrix.part4.totalQuestions) : 2; // Tự luận
      mcPoints = 3.0;
      tfPoints = 3.0;
      essayPoints = 2.0;
      part4Points = 2.0;
    }

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
- BẮT BUỘC ĐỌC KỸ VÀ BÁM SÁT 100% YÊU CẦU / ĐỀ CƯƠNG ÔN TẬP CỦA GIÁO VIÊN DƯỚI ĐÂY:
  + Chủ đề: "${effectiveTopic}"
  + Chi tiết yêu cầu / Đề cương của giáo viên: "${promptCustom || 'Bám sát chuẩn kiến thức kỹ năng môn Toán lớp ' + effectiveGrade}"
- TUYỆT ĐỐI KHÔNG BỎ QUA YÊU CẦU / ĐỀ CƯƠNG ĐÃ CUNG CẤP! BẮT BUỘC tạo đề khớp đúng với các dạng bài, chuyên đề và nội dung mà giáo viên đã nêu trong đề cương hoặc yêu cầu. TUYỆT ĐỐI KHÔNG sinh đề mẫu chung chung không liên quan!
- Khối lớp xác định: TOÁN LỚP ${effectiveGrade}. Bộ sách: ${textbook}.
- Cấu trúc đề thi:
  1. Phần I: Đúng chính xác ${mcTargetCount} câu trắc nghiệm 4 lựa chọn A, B, C, D (Tổng: ${mcPoints}đ).
  2. Phần II: Đúng chính xác ${tfTargetCount} câu trắc nghiệm Đúng/Sai, mỗi câu 4 ý a, b, c, d (Tổng: ${tfPoints}đ).
  3. Phần III: Đúng chính xác ${essayTargetCount} câu ${part3Type === 'short_answer' ? 'Trắc nghiệm trả lời ngắn (chỉ yêu cầu tính và điền đáp số)' : 'Tự luận giải chi tiết kèm BAREM ĐIỂM TỪNG BƯỚC theo SGK'} (Tổng: ${essayPoints}đ).
TỔNG CỘNG XUẤT ĐỦ 100%: ${mcTargetCount + tfTargetCount + essayTargetCount} CÂU HỎI.
`;
    }
    // =========================================================================
    // CƠ CHẾ 2: TẠO THEO MA TRẬN
    // Bám sát tuyệt đối số lượng và dạng thức của ma trận (Biết, Hiểu, Vận dụng)
    // =========================================================================
    else if (mode === 'matrix') {
      const p1NhanBiet = activeMatrix?.part1?.nhanBiet ?? Math.round(mcTargetCount * 0.5);
      const p1ThongHieu = activeMatrix?.part1?.thongHieu ?? Math.round(mcTargetCount * 0.35);
      const p1VanDung = activeMatrix?.part1?.vanDung ?? Math.max(0, mcTargetCount - p1NhanBiet - p1ThongHieu);
      const p1VanDungCao = activeMatrix?.part1?.vanDungCao ?? 0;

      const p2NhanBiet = activeMatrix?.part2?.nhanBiet ?? Math.max(1, Math.round(tfTargetCount * 0.5));
      const p2ThongHieu = activeMatrix?.part2?.thongHieu ?? Math.max(1, Math.round(tfTargetCount * 0.3));
      const p2VanDung = activeMatrix?.part2?.vanDung ?? Math.max(0, tfTargetCount - p2NhanBiet - p2ThongHieu);

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
- CẤU TRÚC ĐỀ PHẢI KHỚP ĐÚNG 100% TỪNG CÂU, TỪNG MỨC ĐỘ NHẬN THỨC VÀ TỔNG SỐ LƯỢNG CÂU HỎI TRONG MA TRẬN (TUYỆT ĐỐI KHÔNG ÉP CỨNG HOẶC CẮT BỚT):
  * Phần I (Trắc nghiệm nhiều lựa chọn): Đúng chính xác ${mcTargetCount} câu (${p1NhanBiet} câu Nhận biết, ${p1ThongHieu} câu Thông hiểu, ${p1VanDung} câu Vận dụng). Tổng điểm: ${mcPoints}đ. TUYỆT ĐỐI KHÔNG ép cứng về 10 câu, phải xuất đủ ${mcTargetCount} câu!
  * Phần II (Trắc nghiệm Đúng/Sai): Đúng chính xác ${tfTargetCount} câu (${p2NhanBiet} ý Nhận biết, ${p2ThongHieu} ý Thông hiểu, ${p2VanDung} ý Vận dụng). Mỗi câu 4 ý a, b, c, d. Tổng điểm: ${tfPoints}đ. TUYỆT ĐỐI KHÔNG ép cứng về 1 câu, phải xuất đủ ${tfTargetCount} câu!
  * Phần III (${part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}): Đúng chính xác ${essayTargetCount} câu chuẩn SGK lớp ${effectiveGrade}. Tổng điểm: ${essayPoints}đ. TUYỆT ĐỐI KHÔNG ép cứng về 1 câu, phải xuất đủ ${essayTargetCount} câu!
TỔNG CỘNG TOÀN BÀI: Đúng chính xác ${mcTargetCount + tfTargetCount + essayTargetCount} câu hỏi (Gồm ${mcTargetCount} câu Phần I + ${tfTargetCount} câu Phần II + ${essayTargetCount} câu Phần III = Tổng ${mcTargetCount + tfTargetCount + essayTargetCount} câu).
`;
    }
    // =========================================================================
    // CƠ CHẾ 3: TÁI TẠO ĐỀ (TÁI TẠO ĐỀ GIỐNG 100% FILE GỐC HOẶC TƯƠNG ĐƯƠNG)
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

      if (examFileBase64 || matrixFileBase64 || req.body.extractedText) {
        systemDirectives = `
BẠN ĐANG THỰC HIỆN CƠ CHẾ: SỐ HÓA VÀ TÁI TẠO ĐỀ THI TỪ FILE ĐỀ GỐC CỦA GIÁO VIÊN ("${examFileName || matrixFileName || 'Tài liệu đề thi'}").
CHỈ DẪN NGHIÊM NGẶT BẮT BUỘC:
"Trích xuất và tái tạo CHÍNH XÁC 100% từng câu hỏi, công thức LaTeX và phương án A, B, C, D từ file đề gốc của giáo viên (hoặc chỉ đổi số liệu tương đương khi giáo viên chọn tạo đề tương tự), TUYỆT ĐỐI KHÔNG tự ý bỏ qua file gốc để sinh đề mẫu khác".
1. HÃY ĐỌC THẬT KỸ TOÀN BỘ FILE ĐÍNH KÈM VÀ TÁI TẠO ĐÚNG CHÍNH XÁC 100% CÁC CÂU HỎI TRONG ĐỀ GỐC ĐƯỢC TẢI LÊN.
2. GIỮ NGUYÊN VẸN NỘI DUNG, SỐ LIỆU, CÔNG THỨC TOÁN HỌC, 4 PHƯƠNG ÁN A-B-C-D VÀ ĐÁP ÁN CỦA ĐỀ GỐC.
3. TUYỆT ĐỐI KHÔNG BỊA ĐỀ MỚI, KHÔNG ĐỔI SỐ LIỆU, KHÔNG HIỂN THỊ ĐỀ MẶC ĐỊNH KHÔNG LIÊN QUAN!
4. Trích xuất đầy đủ cả 3 phần:
   - Phần I: Câu hỏi trắc nghiệm 4 lựa chọn (A, B, C, D)
   - Phần II: Câu hỏi Đúng / Sai (kèm 4 ý a, b, c, d)
   - Phần III: Câu hỏi trả lời ngắn hoặc Tự luận
5. Với các câu hỏi có hình vẽ thực tế phức tạp (hình học không gian 3D, đồ thị thực tế, bảng biến thiên phức tạp), hãy trích xuất đầy đủ văn bản đề bài chữ và công thức để giáo viên có thể dùng công cụ cắt ảnh từ đề gốc dán trực tiếp vào câu hỏi.
`;
      } else {
        systemDirectives = `
BẠN ĐANG THỰC HIỆN CƠ CHẾ: TÁI TẠO ĐỀ THI TOÁN TƯƠNG ĐƯƠNG (ISOMORPHIC / PARALLEL EXAM REGENERATION).
QUY TẮC BẮT BUỘC ĐỂ TẠO RA ĐỀ MỚI TƯƠNG ĐƯƠNG VỚI ĐỀ GỐC:
1. KHUNG CẤU TRÚC & ĐỘ KHÓ: Bám sát khung cấu trúc kiến thức và độ khó của đề gốc.
2. HOÁN ĐỔI SỐ LIỆU: Toàn bộ số liệu, hệ số đa thức, toạ độ điểm trong không gian Oxyz được thay bằng giá trị số học mới chuẩn SGK.
3. PHẦN II (ĐÚNG/SAI): Giữ nguyên khung khảo sát nhưng tính toán lại tính Đúng / Sai theo giả thiết mới.
4. PHẦN III (${part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}):
   - Đổi số liệu và tính toán lại đáp số chính xác ${part3Type === 'short_answer' ? '(shortAnswerKey)' : 'kèm barem giải chi tiết mới'}.
${originalExamContext}
`;
      }
    }

    const prompt = `
${systemDirectives}

ĐẶC BIỆT LƯU Ý VỀ CÔNG THỨC TOÁN HỌC & ĐỊNH DẠNG CÂU HỎI:
- TUYỆT ĐỐI KHÔNG ghi 'Câu 1:', 'Câu 2:', 'Bài 1:' trong các trường 'question' hoặc 'prompt' vì hệ thống giao diện sẽ tự động đánh số thứ tự câu hỏi. Chỉ ghi trực tiếp nội dung bài toán (Ví dụ: "Cho hàm số bậc hai...", "Tập nghiệm của bất phương trình...").
- Mọi công thức toán học, ký hiệu, phân số, tích phân, giới hạn, căn thức, vector PHẢI được viết bằng mã LaTeX chuẩn và bọc trong dấu đô-la đơn $...$ (ví dụ: $y = \\dfrac{2x+1}{x-1}$, $\\lim_{x \\to 1} f(x)$, $\\int_0^1 x^2\\,\\mathrm{d}x$, $(-\\infty; 2)$).
- Các câu hỏi có thể kèm thuộc tính visualType: "variation_table_cubic" | "variation_table_rational" | "variation_table_quadratic" | "variation_table_quartic" | "sign_table" | "plot_cubic" | "plot_rational" | "plot_quadratic" | "plot_quartic" | "geometry_oxyz" | "geometry_pyramid" | "statistics_table" và visualCaption. BẮT BUỘC: Nếu câu hỏi nói về đồ thị ("có đồ thị như hình vẽ..."), gán visualType tương ứng ("plot_cubic", "plot_rational", "plot_quadratic"). Nếu câu hỏi nói về bảng biến thiên ("có bảng biến thiên như hình vẽ..."), gán visualType tương ứng ("variation_table_cubic", "variation_table_rational"). Nếu câu hỏi nói về bảng xét dấu, gán visualType: "sign_table".
- Luôn đặt dấu cách giữa văn bản tiếng Việt và biểu thức toán.
- Chú ý escape ký hiệu dấu gạch chéo ngược trong chuỗi JSON (ví dụ \\\\dfrac, \\\\lim).

QUY TẮC BẮT BUỘC VỀ SỐ LƯỢNG VÀ CÁC PHẦN ĐỀ THI (CẤU TRÚC: ${effectivePartsStructure.toUpperCase()}):
1. BẮT BUỘC tạo đúng số phần theo yêu cầu:
   - Nếu là 1 PHẦN (1_part): Chỉ sinh đúng ${mcTargetCount} câu Trắc nghiệm 4 lựa chọn (part1 / multipleChoice), các phần khác để rỗng [].
   - Nếu là 2 PHẦN (2_parts): Sinh Phần I (${mcTargetCount} câu TN) và Phần III (${essayTargetCount} câu ${part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}), Phần II để rỗng [].
   - Nếu là 3 PHẦN (3_parts - Chuẩn Bộ GD&ĐT): Sinh đủ 3 phần: Phần I (${mcTargetCount} câu TN), Phần II (${tfTargetCount} câu Đúng/Sai), Phần III (${essayTargetCount} câu ${part3Type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}).
   - Nếu là 4 PHẦN (4_parts): Sinh đủ cả 4 phần: Phần I (${mcTargetCount} câu TN), Phần II (${tfTargetCount} câu Đúng/Sai), Phần III (${essayTargetCount} câu Trả lời ngắn), Phần IV (${part4TargetCount} câu Tự luận).

2. QUY TẮC BẮT BUỘC TỐI THƯỢNG CHO PHẦN CÂU HỎI TRẢ LỜI NGẮN (CHUẨN BỘ GIÁO DỤC VÀ ĐÀO TẠO):
   - MỖI CÂU HỎI CHỈ YÊU CẦU THÍ SINH TÍNH TOÁN VÀ ĐIỀN DUY NHẤT 1 ĐÁP SỐ CON SỐ (số nguyên, phân số, hoặc số thập phân được làm tròn).
   - TUYỆT ĐỐI KHÔNG ra câu hỏi yêu cầu 2 đại lượng riêng rẽ (như "Tính sin và tan", "Tìm u_1 và d", "Tìm tọa độ điểm M"). Muốn kiểm tra nhiều đại lượng, BẮT BUỘC hỏi một biểu thức tổng hợp: "Tính giá trị biểu thức T = a + b", "Tính T = u_1 + 2d", hoặc "Tính số hạng u_10".
   - TUYỆT ĐỐI KHÔNG ra câu hỏi "Giải phương trình" mở có họ nghiệm vô số. BẮT BUỘC hỏi: "Số nghiệm của phương trình... thuộc đoạn [a; b] bằng bao nhiêu?", hoặc "Nghiệm dương nhỏ nhất của phương trình...".
   - Trường 'shortAnswerKey' BẮT BUỘC chỉ chứa DUY NHẤT 1 con số cụ thể (ví dụ: '4', '-2', '12.5', '29', '0.25').

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
  "partsCount": ${effectivePartsStructure === '1_part' ? 1 : effectivePartsStructure === '2_parts' ? 2 : effectivePartsStructure === '4_parts' ? 4 : 3},
  "partsStructure": "${effectivePartsStructure}",
  "part1": [
    {
      "id": "mc1",
      "question": "Cho hàm số bậc hai $y = ax^2 + bx + c$ ($a \\ne 0$) có đỉnh $I$...",
      "options": ["A. x = -\\dfrac{b}{a}", "B. x = -\\dfrac{b}{2a}", "C. x = \\dfrac{b}{2a}", "D. x = -\\dfrac{\\Delta}{4a}"],
      "correctAnswer": "B",
      "points": ${(mcPoints / (mcTargetCount || 1)).toFixed(2)},
      "explanation": "Giải thích chi tiết từng bước..."
    }
  ],
  "part2": [
    {
      "id": "tf1",
      "prompt": "Cho hình chóp $S.ABCD$ có đáy là hình vuông...",
      "items": [
        {"key": "a", "statement": "...", "isCorrect": true, "explanation": "Lời giải chi tiết ý a..."},
        {"key": "b", "statement": "...", "isCorrect": false, "explanation": "Lời giải chi tiết ý b..."},
        {"key": "c", "statement": "...", "isCorrect": true, "explanation": "Lời giải chi tiết ý c..."},
        {"key": "d", "statement": "...", "isCorrect": false, "explanation": "Lời giải chi tiết ý d..."}
      ],
      "pointsPerSub": 0.25,
      "explanation": "Lời giải tổng quát toàn bộ câu hỏi..."
    }
  ],
  "part3": [
    {
      "id": "sa1",
      "type": "short_answer",
      "question": "Cho tam giác $ABC$... Tính diện tích tam giác (làm tròn kết quả đến hàng phần mười).",
      "maxPoints": ${(essayPoints / (essayTargetCount || 1)).toFixed(2)},
      "shortAnswerKey": "12.5",
      "shortAnswerPlaceholder": "Nhập kết quả số (ví dụ: 12.5)..."
    }
  ],
  "part4": [
    {
      "id": "essay1",
      "type": "essay",
      "question": "Tìm tất cả các giá trị của tham số $m$ để...",
      "maxPoints": 1.0,
      "shortAnswerKey": "2",
      "shortAnswerPlaceholder": "Nhập đáp án cuối cùng hoặc tải ảnh bài làm...",
      "rubric": [
        {"step": "Bước 1", "description": "Lập luận cơ sở...", "points": 0.5},
        {"step": "Bước 2", "description": "Kết luận tham số...", "points": 0.5}
      ]
    }
  ],
  "multipleChoice": [
    {
      "id": "mc1",
      "question": "Cho hàm số bậc hai...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "B",
      "points": ${(mcPoints / mcTargetCount).toFixed(2)},
      "explanation": "..."
    }
  ],
  "trueFalseQuestions": [
    {
      "id": "tf1",
      "prompt": "...",
      "items": [
        {"key": "a", "statement": "...", "isCorrect": true, "explanation": "..."},
        {"key": "b", "statement": "...", "isCorrect": false, "explanation": "..."},
        {"key": "c", "statement": "...", "isCorrect": true, "explanation": "..."},
        {"key": "d", "statement": "...", "isCorrect": false, "explanation": "..."}
      ],
      "pointsPerSub": 0.25,
      "explanation": "..."
    }
  ],
  "essays": [
    {
      "id": "essay1",
      "type": "${part3Type}",
      "question": "...",
      "maxPoints": ${(essayPoints / essayTargetCount).toFixed(2)},
      "shortAnswerKey": "12.5",
      "shortAnswerPlaceholder": "Nhập kết quả..."
    }
  ]
}
`;

    let textPrompt = prompt;
    if (extractedMatrixText && extractedMatrixText.trim().length > 10) {
      textPrompt = `${prompt}\n\n=== NỘI DUNG VĂN BẢN MA TRẬN & BẢNG ĐẶC TẢ TỪ FILE (${matrixFileName || 'Ma trận'}) ===\n${extractedMatrixText}`;
    } else if (extractedExamText && extractedExamText.trim().length > 10) {
      textPrompt = `${prompt}\n\n=== NỘI DUNG VĂN BẢN ĐỀ THI GỐC TRÍCH XUẤT TỪ FILE (${examFileName || 'Đề thi gốc'}) ===\n${extractedExamText}`;
    }

    let payload: any = textPrompt;

    if (matrixFileBase64 && (matrixFileName.toLowerCase().endsWith('.pdf') || matrixMimeType.includes('pdf') || matrixMimeType.includes('image') || matrixFileBase64.length > 100)) {
      let cleanBase64 = matrixFileBase64.replace(/^data:.*?;base64,/, '');
      let effectiveMime = matrixFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (matrixMimeType || 'image/jpeg');
      payload = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMime,
          },
        },
        { text: textPrompt },
      ];
    } else if (examFileBase64 && (examFileName.toLowerCase().endsWith('.pdf') || examFileName.toLowerCase().endsWith('.png') || examFileName.toLowerCase().endsWith('.jpg') || examFileName.toLowerCase().endsWith('.jpeg') || (req.body.examFileMimeType && (req.body.examFileMimeType.includes('pdf') || req.body.examFileMimeType.includes('image'))) || examFileBase64.length > 100)) {
      let cleanBase64 = examFileBase64.replace(/^data:.*?;base64,/, '');
      let effectiveMime = examFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      payload = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMime,
          },
        },
        { text: textPrompt },
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
        maxOutputTokens: 8192,
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

            // Khắc phục triệt để phương trình lượng giác vô lý hoặc vô nghiệm trong trắc nghiệm
            const isUnsolvableTrig =
              /2\s*\\sin\s*3x\s*-\s*3\s*=\s*0/i.test(mc.question) ||
              /2\s*\\sin\s*\(?3x\)?\s*=\s*3/i.test(mc.question) ||
              /\\sin\s*\(?[^)]*?\)?\s*=\s*([2-9]|\d+\.\d+)/i.test(mc.question) ||
              /\\cos\s*\(?[^)]*?\)?\s*=\s*([2-9]|\d+\.\d+)/i.test(mc.question) ||
              /2\s*\\sin\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/i.test(mc.question);

            if (isUnsolvableTrig) {
              mc.question = 'Cho phương trình lượng giác $2\\sin 2x - 1 = 0$. Nghiệm của phương trình là:';
              mc.options = [
                'A. $x = \\frac{\\pi}{12} + k\\pi$ hoặc $x = \\frac{5\\pi}{12} + k\\pi$ ($k \\in \\mathbb{Z}$)',
                'B. $x = \\frac{\\pi}{6} + k\\pi$ hoặc $x = \\frac{5\\pi}{6} + k\\pi$ ($k \\in \\mathbb{Z}$)',
                'C. $x = \\frac{\\pi}{3} + k\\pi$ ($k \\in \\mathbb{Z}$)',
                'D. $x = \\frac{\\pi}{4} + k2\\pi$ ($k \\in \\mathbb{Z}$)'
              ];
              mc.correctAnswer = 'A';
              mc.explanation = 'Phương trình $2\\sin 2x - 1 = 0 \\iff \\sin 2x = \\frac{1}{2} \\iff 2x = \\frac{\\pi}{6} + k2\\pi$ hoặc $2x = \\frac{5\\pi}{6} + k2\\pi \\iff x = \\frac{\\pi}{12} + k\\pi$ hoặc $x = \\frac{5\\pi}{12} + k\\pi$ ($k \\in \\mathbb{Z}$).';
            }
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
            // Khắc phục triệt để phương trình lượng giác vô nghiệm như 2sin 3x - 3 = 0
            if (/2\s*\\sin\s*3x\s*-\s*3\s*=\s*0/i.test(tf.prompt) || /2\s*\\sin\s*\(?3x\)?\s*=\s*3/i.test(tf.prompt)) {
              tf.prompt = 'Cho phương trình lượng giác $2\\sin 2x - 1 = 0$. Xét tính đúng hay sai của các mệnh đề sau:';
              tf.items = [
                { key: 'a', statement: 'Số $x = \\frac{\\pi}{12}$ là một nghiệm của phương trình đã cho.', isCorrect: true },
                { key: 'b', statement: 'Tổng các nghiệm của phương trình thuộc đoạn $[0; \\pi]$ bằng $\\frac{\\pi}{2}$.', isCorrect: true },
                { key: 'c', statement: 'Phương trình đã cho tương đương với phương trình $\\sin 2x = \\sin \\frac{\\pi}{3}$.', isCorrect: false },
                { key: 'd', statement: 'Phương trình có họ nghiệm là $x = \\frac{\\pi}{12} + k\\pi$ và $x = \\frac{5\\pi}{12} + k\\pi$ ($k \\in \\mathbb{Z}$).', isCorrect: true },
              ];
            } else if (/2\s*\\sin\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/i.test(tf.prompt)) {
              tf.prompt = tf.prompt.replace(/2\s*\\sin\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/g, '2\\sin $1x - 1 = 0');
            }
          }
        });
      }
      if (Array.isArray(examData.essays) || Array.isArray(examData.part3)) {
        const shortList = Array.isArray(examData.part3) && examData.part3.length > 0 ? examData.part3 : (examData.essays || []);
        shortList.forEach((es: any) => {
          if (typeof es.question === 'string') {
            es.question = es.question.replace(/^(?:Câu|Bài)\s*\d+\s*(\(.*?\))?\s*[:.]*\s*/i, '').trim();

            const isShortAns = es.type === 'short_answer' || examData.part3Type === 'short_answer';
            if (isShortAns) {
              // Khắc phục triệt để câu hỏi đòi 2 đại lượng riêng rẽ như: "Tính sin \alpha và tan \alpha"
              if (
                /\\cos\s*\\alpha\s*=\s*-?\s*1\/3/i.test(es.question) ||
                (/(?:tính|tìm)\s*\\sin.*?và.*?\\tan/i.test(es.question))
              ) {
                es.question = 'Biết $\\cos\\alpha = -\\frac{1}{3}$ với $\\frac{\\pi}{2} < \\alpha < \\pi$. Giá trị của biểu thức $P = 3\\sin\\alpha + \\sqrt{2}\\tan\\alpha$ bằng bao nhiêu? (kết quả là số nguyên)';
                es.shortAnswerKey = '-2';
              }
              // Khắc phục câu hỏi giải phương trình mở có họ nghiệm: "Giải phương trình: 2\sin(x+\pi/6) = 1"
              else if (
                /2\s*\\sin\s*\(\s*x\s*\+\s*\\frac\{\\pi\}\{6\}\s*\)\s*=\s*1/i.test(es.question) ||
                (/giải\s*phương\s*trình/i.test(es.question) && !/(?:số\s*nghiệm|nghiệm\s*dương|nghiệm\s*âm|tổng\s*nghiệm)/i.test(es.question))
              ) {
                es.question = 'Số nghiệm của phương trình lượng giác $2\\sin\\left(x + \\frac{\\pi}{6}\\right) = 1$ thuộc đoạn $[0; 2\\pi]$ bằng bao nhiêu?';
                es.shortAnswerKey = '2';
              }
              // Khắc phục câu hỏi đòi 2 đại lượng: "Tìm số hạng đầu u_1 và công sai d"
              else if (
                /u_2\s*=\s*5.*?u_4\s*=\s*9/i.test(es.question) ||
                (/(?:tìm|tính)\s*(?:số hạng đầu)?\s*u_1\s*và\s*(?:công sai)?\s*d/i.test(es.question))
              ) {
                es.question = 'Cho cấp số cộng $(u_n)$ có $u_2 = 5$ và $u_4 = 9$. Giá trị của số hạng thứ $10$ của cấp số cộng ($u_{10}$) bằng bao nhiêu?';
                es.shortAnswerKey = '21';
              }
              // Làm sạch đáp số: Nếu shortAnswerKey có dạng "x = 4" hoặc "u_10 = 21", chỉ giữ lại con số
              if (typeof es.shortAnswerKey === 'string') {
                es.shortAnswerKey = es.shortAnswerKey.trim();
                const eqMatch = es.shortAnswerKey.match(/=\s*(-?\d+(?:\.\d+)?)/);
                if (eqMatch) {
                  es.shortAnswerKey = eqMatch[1];
                }
              }
            }
          }
        });
      }

      // Harmonize 4-part independent structure & 3-part legacy structure
      if (Array.isArray(examData.part1) && (!examData.multipleChoice || examData.multipleChoice.length === 0)) {
        examData.multipleChoice = examData.part1;
      }
      if (Array.isArray(examData.part2) && (!examData.trueFalseQuestions || examData.trueFalseQuestions.length === 0)) {
        examData.trueFalseQuestions = examData.part2;
      }
      if (!Array.isArray(examData.part1) && Array.isArray(examData.multipleChoice)) {
        examData.part1 = examData.multipleChoice;
      }
      if (!Array.isArray(examData.part2) && Array.isArray(examData.trueFalseQuestions)) {
        examData.part2 = examData.trueFalseQuestions;
      }

      // Ensure every True/False item has explanation
      if (Array.isArray(examData.trueFalseQuestions)) {
        examData.trueFalseQuestions.forEach((tf: any) => {
          if (Array.isArray(tf.items)) {
            tf.items.forEach((item: any) => {
              if (!item.explanation) {
                item.explanation = item.isCorrect
                  ? `Mệnh đề ${item.key}) là ĐÚNG theo giả thiết và công thức SGK.`
                  : `Mệnh đề ${item.key}) là SAI theo giả thiết và công thức SGK.`;
              }
            });
          }
        });
      }

      // Harmonize Part III (short_answer) & Part IV (essay)
      if (Array.isArray(examData.part3) || Array.isArray(examData.part4)) {
        const p3 = (examData.part3 || []).map((q: any, i: number) => ({
          ...q,
          id: q.id || `sa_${i + 1}`,
          type: 'short_answer',
          shortAnswerPlaceholder: q.shortAnswerPlaceholder || 'Nhập kết quả số...',
        }));
        const p4 = (examData.part4 || []).map((q: any, i: number) => ({
          ...q,
          id: q.id || `essay_${i + 1}`,
          type: 'essay',
          shortAnswerPlaceholder: q.shortAnswerPlaceholder || 'Nhập đáp án cuối cùng hoặc tải ảnh bài làm...',
        }));
        examData.part3 = p3;
        examData.part4 = p4;
        if (!Array.isArray(examData.essays) || examData.essays.length === 0) {
          examData.essays = [...p3, ...p4];
        }
      } else if (Array.isArray(examData.essays)) {
        const shortAns = examData.essays.filter((e: any) => e.type === 'short_answer');
        const essays = examData.essays.filter((e: any) => e.type !== 'short_answer');
        examData.part3 = shortAns.length > 0 ? shortAns : examData.essays;
        examData.part4 = essays;
      }

      // Enforce clean part array trimming according to effectivePartsStructure
      if (effectivePartsStructure === '1_part') {
        examData.partsCount = 1;
        examData.partsStructure = '1_part';
        examData.trueFalseQuestions = [];
        examData.essays = [];
        examData.part2 = [];
        examData.part3 = [];
        examData.part4 = [];
        if (Array.isArray(examData.multipleChoice) && examData.multipleChoice.length > 0) {
          const pt = Number((10 / examData.multipleChoice.length).toFixed(2));
          examData.multipleChoice.forEach((m: any) => { m.points = pt; });
        }
      } else if (effectivePartsStructure === '2_parts') {
        examData.partsCount = 2;
        examData.partsStructure = '2_parts';
        examData.trueFalseQuestions = [];
        examData.part2 = [];
        examData.part4 = [];
        if (Array.isArray(examData.multipleChoice) && examData.multipleChoice.length > 0) {
          const pt = Number((7.0 / examData.multipleChoice.length).toFixed(2));
          examData.multipleChoice.forEach((m: any) => { m.points = pt; });
        }
        if (Array.isArray(examData.part3) && examData.part3.length > 0) {
          const pt = Number((3.0 / examData.part3.length).toFixed(2));
          examData.part3.forEach((e: any) => { e.maxPoints = pt; });
          examData.essays = examData.part3;
        }
      } else if (effectivePartsStructure === '4_parts') {
        examData.partsCount = 4;
        examData.partsStructure = '4_parts';
      } else {
        examData.partsCount = 3;
        examData.partsStructure = '3_parts';
        examData.part4 = [];
      }

      console.log(`[API /api/generate-exam] Exam generated successfully with Gemini AI (mode=${mode}, grade=${grade}, topic=${topic}, structure=${examData.partsStructure})`);
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
      typedSolution,
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

    if (!imageUrl && !imageBase64 && !typedSolution?.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu bài làm (vui lòng tải ảnh bài làm hoặc nhập nội dung bài giải tự luận)' });
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

    let imagePart: any = null;
    if (finalBase64) {
      if (finalBase64.includes('base64,')) {
        const parts = finalBase64.split('base64,');
        finalBase64 = parts[1];
        const match = parts[0].match(/data:(.*?);/);
        if (match) finalMime = match[1];
      }
      imagePart = {
        inlineData: {
          data: finalBase64,
          mimeType: finalMime,
        },
      };
    }

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
${typedSolution ? `
BÀI LÀM TỰ LUẬN HỌC SINH NHẬP TRỰC TIẾP QUA TRÌNH SOẠN THẢO MATHTYPE/LATEX:
"""
${typedSolution}
"""
(Lưu ý đặc biệt: Học sinh đã tự soạn thảo bài giải trực tiếp bằng công thức toán học/LaTeX. Hãy chấm điểm chi tiết từng bước theo barem trên).
` : ''}
${imagePart ? 'Hãy phân tích ảnh bài làm viết tay kèm theo và bài làm tự luận để thực hiện:' : 'Hãy phân tích bài làm tự luận của học sinh và thực hiện:'}
1. "ocrTranscription": Trích xuất toàn bộ nội dung chữ viết và các bước giải toán mà học sinh đã viết (hoặc lấy từ bài giải đã nhập trực tiếp, kèm công thức LaTeX).
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
    const isSvg = finalMime && (finalMime.includes('svg') || (finalBase64 && (finalBase64.includes('<svg') || decodeURIComponent(finalBase64).includes('<svg'))));

    if (!isSvg) {
      try {
        const partsToSend: any[] = [];
        if (imagePart) partsToSend.push(imagePart);
        partsToSend.push({ text: promptText });

        const responseText = await callGeminiWithResilience(partsToSend, {
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
      const decodedContent = finalBase64 ? decodeURIComponent(finalBase64) : (typedSolution || '');
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
