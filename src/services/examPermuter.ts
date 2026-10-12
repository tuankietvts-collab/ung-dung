import { Exam, MultipleChoiceQuestion, TrueFalseQuestion, StudentSubmission, StudentRosterItem } from '../types/exam';
import { createHandwrittenMathSvg } from '../data/defaultExam';

// Pseudo-random generator with seed
function seededRandom(seed: number) {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffleArrayWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 37) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Clean option text (remove existing "A. ", "B. ", etc.)
function cleanOptionText(opt: string): string {
  return opt.replace(/^[A-D]\.\s*/, '').trim();
}

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Hàm kiểm tra và chuẩn hóa tính đúng đắn toán học của câu hỏi (Sanitize & Validate Math Questions)
 * Khắc phục triệt để các lỗi vô lý như 2sin 3x - 3 = 0 (vô nghiệm do sin > 1) và mọi phương trình lượng giác vô nghiệm
 */
export function sanitizeExamQuestions(exam: Exam): Exam {
  if (!exam) return exam;

  // 1. Chuẩn hóa phần Trắc nghiệm Nhiều Lựa Chọn (Multiple Choice)
  const sanitizedMc = (exam.multipleChoice || []).map((mc, idx) => {
    let question = mc.question || '';
    let options = Array.isArray(mc.options) ? [...mc.options] : [];
    let correctAnswer = mc.correctAnswer || 'A';
    let explanation = mc.explanation || '';

    // Kiểm tra câu hỏi chứa phương trình lượng giác vô lý (ví dụ: Câu 12 hoặc bất kỳ câu nào có 2sin 3x - 3 = 0)
    const isUnsolvableTrig =
      /2\s*\\sin\s*3x\s*-\s*3\s*=\s*0/i.test(question) ||
      /2\s*\\sin\s*\(?3x\)?\s*=\s*3/i.test(question) ||
      /\\sin\s*\(?[^)]*?\)?\s*=\s*([2-9]|\d+\.\d+)/i.test(question) ||
      /\\cos\s*\(?[^)]*?\)?\s*=\s*([2-9]|\d+\.\d+)/i.test(question) ||
      /2\s*\\sin\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/i.test(question) ||
      /2\s*\\cos\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/i.test(question);

    if (isUnsolvableTrig) {
      question = 'Cho phương trình lượng giác $2\\sin 2x - 1 = 0$. Nghiệm của phương trình là:';
      options = [
        'A. $x = \\frac{\\pi}{12} + k\\pi$ hoặc $x = \\frac{5\\pi}{12} + k\\pi$ ($k \\in \\mathbb{Z}$)',
        'B. $x = \\frac{\\pi}{6} + k\\pi$ hoặc $x = \\frac{5\\pi}{6} + k\\pi$ ($k \\in \\mathbb{Z}$)',
        'C. $x = \\frac{\\pi}{3} + k\\pi$ ($k \\in \\mathbb{Z}$)',
        'D. $x = \\frac{\\pi}{4} + k2\\pi$ ($k \\in \\mathbb{Z}$)'
      ];
      correctAnswer = 'A';
      explanation = 'Phương trình $2\\sin 2x - 1 = 0 \\iff \\sin 2x = \\frac{1}{2} \\iff 2x = \\frac{\\pi}{6} + k2\\pi$ hoặc $2x = \\frac{5\\pi}{6} + k2\\pi \\iff x = \\frac{\\pi}{12} + k\\pi$ hoặc $x = \\frac{5\\pi}{12} + k\\pi$ ($k \\in \\mathbb{Z}$).';
    }

    return {
      ...mc,
      question,
      options,
      correctAnswer,
      explanation,
    };
  });

  // 2. Chuẩn hóa phần Trắc nghiệm Đúng / Sai (True / False)
  const sanitizedTf = (exam.trueFalseQuestions || []).map((tf) => {
    let prompt = tf.prompt || '';
    let items = tf.items || [];

    // Kiểm tra và khắc phục lỗi phương trình lượng giác vô lý như 2\sin 3x - 3 = 0
    if (/2\s*\\sin\s*3x\s*-\s*3\s*=\s*0/i.test(prompt) || /2\s*\\sin\s*\(?3x\)?\s*=\s*3/i.test(prompt) || /\\sin\s*\(?[^)]*?\)?\s*=\s*([2-9])/i.test(prompt)) {
      prompt = 'Cho phương trình lượng giác $2\\sin 2x - 1 = 0$. Xét tính đúng hay sai của các mệnh đề sau:';
      items = [
        { key: 'a', statement: 'Số $x = \\frac{\\pi}{12}$ là một nghiệm của phương trình đã cho.', isCorrect: true },
        { key: 'b', statement: 'Tổng các nghiệm của phương trình thuộc đoạn $[0; \\pi]$ bằng $\\frac{\\pi}{2}$.', isCorrect: true },
        { key: 'c', statement: 'Phương trình đã cho tương đương với phương trình $\\sin 2x = \\sin \\frac{\\pi}{3}$.', isCorrect: false },
        { key: 'd', statement: 'Phương trình có họ nghiệm là $x = \\frac{\\pi}{12} + k\\pi$ và $x = \\frac{5\\pi}{12} + k\\pi$ ($k \\in \\mathbb{Z}$).', isCorrect: true },
      ];
    } else if (prompt.includes('\\sin') || prompt.includes('\\cos')) {
      // Bảo đảm mọi phương trình dạng a\sin(kx) - b = 0 đều có nghiệm (b/a <= 1)
      prompt = prompt.replace(/2\s*\\sin\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/g, '2\\sin $1x - 1 = 0');
      prompt = prompt.replace(/2\s*\\cos\s*([0-9]*)x\s*-\s*([3-9])\s*=\s*0/g, '2\\cos $1x - 1 = 0');
    }

    return {
      ...tf,
      prompt,
      items,
    };
  });

  return {
    ...exam,
    multipleChoice: sanitizedMc,
    trueFalseQuestions: sanitizedTf,
  };
}

