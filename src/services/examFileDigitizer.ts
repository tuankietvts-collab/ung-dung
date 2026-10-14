import { Exam, MultipleChoiceQuestion, TrueFalseQuestion, EssayQuestion } from '../types/exam';
import { detectGradeFromFileName, getDefaultTopicForGrade } from './fileUploadService';

/**
 * Extracts text from simple PDF binary stream if uncompressed text strings are present
 */
export function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let str = '';
    const len = Math.min(bytes.length, 500000); // Read up to first 500KB
    for (let i = 0; i < len; i++) {
      const code = bytes[i];
      // Filter printable characters and common whitespace
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
        str += String.fromCharCode(code);
      }
    }

    // Extract text in parentheses (text) Tj or [(text)] TJ
    const tjMatches = str.match(/\(([^)]+)\)\s*Tj/g);
    if (tjMatches && tjMatches.length > 5) {
      const extracted = tjMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ');
      if (extracted.trim().length > 100) {
        return extracted;
      }
    }
  } catch (e) {
    console.warn('[PDF Extractor] Note:', e);
  }
  return '';
}

/**
 * Parses Vietnamese High School Math Exam Text into structured Exam object.
 * Strictly conforms to GDPT 2018 exam structure:
 * - Phần I: Câu trắc nghiệm nhiều lựa chọn (Câu 1..N kèm 4 phương án A, B, C, D)
 * - Phần II: Câu trắc nghiệm đúng sai (Câu 1..N kèm các ý a, b, c, d)
 * - Phần III: Câu trả lời ngắn hoặc tự luận
 */
