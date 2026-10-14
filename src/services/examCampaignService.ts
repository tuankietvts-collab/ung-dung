import { Exam, StudentSubmission, MultipleChoiceQuestion, TrueFalseQuestion } from '../types/exam';
import { getDeletedExamIds } from './firebase';

export interface QuestionAnalysis {
  questionNumber: number;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  correctAnswerText: string;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  correctPercent: number;
  wrongPercent: number;
  optionCounts: Record<string, number>; // e.g. { A: 25, B: 5, C: 2, D: 8 }
  mostCommonWrongAnswer?: string;
  difficultyRating: 'Dễ' | 'Vừa sức' | 'Khó' | 'Phân hóa cao';
}

export interface ExamCampaignItem {
  id: string; // Campaign ID
  campaignKey: string;
  title: string; // Clean campaign title without variant code noise
  displayTitle: string; // Human-friendly title, e.g. "Kiểm Tra Thường Xuyên 1: Hàm Số Lượng Giác"
  grade: string;
  durationMinutes: number;
  totalPoints: number;
  variantCodes: string[]; // e.g. ["101", "102", "103", "104", ...]
  examIds: string[]; // All variant exam IDs belonging to this campaign
  primaryExam: Exam; // Master exam with full questions & answers
  subs: StudentSubmission[];
  submittedCount: number;
  avgScore: number | null;
  maxScore: number | null;
  minScore: number | null;
  passRate: number; // Percentage >= 5.0
  itemAnalysis: QuestionAnalysis[];
}

/**
 * Clean variant suffixes from exam title:
 * "ĐỀ KIỂM TRA TOÁN 11 – HÀM SỐ (Mã Đề: 123)" -> "ĐỀ KIỂM TRA TOÁN 11 – HÀM SỐ"
 */
export function normalizeExamCampaignTitle(rawTitle?: string): string {
  if (!rawTitle) return 'Bài Kiểm Tra Thường Xuyên';
  let clean = rawTitle
    .replace(/\s*[\(\[]\s*Mã\s*(?:Đề|đề)\s*:\s*[^)\]]+[\)\]]/gi, '')
    .replace(/\s*-\s*Mã\s*(?:Đề|đề)\s*:\s*[\w-]+/gi, '')
    .replace(/\s*[\(\[]\s*Đề\s*(?:số|Số)\s*:\s*[^)\]]+[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*Variant\s*:\s*[^)\]]+[\)\]]/gi, '')
    .trim();

  // Remove redundant punctuation at the end
  clean = clean.replace(/[-–—:]\s*$/, '').trim();
  return clean || rawTitle.trim();
}

/**
 * Generate a friendly display name (e.g. "Kiểm Tra Thường Xuyên 1", "Kiểm Tra Giữa Kỳ")
 */
export function getFriendlyCampaignName(title: string, index: number = 0): string {
  const lower = title.toLowerCase();
  if (lower.includes('thường xuyên lần 1') || lower.includes('thường xuyên 1') || lower.includes('tx1') || lower.includes('tx 1')) {
    return 'Bài Kiểm Tra Thường Xuyên 1';
  }
  if (lower.includes('thường xuyên lần 2') || lower.includes('thường xuyên 2') || lower.includes('tx2') || lower.includes('tx 2')) {
    return 'Bài Kiểm Tra Thường Xuyên 2';
  }
  if (lower.includes('thường xuyên lần 3') || lower.includes('thường xuyên 3') || lower.includes('tx3') || lower.includes('tx 3')) {
    return 'Bài Kiểm Tra Thường Xuyên 3';
  }
  if (lower.includes('giữa kỳ') || lower.includes('giữa kì') || lower.includes('gk')) {
    return 'Bài Kiểm Tra Giữa Kỳ';
  }
  if (lower.includes('cuối kỳ') || lower.includes('cuối kì') || lower.includes('ck')) {
    return 'Bài Kiểm Tra Cuối Kỳ';
  }
  if (lower.includes('tốt nghiệp') || lower.includes('thpt')) {
    return 'Đề Thi Thử Tốt Nghiệp THPT';
  }
  return `Bài Kiểm Tra Thường Xuyên ${index + 1}`;
}

/**
 * Normalizes class name for comparison: "Lớp 12A8" -> "12A8"
 */
export function normalizeClassName(className?: string): string {
  return (className || '').trim().toUpperCase().replace(/^LỚP\s+/i, '');
}

/**
 * Compute Question Item Analysis (Thống kê câu làm đúng / làm sai)
 */