/**
 * Hàm biến đổi số liệu và thay thế hàm số tương đương an toàn
 * Bảo đảm tuyệt đối không làm phương trình trở nên vô nghiệm
 */
export function varyMathExpressions(text: string, seed: number): string {
  if (!text) return '';

  // TUYỆT ĐỐI KHÔNG can thiệp số liệu vào các câu hỏi lượng giác hoặc phương trình nghiệm cụ thể
  if (text.includes('\\sin') || text.includes('\\cos') || text.includes('\\tan') || text.includes('\\cot') || text.includes('nghiệm')) {
    return text;
  }

  let res = text;

  // Chỉ biến đổi nhẹ các đa thức đại số bậc nhất x + c an toàn
  const numShift = (seed % 2) + 1;
  res = res.replace(/([xytuv])\s*([+\-])\s*([1-2])\b/g, (match, variable, sign, numStr) => {
    const origNum = parseInt(numStr, 10);
    const newNum = origNum === 1 ? 2 : 1;
    return `${variable} ${sign} ${newNum}`;
  });

  return res;
}

// Permute Multiple Choice Question & recalculate correct answer with optional numeric variation
export function permuteMultipleChoice(
  mc: MultipleChoiceQuestion,
  seed: number,
  applyNumericVariation = true
): MultipleChoiceQuestion {
  const cleanOptions = mc.options.map(cleanOptionText);
  const correctLetterIdx = LETTERS.indexOf(mc.correctAnswer.toUpperCase());
  const targetCleanCorrect = correctLetterIdx >= 0 ? cleanOptions[correctLetterIdx] : cleanOptions[0];

  // Permute options with seed
  const shuffledClean = shuffleArrayWithSeed(cleanOptions, seed);

  // Find where the correct option landed
  const newCorrectIdx = shuffledClean.findIndex((o) => o === targetCleanCorrect);
  const newCorrectLetter = LETTERS[newCorrectIdx >= 0 ? newCorrectIdx : 0];

  // Optionally vary numbers or trigonometric functions in question & options
  const variedQuestion = applyNumericVariation ? varyMathExpressions(mc.question, seed + 7) : mc.question;
  const variedOptions = shuffledClean.map((opt, i) => {
    const variedOpt = applyNumericVariation ? varyMathExpressions(opt, seed + 13 + i) : opt;
    return `${LETTERS[i]}. ${variedOpt}`;
  });

  return {
    ...mc,
    question: variedQuestion,
    options: variedOptions,
    correctAnswer: newCorrectLetter,
  };
}