export function parseExamFromDocumentText(
  rawText: string,
  fileName: string = '',
  targetGrade?: string
): Exam | null {
  if (!rawText || rawText.trim().length < 50) {
    return null;
  }

  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const detectedGrade = targetGrade || detectGradeFromFileName(fileName, cleanText) || '11';
  const effectiveGrade: '10' | '11' | '12' = detectedGrade === '10' ? '10' : detectedGrade === '12' ? '12' : '11';

  // Extract Title from first 5 lines
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
  let examTitle = '';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    if (/đề\s*thi|đề\s*kiểm\s*tra|khảo\s*sát|giữa\s*kỳ|cuối\s*kỳ|thường\s*xuyên/i.test(line)) {
      examTitle = line.replace(/^[#*_\s]+|[#*_\s]+$/g, '');
      break;
    }
  }

  if (!examTitle) {
    const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').toUpperCase();
    examTitle = `ĐỀ THI SỐ HÓA TỪ ${baseName || `MÔN TOÁN LỚP ${effectiveGrade}`}`;
  }

  // Answer key map from any answer table in the document (e.g. "1.A 2.B 3.C" or "1-A 2-B")
  const answerKeyMap: Record<number, string> = {};
  const answerKeyRegex = /(?:câu\s*)?(\d+)[\s.:-]+([A-D])\b/gi;
  let akMatch;
  const lowerText = cleanText.toLowerCase();
  const answerSectionIndex = lowerText.search(/bảng\s*đáp\s*án|đáp\s*án\s*trắc\s*nghiệm|hướng\s*dẫn\s*chấm/);
  if (answerSectionIndex !== -1) {
    const answerSub = cleanText.slice(answerSectionIndex);
    while ((akMatch = answerKeyRegex.exec(answerSub)) !== null) {
      const qNum = parseInt(akMatch[1], 10);
      const ans = akMatch[2].toUpperCase();
      answerKeyMap[qNum] = ans;
    }
  }

  // Split into Phần I, Phần II, Phần III if section headers exist
  let part1Text = '';
  let part2Text = '';
  let part3Text = '';

  const part1Index = cleanText.search(/phần\s*(?:i|1)\b/i);
  const part2Index = cleanText.search(/phần\s*(?:ii|2)\b/i);
  const part3Index = cleanText.search(/phần\s*(?:iii|3)\b/i);

  if (part1Index !== -1 && part2Index !== -1) {
    part1Text = cleanText.slice(part1Index, part2Index);
    if (part3Index !== -1 && part3Index > part2Index) {
      part2Text = cleanText.slice(part2Index, part3Index);
      part3Text = cleanText.slice(part3Index);
    } else {
      part2Text = cleanText.slice(part2Index);
    }
  } else {
    // If no distinct section headers, treat the entire text as Part 1 (or search for câu)
    part1Text = cleanText;
  }

  // =========================================================================
  // 1. PARSE PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN (MCQs)
  // =========================================================================
  const multipleChoice: MultipleChoiceQuestion[] = [];
  // Split by "Câu 1", "Câu 2", etc.
  const mcQuestionBlocks = splitTextIntoQuestions(part1Text);

  mcQuestionBlocks.forEach((block, idx) => {
    const qIndex = idx + 1;
    const { questionPrompt, options, correctAnswer, explanation } = parseSingleMcQuestion(block, qIndex, answerKeyMap[qIndex]);

    if (questionPrompt && questionPrompt.length > 5) {
      multipleChoice.push({
        id: `mc_${qIndex}`,
        question: questionPrompt,
        options: options.length === 4 ? options : ensureFourOptions(options),
        correctAnswer: correctAnswer || answerKeyMap[qIndex] || 'A',
        points: 0.25,
        explanation: explanation || '',
      });
    }
  });

  // =========================================================================
  // 2. PARSE PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (TFQs)
  // =========================================================================
  const trueFalseQuestions: TrueFalseQuestion[] = [];
  if (part2Text && part2Text.trim().length > 30) {
    const tfQuestionBlocks = splitTextIntoQuestions(part2Text);

    tfQuestionBlocks.forEach((block, idx) => {
      const qIndex = idx + 1;
      const tfParsed = parseSingleTfQuestion(block, qIndex);
      if (tfParsed) {
        trueFalseQuestions.push(tfParsed);
      }
    });
  }

  // =========================================================================
  // 3. PARSE PHẦN III: TRẢ LỜI NGẮN HOẶC TỰ LUẬN
  // =========================================================================
  const essays: EssayQuestion[] = [];
  if (part3Text && part3Text.trim().length > 30) {
    const essayBlocks = splitTextIntoQuestions(part3Text);
    essayBlocks.forEach((block, idx) => {
      const qIndex = idx + 1;
      const essayParsed = parseSingleEssayQuestion(block, qIndex);
      if (essayParsed) {
        essays.push(essayParsed);
      }
    });
  }

  // If nothing could be extracted, return null to let standard generator handle
  if (multipleChoice.length === 0 && trueFalseQuestions.length === 0 && essays.length === 0) {
    return null;
  }

  const examCode = `TOAN${effectiveGrade}-${Math.floor(100 + Math.random() * 900)}`;

  return {
    id: `exam-digitized-${Date.now()}`,
    title: examTitle,
    examCode,
    grade: effectiveGrade,
    durationMinutes: 45,
    totalPoints: 10,
    textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
    topic: `Tài liệu tải lên: ${fileName || 'Đề thi chuẩn'}`,
    createdAt: new Date().toISOString().split('T')[0],
    part3Type: essays.length > 0 && essays.some(e => e.rubric && e.rubric.length > 0) ? 'essay' : 'short_answer',
    multipleChoice: multipleChoice.length > 0 ? multipleChoice : [],
    trueFalseQuestions,
    essays,
  };
}

/**
 * Splits text into blocks based on "Câu 1.", "Câu 2:", "Bài 1:"
 */
function splitTextIntoQuestions(text: string): string[] {
  if (!text) return [];

  // Match "Câu 1.", "Câu 1:", "Bài 1."
  const splitRegex = /(?=(?:^|\n)(?:Câu|Bài)\s*\d+[\s.:])/i;
  const rawParts = text.split(splitRegex);
  return rawParts
    .map(p => p.trim())
    .filter(p => /^(?:Câu|Bài)\s*\d+[\s.:]/i.test(p));
}

/**
 * Parses a single multiple-choice question block
 */
function parseSingleMcQuestion(
  block: string,
  _questionIndex: number,
  fallbackKey?: string
): {
  questionPrompt: string;
  options: string[];
  correctAnswer: 'A' | 'B' | 'C' | 'D' | string;
  explanation: string;
} {
  // Strip "Câu X:" from beginning
  let cleanBlock = block.replace(/^(?:Câu|Bài)\s*\d+[\s.:]*/i, '').trim();

  let explanation = '';
  const explMatch = cleanBlock.match(/(?:Lời\s*giải|Hướng\s*dẫn\s*giải|Giải\s*chi\s*tiết)[\s.:]+([\s\S]*)$/i);
  if (explMatch) {
    explanation = explMatch[1].trim();
    cleanBlock = cleanBlock.slice(0, explMatch.index).trim();
  }

  // Detect explicit answer inside block (e.g. "Chọn A", "Đáp án: B", "Đáp án đúng: C")
  let detectedAnswer: 'A' | 'B' | 'C' | 'D' | string = fallbackKey || 'A';
  const ansMatch = cleanBlock.match(/(?:Chọn|Đáp\s*án\s*(?:đúng)?|Phương\s*án)[\s.:]+([A-D])\b/i);
  if (ansMatch) {
    detectedAnswer = ansMatch[1].toUpperCase();
    cleanBlock = cleanBlock.replace(/(?:Chọn|Đáp\s*án\s*(?:đúng)?|Phương\s*án)[\s.:]+[A-D]\b/gi, '').trim();
  }

  // Extract Options A, B, C, D
  // Support both multiline:
  // A. Option 1
  // B. Option 2
  // and inline: A. 1   B. 2   C. 3   D. 4
  const optARegex = /(?:^|\s)A[\s.:]+([\s\S]*?)(?=(?:^|\s)B[\s.:]+)/i;
  const optBRegex = /(?:^|\s)B[\s.:]+([\s\S]*?)(?=(?:^|\s)C[\s.:]+)/i;
  const optCRegex = /(?:^|\s)C[\s.:]+([\s\S]*?)(?=(?:^|\s)D[\s.:]+)/i;
  const optDRegex = /(?:^|\s)D[\s.:]+([\s\S]*?)$/i;

  const aMatch = cleanBlock.match(optARegex);
  const bMatch = cleanBlock.match(optBRegex);
  const cMatch = cleanBlock.match(optCRegex);
  const dMatch = cleanBlock.match(optDRegex);

  let questionPrompt = cleanBlock;
  const options: string[] = [];

  if (aMatch && bMatch && cMatch && dMatch) {
    const firstOptionIdx = cleanBlock.search(/(?:^|\s)A[\s.:]+/i);
    if (firstOptionIdx !== -1) {
      questionPrompt = cleanBlock.slice(0, firstOptionIdx).trim();
    }

    const optA = aMatch[1].trim();
    const optB = bMatch[1].trim();
    const optC = cMatch[1].trim();
    const optD = dMatch[1].trim();

    options.push(`A. ${optA}`);
    options.push(`B. ${optB}`);
    options.push(`C. ${optC}`);
    options.push(`D. ${optD}`);
  } else {
    // Try line-by-line fallback
    const lines = cleanBlock.split('\n').map(l => l.trim()).filter(Boolean);
    const nonOptLines: string[] = [];

    for (const line of lines) {
      if (/^A[\s.:]+/i.test(line)) {
        options.push(line);
      } else if (/^B[\s.:]+/i.test(line)) {
        options.push(line);
      } else if (/^C[\s.:]+/i.test(line)) {
        options.push(line);
      } else if (/^D[\s.:]+/i.test(line)) {
        options.push(line);
      } else if (options.length === 0) {
        nonOptLines.push(line);
      }
    }

    if (nonOptLines.length > 0) {
      questionPrompt = nonOptLines.join(' ');
    }
  }

  return {
    questionPrompt: questionPrompt.trim(),
    options,
    correctAnswer: detectedAnswer,
    explanation,
  };
}

function ensureFourOptions(opts: string[]): string[] {
  const result = [...opts];
  const letters = ['A', 'B', 'C', 'D'];
  for (let i = result.length; i < 4; i++) {
    result.push(`${letters[i]}. Phương án ${letters[i]}`);
  }
  return result;
}

/**
 * Parses a single True/False question (Phần II)
 */
function parseSingleTfQuestion(block: string, qIndex: number): TrueFalseQuestion | null {
  const cleanBlock = block.replace(/^(?:Câu|Bài)\s*\d+[\s.:]*/i, '').trim();

  // Find sub-items a), b), c), d)
  const aIdx = cleanBlock.search(/(?:^|\n)\s*a\s*[\s.:)]+/i);
  if (aIdx === -1) return null;

  const prompt = cleanBlock.slice(0, aIdx).trim();
  const subText = cleanBlock.slice(aIdx);

  const subRegex = /(?:^|\n)\s*([a-d])\s*[\s.:)]+([\s\S]*?)(?=(?:^|\n)\s*[a-d]\s*[\s.:)]+|$)/gi;
  const items: { key: string; statement: string; isCorrect: boolean }[] = [];
  let sMatch;

  while ((sMatch = subRegex.exec(subText)) !== null) {
    const key = sMatch[1].toLowerCase();
    let stmt = sMatch[2].trim();
    let isCorrect = true;

    if (/\b(?:Sai|Không\s*đúng|S)\b/i.test(stmt)) {
      isCorrect = false;
      stmt = stmt.replace(/\b(?:Sai|Không\s*đúng|S)\b/gi, '').trim();
    } else if (/\b(?:Đúng|Đ)\b/i.test(stmt)) {
      isCorrect = true;
      stmt = stmt.replace(/\b(?:Đúng|Đ)\b/gi, '').trim();
    }

    items.push({
      key,
      statement: stmt,
      isCorrect,
    });
  }

  if (items.length === 0) return null;

  return {
    id: `tf_${qIndex}`,
    prompt: prompt || `Khảo sát các mệnh đề sau:`,
    pointsPerSub: 0.25,
    items,
  };
}

