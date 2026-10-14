import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      fileName = '',
      fileBase64 = '',
      mimeType = '',
      extractedText = '',
      targetGrade = '11',
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        fallback: true,
        message: 'No GEMINI_API_KEY available on serverless environment',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const promptInstruction = `Bạn là chuyên gia số hóa đề thi môn Toán cấp 3 theo chuẩn GDPT 2018 của Bộ Giáo dục & Đào tạo Việt Nam.
Nhiệm vụ TỐI QUAN TRỌNG: Hãy đọc kỹ toàn bộ tài liệu đính kèm từ file "${fileName}".
Hãy số hóa CHÍNH XÁC 100% CÁC CÂU HỎI TRONG ĐỀ GỐC NÀY. KHÔNG ĐƯỢC TỰ BỊA RA ĐỀ MỚI, KHÔNG ĐƯỢC THAY ĐỔI CÂU HỎI CỦA ĐỀ GỐC.

CẤU TRÚC ĐỀ THI GDPT 2018 CẦN TRÍCH XUẤT:
1. Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (4 phương án A, B, C, D).
   - "question": Nội dung câu hỏi gốc (KHÔNG ghi tiền tố 'Câu 1:', 'Câu 2:' vì hệ thống sẽ tự đánh số). Bọc mọi công thức Toán trong dấu $...$ LaTeX chuẩn (ví dụ $f(x) = x^2 - 4x + 3$).
   - "options": Mảng 4 phương án đầy đủ dạng ["A. ...", "B. ...", "C. ...", "D. ..."].
   - "correctAnswer": Chữ cái đáp án đúng ('A', 'B', 'C', hoặc 'D').
   - "explanation": Lời giải chi tiết tương ứng trong đề hoặc giải thích toán học chuẩn xác.
   - "points": 0.25 (hoặc theo đề gốc).

2. Phần II: Câu hỏi trắc nghiệm Đúng / Sai.
   - Mỗi câu gồm "prompt" (nội dung bài toán dẫn dắt) và "items" là 4 ý [a, b, c, d].
   - Mỗi ý trong items gồm: "key" ("a", "b", "c", "d"), "statement" (nội dung khẳng định), "isCorrect" (true nếu đúng, false nếu sai).

3. Phần III: Câu hỏi trả lời ngắn hoặc Tự luận.
   - "question": Nội dung bài toán.
   - "shortAnswerKey": Số đáp số (nếu là dạng trả lời ngắn, ví dụ "12", "-3.5", "0.25").
   - "rubric": Mảng các bước giải và thang điểm (nếu là dạng tự luận).

NẾU CÂU HỎI CÓ HÌNH VẼ / HÌNH HỌC / ĐỒ THỊ TRONG ĐỀ GỐC:
- Ghi rõ trong question nội dung bài toán và có thể ghi thêm "(Hình vẽ thực tế trong đề gốc - hãy dùng tính năng cắt ảnh để dán vào câu)".

BẮT BUỘC TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ VỚI SCHEMA:
{
  "title": "ĐỀ THI TÁI TẠO TỪ ${fileName.replace(/\\.[^/.]+$/, '').toUpperCase()}",
  "examCode": "THPT-${Math.floor(100 + Math.random() * 900)}",
  "grade": "${targetGrade}",
  "durationMinutes": 45,
  "totalPoints": 10,
  "textbook": "Kết Nối Tri Thức Với Cuộc Sống",
  "topic": "Số hóa từ ${fileName}",
  "part3Type": "short_answer",
  "multipleChoice": [
    {
      "id": "mc_1",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A",
      "points": 0.25,
      "explanation": "..."
    }
  ],
  "trueFalseQuestions": [
    {
      "id": "tf_1",
      "prompt": "...",
      "pointsPerSub": 0.25,
      "items": [
        { "key": "a", "statement": "...", "isCorrect": true },
        { "key": "b", "statement": "...", "isCorrect": false },
        { "key": "c", "statement": "...", "isCorrect": true },
        { "key": "d", "statement": "...", "isCorrect": false }
      ]
    }
  ],
  "essays": [
    {
      "id": "essay_1",
      "question": "...",
      "maxPoints": 0.5,
      "shortAnswerKey": "10"
    }
  ]
}`;

    let contents: any = promptInstruction;

    if (extractedText && extractedText.trim().length > 0) {
      contents = `DƯỚI ĐÂY LÀ VĂN BẢN TRÍCH XUẤT TỪ FILE ĐỀ THI "${fileName}":\n\n${extractedText}\n\n${promptInstruction}`;
    } else if (fileBase64) {
      const cleanB64 = fileBase64.replace(/^data:.*?;base64,/, '');
      const effMime = mimeType || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      contents = [
        {
          inlineData: {
            data: cleanB64,
            mimeType: effMime,
          },
        },
        { text: promptInstruction },
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    return res.status(200).json({
      success: true,
      exam: parsed,
      quizData: (parsed.multipleChoice || []).map((mc: any, idx: number) => ({
        id: idx + 1,
        question: mc.question,
        options: mc.options,
        correctAnswer: mc.correctAnswer,
        explanation: mc.explanation || '',
      })),
    });
  } catch (error: any) {
    console.error('[Vercel API /api/digitize-document] Error:', error);
    return res.status(200).json({
      fallback: true,
      error: error?.message || 'Server error during digitization',
    });
  }
}
