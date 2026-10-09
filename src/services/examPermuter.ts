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
 * Hàm biến đổi số liệu và thay thế hàm số tương đương (Equivalence numerical permutation)
 * Ví dụ: sin(x) -> cos(x), số 1 -> 2, hệ số a, b, c biến đổi giữ nguyên độ khó và cấu trúc
 */
export function varyMathExpressions(text: string, seed: number): string {
  if (!text) return '';
  const r = seededRandom(seed);
  let res = text;

  // 1. Thay thế tương đương các hàm lượng giác / hàm số đối xứng khi có seed lẻ vs chẵn
  if (seed % 2 === 1) {
    if (res.includes('\\sin') && !res.includes('\\cos')) {
      res = res.replace(/\\sin/g, '\\cos');
    } else if (res.includes('\\cos') && !res.includes('\\sin')) {
      res = res.replace(/\\cos/g, '\\sin');
    } else if (res.includes('sin(') && !res.includes('cos(')) {
      res = res.replace(/sin\(/g, 'cos(');
    }
  }

  // 2. Hoán đổi các biến và hệ số số học nhỏ (1 <-> 2, 2 <-> 3, 3 <-> 4) một cách an toàn
  // Chỉ thay thế số trong các công thức toán học hoặc biểu thức đơn giản
  const numShift = (seed % 3) + 1; // 1, 2 hoặc 3
  
  // Biến đổi các số nguyên nhỏ trong biểu thức cộng trừ (ví dụ x + 1 -> x + 2, x - 2 -> x - 3)
  res = res.replace(/([xytuv])\s*([+\-])\s*([1-9])\b/g, (match, variable, sign, numStr) => {
    const origNum = parseInt(numStr, 10);
    const newNum = ((origNum - 1 + numShift) % 5) + 1;
    return `${variable} ${sign} ${newNum}`;
  });

  // Biến đổi hệ số trước x (ví dụ: 2x -> 3x hoặc 3x -> 4x nếu là số nhỏ)
  if (seed % 4 === 2) {
    res = res.replace(/\b([2-5])([xytuv])\b/g, (match, coeffStr, variable) => {
      const orig = parseInt(coeffStr, 10);
      const nextCoeff = orig === 5 ? 2 : orig + 1;
      return `${nextCoeff}${variable}`;
    });
  }

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

/**
 * Thuật toán sinh các mã đề xáo trộn chuẩn khảo thí:
 * 1. Hoán vị thứ tự các câu hỏi trắc nghiệm
 * 2. Hoán vị vị trí các phương án A, B, C, D của từng câu và tự động cập nhật correctAnswer tương ứng
 * 3. Hoán vị thứ tự các ý Đúng/Sai
 * 4. Tự động liên kết từng mã đề tương ứng với danh sách học sinh thực tế của giáo viên
 */
export function generate45ExamVariants(masterExam: Exam, roster: StudentRosterItem[] = []): Generated45Package {
  const variants: Exam[] = [];
  const answerMatrix: AnswerMatrixRow[] = [];
  const totalVariants = roster.length > 0 ? roster.length : 24;

  for (let i = 0; i < totalVariants; i++) {
    const variantIndex = i + 1;
    const examCode = `MÃ-${100 + variantIndex}`;
    const student = roster[i] || {
      id: `HS-${String(variantIndex).padStart(2, '0')}`,
      fullName: `Học sinh ${variantIndex}`,
      className: masterExam.grade ? `Lớp ${masterExam.grade}` : 'Lớp Toán',
      sbd: `SBD-${String(variantIndex).padStart(2, '0')}`,
      stt: variantIndex,
    };
    const seed = (masterExam.id.length * 1000) + variantIndex * 9973;

    // 1. Permute Multiple Choice questions order
    const shuffledMcOrder = shuffleArrayWithSeed(masterExam.multipleChoice, seed + 1);

    // 2. Permute each MC's options
    const permutedMcQuestions = shuffledMcOrder.map((mc, qIdx) =>
      permuteMultipleChoice(mc, seed + 100 + qIdx * 17)
    );

    // 3. Permute True/False items with question variation
    const permutedTfQuestions: TrueFalseQuestion[] = masterExam.trueFalseQuestions.map((tf, tfIdx) => {
      const variedPrompt = varyMathExpressions(tf.prompt, seed + 200 + tfIdx * 31);
      const shuffledItems = shuffleArrayWithSeed(tf.items, seed + 500 + tfIdx * 23);
      const rekeyedItems = shuffledItems.map((item, itemIdx) => ({
        ...item,
        statement: varyMathExpressions(item.statement, seed + 600 + tfIdx * 11 + itemIdx),
        key: ['a', 'b', 'c', 'd'][itemIdx] || item.key,
      }));
      return {
        ...tf,
        prompt: variedPrompt,
        items: rekeyedItems,
      };
    });

    // 4. Permute Essays / Short-Answers with equivalent numerical substitution
    const permutedEssays = (masterExam.essays || []).map((es, esIdx) => {
      const variedQuestion = varyMathExpressions(es.question, seed + 700 + esIdx * 19);
      let variedKey = es.shortAnswerKey;
      if (variedKey && /^\d+$/.test(variedKey.trim())) {
        const num = parseInt(variedKey.trim(), 10);
        variedKey = String(num + ((seed % 3) + 1));
      }
      return {
        ...es,
        question: variedQuestion,
        shortAnswerKey: variedKey,
      };
    });

    // 5. Create variant exam object
    const variantExam: Exam = {
      ...masterExam,
      id: `${masterExam.id}-variant-${variantIndex}`,
      title: `${masterExam.title} (Mã Đề: ${100 + variantIndex})`,
      examCode,
      masterExamCode: masterExam.examCode,
      variantIndex,
      assignedStudentId: student.sbd || student.id,
      assignedStudentName: student.fullName,
      multipleChoice: permutedMcQuestions,
      trueFalseQuestions: permutedTfQuestions,
      essays: permutedEssays,
    };

    variants.push(variantExam);

    // 5. Build Answer Matrix Row
    const mcAnswersMap: Record<string, string> = {};
    permutedMcQuestions.forEach((q, idx) => {
      mcAnswersMap[`Câu ${idx + 1}`] = q.correctAnswer;
    });

    const tfAnswersMap: Record<string, string> = {};
    permutedTfQuestions.forEach((tf, idx) => {
      const pattern = tf.items.map((it) => (it.isCorrect ? 'Đ' : 'S')).join('-');
      tfAnswersMap[`Câu ${permutedMcQuestions.length + idx + 1}`] = pattern;
    });

    answerMatrix.push({
      examCode,
      studentId: student.sbd || student.id,
      studentName: student.fullName,
      mcAnswers: mcAnswersMap,
      tfAnswers: tfAnswersMap,
    });
  }

  return {
    masterExam,
    variants,
    answerMatrix,
    totalVariants,
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