/**
 * Parses a single Part III Question (Short Answer or Essay)
 */
function parseSingleEssayQuestion(block: string, qIndex: number): EssayQuestion | null {
  const cleanBlock = block.replace(/^(?:Câu|Bài)\s*\d+[\s.:]*/i, '').trim();

  let question = cleanBlock;
  let shortAnswerKey = '';
  let rubric: { step: string; description: string; points: number }[] = [];

  const keyMatch = cleanBlock.match(/(?:Đáp\s*số|Đáp\s*án|Kết\s*quả)[\s.:]+([^\n]+)/i);
  if (keyMatch) {
    shortAnswerKey = keyMatch[1].trim();
    question = cleanBlock.slice(0, keyMatch.index).trim();
  }

  // Look for step-by-step rubric if present
  const stepMatches = cleanBlock.match(/Bước\s*\d+[\s\S]*?(?=Bước\s*\d+|$)/gi);
  if (stepMatches && stepMatches.length > 0) {
    rubric = stepMatches.map((st, sIdx) => ({
      step: `Bước ${sIdx + 1}`,
      description: st.trim(),
      points: 0.5,
    }));
  }

  return {
    id: `essay_${qIndex}`,
    question: question.trim(),
    maxPoints: rubric.length > 0 ? rubric.reduce((a, b) => a + b.points, 0) : 0.5,
    shortAnswerKey: shortAnswerKey || undefined,
    rubric: rubric.length > 0 ? rubric : [],
  };
}