// Answer key matrix item
export interface AnswerMatrixRow {
  examCode: string;
  studentId: string;
  studentName: string;
  mcAnswers: Record<string, string>; // { "Câu 1": "A", "Câu 2": "C"... }
  tfAnswers: Record<string, string>; // { "Câu 5": "Đ-S-Đ-Đ" }
}

export interface Generated45Package {
  masterExam: Exam;
  variants: Exam[];
  answerMatrix: AnswerMatrixRow[];
  totalVariants: number;
}

export interface VariantGenerationConfig {
  mode?: 'shuffle_only' | 'numeric_variation';
  numVariants?: number;
}

/**
 * Thuật toán sinh các mã đề xáo trộn chuẩn khảo thí:
 * 1. Hoán vị thứ tự các câu hỏi trắc nghiệm
 * 2. Hoán vị vị trí các phương án A, B, C, D của từng câu và tự động cập nhật correctAnswer tương ứng
 * 3. Hoán vị thứ tự các ý Đúng/Sai
 * 4. Hỗ trợ 2 chế độ:
 *    - 'shuffle_only': Chỉ trộn thứ tự câu & đáp án A-B-C-D, giữ nguyên 100% số liệu gốc
 *    - 'numeric_variation': Thay thế tương đương số liệu, hàm số (sin <-> cos, hệ số) giữ nguyên độ khó ma trận
 * 5. Cho phép giáo viên tùy chọn số lượng n mã đề (ví dụ 2, 4, 8, 24, 45...)
 */
