import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      mode = 'prompt',
      grade = '11',
      topic = 'Lượng giác, Cấp số cộng/nhân, Giới hạn & Quan hệ song song',
      textbook = 'Kết Nối Tri Thức Với Cuộc Sống',
      part3Type = 'short_answer',
      matrixFileName = '',
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return 200 with fallback signal so client fallback takes over smoothly
      return res.status(200).json({
        fallback: true,
        message: 'No Gemini API key on Vercel server, client will render standard exam',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const prompt = `Bạn là chuyên gia soạn đề thi môn Toán cấp 3 tại Việt Nam theo chuẩn GDPT 2018.
Hãy tạo một đề thi hoàn chỉnh cho môn Toán Lớp ${grade}.
Chủ đề: ${topic}.
Bộ sách: ${textbook}.
File ma trận đính kèm: ${matrixFileName || 'Ma trận chuẩn GDPT 2018'}.

YÊU CẦU CẤU TRÚC ĐỀ THI:
- Tiêu đề (title): "ĐỀ KIỂM TRA MÔN TOÁN LỚP ${grade} - CHUẨN GDPT 2018"
- Mã đề (examCode): "TOAN${grade}-${Math.floor(100 + Math.random() * 900)}"
- multipleChoice: đúng 12 câu trắc nghiệm 4 phương án (A, B, C, D), mỗi câu 0.25đ, kèm lời giải chi tiết và đáp án đúng.
- trueFalseQuestions: đúng 4 câu đúng sai, mỗi câu gồm 4 ý a, b, c, d với isCorrect (true/false).
- essays: ${part3Type === 'short_answer' ? 'đúng 6 câu trả lời ngắn với shortAnswerKey là số đáp số' : 'đúng 2 câu tự luận kèm thang điểm rubric (0.5đ, 0.5đ, 0.5đ)'}.

CHỈ TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ THEO ĐỊNH DẠNG:
{
  "title": "...",
  "examCode": "...",
  "grade": "${grade}",
  "durationMinutes": 45,
  "totalPoints": 10,
  "textbook": "${textbook}",
  "topic": "${topic}",
  "part3Type": "${part3Type}",
  "multipleChoice": [...],
  "trueFalseQuestions": [...],
  "essays": [...]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('[Vercel API /api/generate-exam] Error:', error);
    return res.status(200).json({
      fallback: true,
      error: error?.message || 'Server error, falling back to local engine',
    });
  }
}