export function computeItemAnalysis(primaryExam: Exam, submissions: StudentSubmission[]): QuestionAnalysis[] {
  if (!primaryExam || !primaryExam.multipleChoice || primaryExam.multipleChoice.length === 0) return [];

  const gradedSubs = submissions.filter((s) => !s.isPendingSubmission);
  const total = gradedSubs.length;

  const analysis: QuestionAnalysis[] = [];

  // 1. Phân tích Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn
  primaryExam.multipleChoice.forEach((mc, qIdx) => {
    let correctCount = 0;
    const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, 'Chưa làm': 0 };

    gradedSubs.forEach((sub) => {
      const subExam = sub.examSnapshot;
      let studentAns = '';
      let isCorrect = false;

      // Check with student's own variant exam if available
      if (subExam && subExam.multipleChoice && subExam.multipleChoice.length > 0) {
        const matchQ = subExam.multipleChoice.find(
          (q) => q.id === mc.id || q.question.trim() === mc.question.trim()
        ) || subExam.multipleChoice[qIdx];

        if (matchQ) {
          studentAns = sub.mcAnswers?.[matchQ.id] || '';
          if (studentAns) {
            isCorrect = studentAns.trim().toUpperCase() === matchQ.correctAnswer.trim().toUpperCase();
          }
        }
      }

      // Fallback direct check against primaryExam
      if (!studentAns) {
        studentAns =
          sub.mcAnswers?.[mc.id] ||
          sub.mcAnswers?.[`mc_${qIdx + 1}`] ||
          sub.mcAnswers?.[`Câu ${qIdx + 1}`] ||
          '';
        if (studentAns) {
          isCorrect = studentAns.trim().toUpperCase() === mc.correctAnswer.trim().toUpperCase();
        }
      }

      if (studentAns) {
        const letter = studentAns.trim().toUpperCase().charAt(0);
        if (['A', 'B', 'C', 'D'].includes(letter)) {
          optionCounts[letter] = (optionCounts[letter] || 0) + 1;
        } else {
          optionCounts[letter] = (optionCounts[letter] || 0) + 1;
        }
      } else {
        optionCounts['Chưa làm']++;
      }

      if (isCorrect) {
        correctCount++;
      }
    });

    const correctPercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const wrongPercent = 100 - correctPercent;

    // Find most picked wrong answer
    let maxWrongCount = 0;
    let mostCommonWrong = '';
    ['A', 'B', 'C', 'D'].forEach((letter) => {
      if (letter !== mc.correctAnswer.trim().toUpperCase() && (optionCounts[letter] || 0) > maxWrongCount) {
        maxWrongCount = optionCounts[letter] || 0;
        mostCommonWrong = letter;
      }
    });

    let difficulty: 'Dễ' | 'Vừa sức' | 'Khó' | 'Phân hóa cao' = 'Vừa sức';
    if (correctPercent >= 80) difficulty = 'Dễ';
    else if (correctPercent >= 55) difficulty = 'Vừa sức';
    else if (correctPercent >= 35) difficulty = 'Khó';
    else difficulty = 'Phân hóa cao';

    analysis.push({
      questionNumber: qIdx + 1,
      questionText: mc.question,
      questionType: 'multiple_choice',
      correctAnswerText: `Đáp án: ${mc.correctAnswer}`,
      totalAnswered: total,
      correctCount,
      wrongCount: total - correctCount,
      correctPercent,
      wrongPercent,
      optionCounts,
      mostCommonWrongAnswer: maxWrongCount > 0 ? `Phương án ${mostCommonWrong} (${maxWrongCount} em nhầm)` : undefined,
      difficultyRating: difficulty,
    });
  });

  return analysis;
}

/**
 * Main grouper: Groups exams and submissions into Exam Campaigns (Đợt Kiểm Tra)
 * Absolutely eliminates 20-30 duplicated variant cards on screen!
 */