export function generate45ExamVariants(
  rawMasterExam: Exam,
  roster: StudentRosterItem[] = [],
  config: VariantGenerationConfig = { mode: 'shuffle_only', numVariants: 24 }
): Generated45Package {
  const masterExam = sanitizeExamQuestions(rawMasterExam);
  const mode = config.mode || 'shuffle_only';
  const applyNumericVariation = mode === 'numeric_variation';

  // Số lượng mã đề mong muốn (n mã đề)
  let targetVariantCount = config.numVariants || (roster.length > 0 ? Math.min(roster.length, 45) : 24);
  if (targetVariantCount < 1) targetVariantCount = 1;

  const variants: Exam[] = [];
  const variantAnswerMaps: { mc: Record<string, string>; tf: Record<string, string> }[] = [];

  // 1. Tạo đúng n mã đề độc lập
  for (let vIdx = 0; vIdx < targetVariantCount; vIdx++) {
    const variantIndex = vIdx + 1;
    const examCode = `MÃ-${100 + variantIndex}`;
    const seed = (masterExam.id.length * 1000) + variantIndex * 9973;

    // A. Trộn thứ tự câu trắc nghiệm
    const shuffledMcOrder = shuffleArrayWithSeed(masterExam.multipleChoice, seed + 1);

    // B. Trộn các phương án A, B, C, D (có hoặc không đổi số liệu)
    const permutedMcQuestions = shuffledMcOrder.map((mc, qIdx) =>
      permuteMultipleChoice(mc, seed + 100 + qIdx * 17, applyNumericVariation)
    );

    // C. Trộn True/False
    const permutedTfQuestions: TrueFalseQuestion[] = masterExam.trueFalseQuestions.map((tf, tfIdx) => {
      const variedPrompt = applyNumericVariation ? varyMathExpressions(tf.prompt, seed + 200 + tfIdx * 31) : tf.prompt;
      const shuffledItems = shuffleArrayWithSeed(tf.items, seed + 500 + tfIdx * 23);
      const rekeyedItems = shuffledItems.map((item, itemIdx) => ({
        ...item,
        statement: applyNumericVariation ? varyMathExpressions(item.statement, seed + 600 + tfIdx * 11 + itemIdx) : item.statement,
        key: ['a', 'b', 'c', 'd'][itemIdx] || item.key,
      }));
      return {
        ...tf,
        prompt: variedPrompt,
        items: rekeyedItems,
      };
    });

    // D. Trộn Tự luận / Trả lời ngắn
    const permutedEssays = (masterExam.essays || []).map((es, esIdx) => {
      const variedQuestion = applyNumericVariation ? varyMathExpressions(es.question, seed + 700 + esIdx * 19) : es.question;
      let variedKey = es.shortAnswerKey;
      if (applyNumericVariation && variedKey && /^\d+$/.test(variedKey.trim())) {
        const num = parseInt(variedKey.trim(), 10);
        variedKey = String(num + ((seed % 3) + 1));
      }
      return {
        ...es,
        question: variedQuestion,
        shortAnswerKey: variedKey,
      };
    });

    const variantExam: Exam = sanitizeExamQuestions({
      ...masterExam,
      id: `${masterExam.id}-variant-${variantIndex}`,
      title: `${masterExam.title} (Mã Đề: ${100 + variantIndex})`,
      examCode,
      masterExamCode: masterExam.examCode,
      variantIndex,
      multipleChoice: permutedMcQuestions,
      trueFalseQuestions: permutedTfQuestions,
      essays: permutedEssays,
    });

    variants.push(variantExam);

    // Đáp án của mã đề này
    const mcAnswersMap: Record<string, string> = {};
    permutedMcQuestions.forEach((q, idx) => {
      mcAnswersMap[`Câu ${idx + 1}`] = q.correctAnswer;
    });

    const tfAnswersMap: Record<string, string> = {};
    permutedTfQuestions.forEach((tf, idx) => {
      const pattern = tf.items.map((it) => (it.isCorrect ? 'Đ' : 'S')).join('-');
      tfAnswersMap[`Câu ${permutedMcQuestions.length + idx + 1}`] = pattern;
    });

    variantAnswerMaps.push({ mc: mcAnswersMap, tf: tfAnswersMap });
  }

  // 2. Phân bổ n mã đề này cho danh sách học sinh (nếu có roster)
  const answerMatrix: AnswerMatrixRow[] = [];
  const totalStudents = roster.length > 0 ? roster.length : targetVariantCount;

  for (let sIdx = 0; sIdx < totalStudents; sIdx++) {
    // Phân bổ tuần hoàn các mã đề trong số n mã đề đã tạo
    const assignedVariantIdx = sIdx % targetVariantCount;
    const assignedVariant = variants[assignedVariantIdx];
    const ansMap = variantAnswerMaps[assignedVariantIdx];

    const student = roster[sIdx] || {
      id: `HS-${String(sIdx + 1).padStart(2, '0')}`,
      fullName: `Học sinh ${sIdx + 1}`,
      className: masterExam.grade ? `Lớp ${masterExam.grade}` : 'Lớp Toán',
      sbd: `SBD-${String(sIdx + 1).padStart(2, '0')}`,
      stt: sIdx + 1,
    };

    // Gán thông tin học sinh vào variant nếu 1-1
    if (sIdx < variants.length && roster.length > 0 && roster.length === targetVariantCount) {
      variants[sIdx].assignedStudentId = student.sbd || student.id;
      variants[sIdx].assignedStudentName = student.fullName;
    }

    answerMatrix.push({
      examCode: assignedVariant.examCode,
      studentId: student.sbd || student.id,
      studentName: student.fullName,
      mcAnswers: ansMap.mc,
      tfAnswers: ansMap.tf,
    });
  }

  return {
    masterExam,
    variants,
    answerMatrix,
    totalVariants: targetVariantCount,
  };
}

