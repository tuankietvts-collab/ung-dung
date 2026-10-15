import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      mode = 'prompt',
      grade = '11',
      topic = 'Lượng giác, Cấp số cộng/nhân, Giới hạn & Hình không gian',
      textbook = 'Kết Nối Tri Thức Với Cuộc Sống',
      part3Type = 'short_answer',
      promptCustom = '',
      matrix,
      matrixFileName = '',
      matrixFileBase64 = '',
      examFileName = '',
      examFileBase64 = '',
      originalExam,
      extractedText = '',
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
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

    let systemInstruction = `Bạn là chuyên gia khảo thí và ra đề thi môn Toán cấp 3 theo chuẩn GDPT 2018 của Bộ GD&ĐT Việt Nam.
CÔNG THỨC TOÁN HỌC: Bắt buộc viết bằng LaTeX chuẩn và bọc trong dấu đô la đơn $...$ (ví dụ: $f(x) = x^2 - 4x + 3$).
CHỈ TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ THEO SCHEMA YÊU CẦU. Không dùng markdown \`\`\`json.`;

    let userPrompt = '';

    if (mode === 'matrix') {
      userPrompt = `NHIỆM VỤ: Hãy đọc kỹ toàn bộ ma trận và bảng đặc tả đính kèm từ file "${matrixFileName || 'Ma trận'}".
Bám sát 100% các đơn vị kiến thức, dạng bài và số lượng câu hỏi trong ma trận để tạo đề thi Toán Lớp ${grade}:
- Phần I: 12 câu trắc nghiệm 4 lựa chọn (A, B, C, D) kèm đáp án đúng và lời giải chi tiết.
- Phần II: 4 câu đúng / sai (mỗi câu 4 ý a, b, c, d kèm isCorrect: true/false).
- Phần III: ${part3Type === 'short_answer' ? '6 câu trả lời ngắn với shortAnswerKey là số đáp số' : '2-3 câu tự luận kèm rubric thang điểm'}.

${extractedText ? `\n=== DỮ LIỆU MA TRẬN TỪ FILE ===\n${extractedText}` : ''}`;
    } else if (mode === 'recreate') {
      userPrompt = `NHIỆM VỤ: SỐ HÓA VÀ TÁI TẠO NGUYÊN BẢN ĐỀ THI TỪ FILE "${examFileName || 'Đề thi gốc'}".
Đọc thật kỹ tài liệu đính kèm và trích xuất đúng 100% các câu hỏi của đề gốc (giữ nguyên câu chữ, số liệu, 4 phương án A-B-C-D và đáp án đúng). Tuyệt đối không tạo đề mẫu mặc định!
Nếu câu có hình vẽ phức tạp trong đề gốc, hãy trích xuất trọn vẹn văn bản câu hỏi và ghi chú để giáo viên cắt ảnh dán vào câu.

${extractedText ? `\n=== NỘI DUNG ĐỀ THI GỐC TỪ FILE ===\n${extractedText}` : ''}
${originalExam ? `\n=== ĐỀ GỐC TRƯỚC ĐÓ ===\n${JSON.stringify(originalExam, null, 2)}` : ''}`;
    } else {
      userPrompt = `NHIỆM VỤ: Tạo đề thi môn Toán Lớp ${grade}.
Chủ đề: "${topic}".
Bộ sách giáo khoa: "${textbook}".
Yêu cầu cụ thể của giáo viên: "${promptCustom || 'Chuẩn cấu trúc kỳ thi tốt nghiệp THPT theo chương trình GDPT 2018'}".
Cấu trúc: 12 câu trắc nghiệm 4 lựa chọn (Phần I), 4 câu Đúng/Sai (Phần II), ${part3Type === 'short_answer' ? '6 câu trả lời ngắn (Phần III)' : '2 câu tự luận (Phần III)'}.`;
    }

    userPrompt += `\n
ĐỊNH DẠNG JSON ĐẦU RA BẮT BUỘC:
{
  "title": "${mode === 'recreate' ? 'ĐỀ THI TÁI TẠO TƯƠNG ĐƯƠNG' : 'ĐỀ KIỂM TRA MÔN TOÁN'} LỚP ${grade} - ${(topic || 'GDPT 2018').toUpperCase()}",
  "examCode": "${mode === 'recreate' ? 'TAITAO' : 'TOAN'}${grade}-${Math.floor(100 + Math.random() * 900)}",
  "grade": "${grade}",
  "durationMinutes": 45,
  "totalPoints": 10,
  "textbook": "${textbook}",
  "topic": "${topic}",
  "part3Type": "${part3Type}",
  "multipleChoice": [
    {
      "id": "mc_1",
      "question": "Nội dung bài toán...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết...",
      "points": 0.25
    }
  ],
  "trueFalseQuestions": [
    {
      "id": "tf_1",
      "prompt": "Giả thiết bài toán...",
      "items": [
        {"key": "a", "statement": "...", "isCorrect": true},
        {"key": "b", "statement": "...", "isCorrect": false},
        {"key": "c", "statement": "...", "isCorrect": true},
        {"key": "d", "statement": "...", "isCorrect": false}
      ]
    }
  ],
  "essays": [
    {
      "id": "essay_1",
      "question": "Nội dung bài...",
      "maxPoints": 1.5,
      "shortAnswerKey": "4",
      "rubric": [{"step": "Bước 1", "description": "...", "points": 0.5}]
    }
  ]
}`;

    let contents: any = userPrompt;
    if (!extractedText) {
      if (matrixFileBase64 && (matrixFileName.toLowerCase().endsWith('.pdf') || matrixFileName.toLowerCase().endsWith('.png') || matrixFileName.toLowerCase().endsWith('.jpg'))) {
        const cleanBase64 = matrixFileBase64.replace(/^data:.*?;base64,/, '');
        const mimeType = matrixFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        contents = [
          { inlineData: { data: cleanBase64, mimeType } },
          { text: userPrompt },
        ];
      } else if (examFileBase64 && (examFileName.toLowerCase().endsWith('.pdf') || examFileName.toLowerCase().endsWith('.png') || examFileName.toLowerCase().endsWith('.jpg'))) {
        const cleanBase64 = examFileBase64.replace(/^data:.*?;base64,/, '');
        const mimeType = examFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        contents = [
          { inlineData: { data: cleanBase64, mimeType } },
          { text: userPrompt },
        ];
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    return res.status(200).json({ success: true, exam: parsed });
  } catch (error: any) {
    console.error('[Vercel API /api/generate-exam] Error:', error);
    return res.status(200).json({
      fallback: true,
      error: error?.message || 'Server error, falling back to local engine',
    });
  }
}