export function groupSubmissionsAndExamsIntoCampaigns(
  allExams: Exam[],
  allSubmissions: StudentSubmission[],
  targetClassName?: string
): ExamCampaignItem[] {
  const deletedExamIds = getDeletedExamIds();
  const normTargetClass = targetClassName ? normalizeClassName(targetClassName) : null;

  // Filter submissions by target class if provided
  const relevantSubs = normTargetClass
    ? allSubmissions.filter((s) => normalizeClassName(s.studentClass) === normTargetClass)
    : allSubmissions;

  // Map of campaignKey -> ExamCampaignItem
  const campaignMap = new Map<
    string,
    {
      id: string;
      campaignKey: string;
      rawTitle: string;
      grade: string;
      durationMinutes: number;
      totalPoints: number;
      variantCodes: Set<string>;
      examIds: Set<string>;
      primaryExam?: Exam;
      candidateExams: Exam[];
      subs: StudentSubmission[];
    }
  >();

  // Helper to compute a clean unique campaign key
  const computeKey = (title?: string, masterCode?: string, grade?: string): string => {
    if (masterCode && masterCode.trim().length > 0) {
      return `mc_${masterCode.trim().toUpperCase()}`;
    }
    const cleanTitle = normalizeExamCampaignTitle(title).toLowerCase();
    const g = grade || '12';
    return `title_${cleanTitle}_k${g}`;
  };

  // 1. Process submissions first (captures exams students actually took)
  relevantSubs.forEach((sub) => {
    const subExam = sub.examSnapshot;
    const subCode = sub.examCode || subExam?.examCode || 'TOAN12';
    const subId = sub.examId || subExam?.id || subCode;

    if (deletedExamIds.has(subId) || deletedExamIds.has(subCode)) {
      return;
    }

    const title = subExam?.title || `Bài kiểm tra ${subCode}`;
    const masterCode = subExam?.masterExamCode;
    const grade = subExam?.grade || '12';

    const cKey = computeKey(title, masterCode, grade);

    if (!campaignMap.has(cKey)) {
      campaignMap.set(cKey, {
        id: subExam?.id || subId,
        campaignKey: cKey,
        rawTitle: title,
        grade,
        durationMinutes: subExam?.durationMinutes || 45,
        totalPoints: subExam?.totalPoints || 10,
        variantCodes: new Set<string>(),
        examIds: new Set<string>(),
        primaryExam: subExam,
        candidateExams: subExam ? [subExam] : [],
        subs: [],
      });
    }

    const camp = campaignMap.get(cKey)!;
    if (subCode) camp.variantCodes.add(subCode);
    if (subId) camp.examIds.add(subId);
    camp.subs.push(sub);
    if (!camp.primaryExam && subExam) {
      camp.primaryExam = subExam;
    }
  });

  // 2. Process allExams (adds saved exams even if no one submitted yet)
  allExams.forEach((ex) => {
    if (deletedExamIds.has(ex.id) || deletedExamIds.has(ex.examCode)) {
      return;
    }

    const title = ex.title || `Bài kiểm tra ${ex.examCode}`;
    const masterCode = ex.masterExamCode;
    const grade = ex.grade || '12';

    const cKey = computeKey(title, masterCode, grade);

    if (!campaignMap.has(cKey)) {
      campaignMap.set(cKey, {
        id: ex.id,
        campaignKey: cKey,
        rawTitle: title,
        grade,
        durationMinutes: ex.durationMinutes || 45,
        totalPoints: ex.totalPoints || 10,
        variantCodes: new Set<string>(),
        examIds: new Set<string>(),
        primaryExam: ex,
        candidateExams: [ex],
        subs: [],
      });
    }

    const camp = campaignMap.get(cKey)!;
    if (ex.examCode) camp.variantCodes.add(ex.examCode);
    if (ex.id) camp.examIds.add(ex.id);
    camp.candidateExams.push(ex);

    // Prefer exams with actual questions for primaryExam
    if (!camp.primaryExam || (camp.primaryExam.multipleChoice?.length === 0 && ex.multipleChoice?.length > 0)) {
      camp.primaryExam = ex;
    }
  });

  // 3. Assemble final campaign list
  const campaigns: ExamCampaignItem[] = [];
  let index = 0;

  campaignMap.forEach((camp) => {
    const cleanTitle = normalizeExamCampaignTitle(camp.rawTitle);
    const friendlyName = getFriendlyCampaignName(cleanTitle, index);

    // Calculate statistics
    const gradedSubs = camp.subs.filter((s) => !s.isPendingSubmission);
    const scores = gradedSubs.map((s) => s.totalScore);
    const avgScore = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;
    const maxScore = scores.length > 0 ? Math.max(...scores) : null;
    const minScore = scores.length > 0 ? Math.min(...scores) : null;
    const passRate =
      scores.length > 0
        ? Math.round((scores.filter((sc) => sc >= 5.0).length / scores.length) * 100)
        : 0;

    // Build synthesized primary exam if none had questions
    const finalPrimaryExam: Exam = camp.primaryExam || {
      id: camp.id,
      examCode: Array.from(camp.variantCodes)[0] || 'TOAN-TX',
      title: cleanTitle,
      grade: camp.grade,
      durationMinutes: camp.durationMinutes,
      totalPoints: camp.totalPoints,
      multipleChoice: [],
      trueFalseQuestions: [],
      essays: [],
      createdAt: new Date().toISOString(),
    };

    const itemAnalysis = computeItemAnalysis(finalPrimaryExam, camp.subs);

    campaigns.push({
      id: camp.id,
      campaignKey: camp.campaignKey,
      title: cleanTitle,
      displayTitle: friendlyName,
      grade: camp.grade,
      durationMinutes: camp.durationMinutes,
      totalPoints: camp.totalPoints,
      variantCodes: Array.from(camp.variantCodes).sort(),
      examIds: Array.from(camp.examIds),
      primaryExam: finalPrimaryExam,
      subs: camp.subs,
      submittedCount: gradedSubs.length,
      avgScore,
      maxScore,
      minScore,
      passRate,
      itemAnalysis,
    });

    index++;
  });

  // Sort campaigns: most active / recent first
  campaigns.sort((a, b) => b.submittedCount - a.submittedCount);

  return campaigns;
}