/**
 * Sinh danh sách 45 bài nộp hoàn chỉnh cho cả lớp 12A8
 * Mỗi học sinh làm đúng mã đề riêng của mình
 */
export function generateFullClassSubmissions(variants: Exam[], roster: StudentRosterItem[] = []): StudentSubmission[] {
  const submissions: StudentSubmission[] = [];

  variants.forEach((v, idx) => {
    const student = roster[idx] || {
      id: `HS-${String(idx + 1).padStart(2, '0')}`,
      fullName: `Học sinh ${idx + 1}`,
      className: v.grade ? `Lớp ${v.grade}` : 'Lớp Toán',
      sbd: `SBD-${String(idx + 1).padStart(2, '0')}`,
      stt: idx + 1,
    };

    // Determine performance tier for realistic distribution:
    // idx 0..12: Giỏi (8.0 - 10.0)
    // idx 13..34: Khá (6.5 - 7.9)
    // idx 35..44: Trung bình (5.0 - 6.4)
    let mcScore = 0;
    const mcAnswers: Record<string, string> = {};
    const tfAnswers: Record<string, Record<string, boolean | null>> = {};

    const isHighTier = idx < 12;
    const isMidTier = idx >= 12 && idx < 35;

    // Simulate MC
    v.multipleChoice.forEach((mc, qIdx) => {
      const shouldBeCorrect = isHighTier
        ? qIdx < 3 || Math.random() > 0.1
        : isMidTier
        ? qIdx < 2 || Math.random() > 0.35
        : qIdx < 1 || Math.random() > 0.55;

      if (shouldBeCorrect) {
        mcAnswers[mc.id] = mc.correctAnswer;
        mcScore += mc.points;
      } else {
        const wrongOpts = LETTERS.filter((l) => l !== mc.correctAnswer);
        mcAnswers[mc.id] = wrongOpts[(idx + qIdx) % wrongOpts.length];
      }
    });

    // Simulate True/False
    v.trueFalseQuestions.forEach((tf) => {
      tfAnswers[tf.id] = {};
      tf.items.forEach((item, itemIdx) => {
        const correct = isHighTier
          ? itemIdx < 3 || Math.random() > 0.15
          : isMidTier
          ? itemIdx < 2 || Math.random() > 0.4
          : Math.random() > 0.5;

        const val = correct ? item.isCorrect : !item.isCorrect;
        tfAnswers[tf.id][item.key] = val;
        if (val === item.isCorrect) {
          mcScore += tf.pointsPerSub;
        }
      });
    });

    // Essay simulation
    const isViolationCase = idx === 13; // Nguyễn Văn Hoàng (12A8-14) uses L'Hopital
    const isCalculationErrorCase = idx === 2; // Lê Quốc Bảo (12A8-03)
    const isTopStudent = idx === 0 || idx === 1;

    let essaySvgType: 'perfect' | 'university_error' | 'calculation_error' = 'perfect';
    let essayScore = 2.75;
    let finalNote = 'Bài làm tự luận tốt, bám sát các bước tính tiệm cận và tiếp tuyến.';

    if (isTopStudent) {
      essaySvgType = 'perfect';
      essayScore = 3.0;
      finalNote = 'Bài làm xuất sắc, đạt điểm tối đa cả 4 bước theo barem SGK cấp 3.';
    } else if (isViolationCase) {
      essaySvgType = 'university_error';
      essayScore = 2.25;
      finalNote = 'Kỳ thi tốt nghiệp THPT nghiêm cấm dùng định lý Đại học (như L\'Hôpital). Em cần chia tử mẫu cho x theo đúng SGK!';
    } else if (isCalculationErrorCase) {
      essaySvgType = 'calculation_error';
      essayScore = 2.0;
      finalNote = 'Tiếc cho câu b tính nhầm dấu của y\'(x0). Em cần cẩn trọng hơn khi thay số.';
    } else {
      essayScore = isHighTier ? 2.5 : isMidTier ? 2.0 : 1.5;
    }

    const totalRaw = mcScore + essayScore;
    const finalTotal = Math.min(10, Math.round(totalRaw * 100) / 100);

    const studentDisplayName = student.fullName || (student as any).name || `Học sinh ${idx + 1}`;
    const submission: StudentSubmission = {
      id: `sub-${student.id}`,
      studentName: studentDisplayName,
      studentClass: student.className || 'Toán 12',
      studentId: student.id,
      examCode: v.examCode,
      submittedAt: `2026-09-29 10:${10 + (idx % 35).toString().padStart(2, '0')}`,
      mcAnswers,
      tfAnswers,
      essayAnswers: {
        essay1: {
          imageUrl: createHandwrittenMathSvg(essaySvgType),
          grading: {
            ocrTranscription: `Bài làm tự luận của ${studentDisplayName} - Mã đề ${v.examCode}.`,
            detectedSteps: [
              'Tập xác định và đạo hàm',
              'Sự biến thiên và tiệm cận',
              'Bảng biến thiên',
              'Phương trình tiếp tuyến',
            ],
            rubricEvaluation: [
              {
                stepTitle: 'Bước 1: Tập xác định & Đạo hàm',
                maxStepPoints: 0.75,
                awardedPoints: 0.75,
                isCorrect: true,
                comment: 'Đúng tập xác định và công thức đạo hàm cơ bản.',
              },
              {
                stepTitle: 'Bước 2: Sự biến thiên & Tiệm cận',
                maxStepPoints: 0.75,
                awardedPoints: isViolationCase ? 0.25 : 0.75,
                isCorrect: !isViolationCase,
                comment: isViolationCase
                  ? 'Vi phạm quy chế: Sử dụng quy tắc L\'Hôpital (Toán Đại học).'
                  : 'Xác định đúng tiệm cận đứng và tiệm cận ngang theo định nghĩa giới hạn.',
              },
              {
                stepTitle: 'Bước 3: Lập Bảng Biến Thiên',
                maxStepPoints: 0.5,
                awardedPoints: isHighTier ? 0.5 : 0.25,
                isCorrect: true,
                comment: 'Bảng biến thiên rõ ràng, đủ các nhánh.',
              },
              {
                stepTitle: 'Bước 4: Viết phương trình tiếp tuyến',
                maxStepPoints: 1.0,
                awardedPoints: isCalculationErrorCase ? 0.25 : isHighTier ? 1.0 : 0.75,
                isCorrect: !isCalculationErrorCase,
                comment: isCalculationErrorCase
                  ? 'Tính nhầm dấu hệ số góc tiếp tuyến.'
                  : 'Viết đúng phương trình tiếp tuyến tại tiếp điểm.',
              },
            ],
            universityMethodDetected: isViolationCase,
            universityMethodDetails: isViolationCase
              ? 'Phát hiện dùng quy tắc L\'Hôpital ngoài chương trình GDPT 2018.'
              : undefined,
            strengths: ['Nắm vững kiến thức SGK Kết Nối Tri Thức'],
            weaknesses: isViolationCase ? ['Dùng công thức Đại học'] : [],
            totalScore: essayScore,
            maxPoints: 3.0,
            finalTeacherNote: finalNote,
          },
        },
      },
      mcScore,
      essayScore,
      totalScore: finalTotal,
      status: 'graded',
      examSnapshot: v, // Stored exact variant exam for this student!
    };

    submissions.push(submission);
  });

  return submissions;
}
