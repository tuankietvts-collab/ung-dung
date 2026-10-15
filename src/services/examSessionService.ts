import { Exam, StudentSubmission, StudentRosterItem } from '../types/exam';
import { getDeletedExamIds } from './firebase';

export interface QuestionAnalysis {
  questionIndex: number;
  questionId: string;
  type: 'mc' | 'tf' | 'short' | 'essay';
  part: 'I' | 'II' | 'III';
  partLabel: string;
  questionText: string;
  correctAnswerText: string;
  options?: string[];
  explanation?: string;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  correctRate: number; // 0 - 100%
  difficultyLabel: 'Dễ' | 'Trung bình' | 'Phân hóa' | 'Khó / Sai nhiều';
  difficultyBadgeColor: string;
  choiceDistribution?: Record<string, { count: number; percent: number }>; // For MC (A, B, C, D)
  subItems?: {
    key: string;
    statement: string;
    isCorrect: boolean;
    correctCount: number;
    correctRate: number;
  }[];
}

export interface ExamSession {
  id: string; // Base / Session ID
  sessionKey: string;
  sessionNumber: number; // 1, 2, 3...
  sessionLabel: string; // "Bài Kiểm Tra Thường Xuyên 1", "Bài Kiểm Tra Thường Xuyên 2", "Bài Kiểm Tra Định Kỳ 1"...
  title: string; // Tên hiển thị đầy đủ
  baseTitle: string; // Tên gốc của đợt thi (bỏ hậu tố mã đề)
  topic?: string;
  grade: string;
  durationMinutes: number;
  totalPoints: number;
  createdAt: string;
  variantCodes: string[]; // Danh sách các mã đề thuộc đợt này, ví dụ ['MÃ-101', 'MÃ-102', ...]
  variantIds: string[]; // Các ID đề con thuộc đợt này
  variantExams: Exam[];
  masterExam: Exam;
  submissions: StudentSubmission[];
  // Thống kê nhanh
  totalStudents: number;
  submittedCount: number;
  completionPercent: number;
  avgScore: string;
  highestScore: string;
  lowestScore: string;
  passRate: number; // % điểm >= 5.0
  countGioi: number;
  countKha: number;
  countTB: number;
  countYeu: number;
}

/**
 * Trích xuất tiêu đề gốc của bài thi (loại bỏ "(Mã Đề: 101)", "[Mã 102]", etc.)
 */
export function extractBaseExamTitle(rawTitle: string): string {
  if (!rawTitle) return 'Bài Kiểm Tra Môn Toán';
  return rawTitle
    .replace(/\s*\((?:Mã\s*(?:Đề|đề)?|Mã\s*đề thi)[:\s]*[^)]+\)/gi, '')
    .replace(/\s*\[(?:Mã\s*(?:Đề|đề)?|Mã\s*đề thi)[:\s]*[^\]]+\]/gi, '')
    .replace(/\s*-\s*Mã\s*(?:đề|Đề)\s*:\s*\S+/gi, '')
    .replace(/\s*-\s*MÃ-\d+/gi, '')
    .replace(/\s*-\s*(?:TOAN|TAITAO)\d+-\d+/gi, '')
    .replace(/\s*-\s*Mã\s*\d+/gi, '')
    .trim();
}

/**
 * Xác định khóa nhóm của đợt kiểm tra (Session Key)
 * Tất cả các mã đề con của cùng 1 đợt sẽ có chung sessionKey
 */
export function getExamSessionKey(item: {
  id?: string;
  examCode?: string;
  masterExamCode?: string;
  title?: string;
}): string {
  if (item.masterExamCode && item.masterExamCode.trim()) {
    return item.masterExamCode.trim().toUpperCase();
  }
  
  if (item.id && item.id.includes('-variant-')) {
    return item.id.split('-variant-')[0];
  }

  // Nếu examCode có dạng MÃ-101, MÃ-102... -> gom theo tiền tố hoặc theo title gốc
  const baseTitle = extractBaseExamTitle(item.title || '');
  if (baseTitle && baseTitle.length > 5) {
    return `SESSION-${baseTitle.toUpperCase().replace(/\s+/g, '_')}`;
  }

  if (item.examCode && /^MÃ-\d+$/i.test(item.examCode.trim())) {
    // Nhóm các mã đề cùng lô biến thể MÃ-1xx
    return 'SESSION-MÃ-1XX';
  }

  return item.id || item.examCode || 'DEFAULT-SESSION';
}

/**
 * Gom nhóm các bài kiểm tra và bài nộp của một lớp thành các Đợt Kiểm Tra (Exam Sessions)
 * Thay vì hiển thị 19 thẻ mã đề rời rạc, sẽ hiển thị đúng các Bài Kiểm Tra Thường Xuyên 1, 2...
 */
export function groupExamsIntoSessions(
  exams: Exam[],
  submissions: StudentSubmission[],
  targetClassName: string,
  roster: StudentRosterItem[] = [],
  currentExam?: Exam | null
): ExamSession[] {
  const deletedExamIds = getDeletedExamIds();
  const normTargetClass = (targetClassName || '').trim().toUpperCase().replace(/^LỚP\s+/i, '');

  // Lọc bài nộp của đúng lớp này (hoặc tất cả nếu không chỉ định lớp) và chưa bị xóa
  const classSubs = submissions.filter((s) => {
    const sCls = (s.studentClass || '').trim().toUpperCase().replace(/^LỚP\s+/i, '');
    const isDeleted =
      deletedExamIds.has(s.id) ||
      deletedExamIds.has(s.examId || '') ||
      deletedExamIds.has(s.examCode || '');
    if (isDeleted) return false;
    if (!normTargetClass || normTargetClass === 'ALL' || normTargetClass === 'TẤT CẢ') {
      return true;
    }
    return sCls === normTargetClass;
  });

  // Bản đồ lưu các nhóm session
  const sessionMap = new Map<
    string,
    {
      sessionKey: string;
      baseTitle: string;
      durationMinutes: number;
      grade: string;
      topic?: string;
      createdAt: string;
      variantCodes: Set<string>;
      variantIds: Set<string>;
      variantExams: Exam[];
      masterExamCandidates: Exam[];
      subs: StudentSubmission[];
    }
  >();

  // 1. Quét qua các bài nộp của lớp để tìm các đợt kiểm tra học sinh đã làm
  classSubs.forEach((sub) => {
    const sExam = sub.examSnapshot;
    const sessionKey = getExamSessionKey({
      id: sub.examId,
      examCode: sub.examCode,
      masterExamCode: sExam?.masterExamCode,
      title: sExam?.title || sub.examCode,
    });

    if (!sessionMap.has(sessionKey)) {
      const baseTitle = extractBaseExamTitle(sExam?.title || `Bài kiểm tra ${sub.examCode}`);
      sessionMap.set(sessionKey, {
        sessionKey,
        baseTitle,
        durationMinutes: sExam?.durationMinutes || 45,
        grade: sExam?.grade || '12',
        topic: sExam?.topic,
        createdAt: sExam?.createdAt || sub.submittedAt || new Date().toISOString(),
        variantCodes: new Set(),
        variantIds: new Set(),
        variantExams: [],
        masterExamCandidates: [],
        subs: [],
      });
    }

    const group = sessionMap.get(sessionKey)!;
    if (sub.examCode) group.variantCodes.add(sub.examCode);
    if (sub.examId) group.variantIds.add(sub.examId);
    if (sExam && !group.variantExams.some((e) => e.id === sExam.id)) {
      group.variantExams.push(sExam);
      if (!sExam.id.includes('-variant-')) {
        group.masterExamCandidates.push(sExam);
      }
    }
    group.subs.push(sub);
  });

  // 2. Quét qua danh sách đề thi lưu trữ (savedExams) để bổ sung các đề tương ứng
  exams.forEach((ex) => {
    if (deletedExamIds.has(ex.id) || deletedExamIds.has(ex.examCode)) return;

    const sessionKey = getExamSessionKey({
      id: ex.id,
      examCode: ex.examCode,
      masterExamCode: ex.masterExamCode,
      title: ex.title,
    });

    if (sessionMap.has(sessionKey)) {
      const group = sessionMap.get(sessionKey)!;
      if (ex.examCode) group.variantCodes.add(ex.examCode);
      if (ex.id) group.variantIds.add(ex.id);
      if (!group.variantExams.some((e) => e.id === ex.id)) {
        group.variantExams.push(ex);
      }
      if (!ex.id.includes('-variant-')) {
        group.masterExamCandidates.push(ex);
      }
    } else {
      // Nếu đợt kiểm tra này chưa có bài nộp nhưng được tạo trong ngân hàng đề
      const baseTitle = extractBaseExamTitle(ex.title);
      sessionMap.set(sessionKey, {
        sessionKey,
        baseTitle,
        durationMinutes: ex.durationMinutes || 45,
        grade: ex.grade || '12',
        topic: ex.topic,
        createdAt: ex.createdAt || new Date().toISOString(),
        variantCodes: new Set([ex.examCode]),
        variantIds: new Set([ex.id]),
        variantExams: [ex],
        masterExamCandidates: ex.id.includes('-variant-') ? [] : [ex],
        subs: [],
      });
    }
  });

  // 3. Bổ sung currentExam nếu có
  if (currentExam && !deletedExamIds.has(currentExam.id) && !deletedExamIds.has(currentExam.examCode)) {
    const sessionKey = getExamSessionKey({
      id: currentExam.id,
      examCode: currentExam.examCode,
      masterExamCode: currentExam.masterExamCode,
      title: currentExam.title,
    });

    if (sessionMap.has(sessionKey)) {
      const group = sessionMap.get(sessionKey)!;
      group.variantCodes.add(currentExam.examCode);
      group.variantIds.add(currentExam.id);
      if (!group.variantExams.some((e) => e.id === currentExam.id)) {
        group.variantExams.push(currentExam);
      }
      group.masterExamCandidates.unshift(currentExam);
    } else {
      const baseTitle = extractBaseExamTitle(currentExam.title);
      sessionMap.set(sessionKey, {
        sessionKey,
        baseTitle,
        durationMinutes: currentExam.durationMinutes || 45,
        grade: currentExam.grade || '12',
        topic: currentExam.topic,
        createdAt: currentExam.createdAt || new Date().toISOString(),
        variantCodes: new Set([currentExam.examCode]),
        variantIds: new Set([currentExam.id]),
        variantExams: [currentExam],
        masterExamCandidates: [currentExam],
        subs: [],
      });
    }
  }

  // 4. Chuẩn hóa và tính toán các chỉ số thống kê của từng Đợt Kiểm Tra
  const totalRosterCount = roster.filter(
    (s) =>
      (s.className || '').trim().toUpperCase().replace(/^LỚP\s+/i, '') === normTargetClass
  ).length || 44;

  const rawSessions = Array.from(sessionMap.values());

  // Sắp xếp theo ngày tạo hoặc số bài nộp
  rawSessions.sort((a, b) => {
    return b.subs.length - a.subs.length || b.createdAt.localeCompare(a.createdAt);
  });

  return rawSessions.map((group, index) => {
    const sessionNumber = index + 1;
    let sessionLabel = `Bài Kiểm Tra Thường Xuyên ${sessionNumber}`;
    if (/giữa\s*kỳ|định\s*kỳ|học\s*kỳ/i.test(group.baseTitle)) {
      sessionLabel = `Bài Kiểm Tra Định Kỳ ${sessionNumber}`;
    }

    // Chọn Master Exam chuẩn nhất để làm đại diện câu hỏi & ma trận đề
    const masterExam: Exam =
      group.masterExamCandidates[0] ||
      group.variantExams.find((e) => !e.id.includes('-variant-')) ||
      group.variantExams[0] ||
      currentExam ||
      ({
        id: group.sessionKey,
        title: group.baseTitle,
        examCode: Array.from(group.variantCodes)[0] || 'KT-TX',
        grade: group.grade,
        durationMinutes: group.durationMinutes,
        totalPoints: 10,
        multipleChoice: [],
        trueFalseQuestions: [],
        essays: [],
        createdAt: group.createdAt,
      } as Exam);

    const scores = group.subs.map((s) => s.totalScore);
    const submittedCount = group.subs.length;
    const completionPercent = Math.min(100, Math.round((submittedCount / totalRosterCount) * 100));

    const avgScore =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : '—';
    const highestScore = scores.length > 0 ? Math.max(...scores).toFixed(2) : '—';
    const lowestScore = scores.length > 0 ? Math.min(...scores).toFixed(2) : '—';
    const passRate =
      scores.length > 0
        ? Math.round((scores.filter((sc) => sc >= 5.0).length / scores.length) * 100)
        : 0;

    const countGioi = scores.filter((sc) => sc >= 8.0).length;
    const countKha = scores.filter((sc) => sc >= 6.5 && sc < 8.0).length;
    const countTB = scores.filter((sc) => sc >= 5.0 && sc < 6.5).length;
    const countYeu = scores.filter((sc) => sc < 5.0).length;

    const titleWithSession = `${sessionLabel}: ${group.baseTitle}`;

    return {
      id: masterExam.id || group.sessionKey,
      sessionKey: group.sessionKey,
      sessionNumber,
      sessionLabel,
      title: titleWithSession,
      baseTitle: group.baseTitle,
      topic: group.topic || masterExam.topic,
      grade: group.grade,
      durationMinutes: group.durationMinutes,
      totalPoints: masterExam.totalPoints || 10,
      createdAt: group.createdAt,
      variantCodes: Array.from(group.variantCodes).sort(),
      variantIds: Array.from(group.variantIds),
      variantExams: group.variantExams,
      masterExam,
      submissions: group.subs,
      totalStudents: totalRosterCount,
      submittedCount,
      completionPercent,
      avgScore,
      highestScore,
      lowestScore,
      passRate,
      countGioi,
      countKha,
      countTB,
      countYeu,
    };
  });
}

/**
 * Phân tích độ khó và thống kê Đúng/Sai của từng câu hỏi trong đợt kiểm tra (Item Analysis)
 * Giúp giáo viên thấy ngay:
 * 1. Các câu học sinh làm đúng nhiều
 * 2. Các câu học sinh làm sai nhiều nhất (Top câu hỏi sai) để chữa bài trên lớp
 */
export function computeItemAnalysis(session: ExamSession): {
  analyses: QuestionAnalysis[];
  topFailedQuestions: QuestionAnalysis[];
  summary: {
    totalQuestions: number;
    mcCount: number;
    tfCount: number;
    essayCount: number;
    overallAccuracy: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
  };
} {
  const master = session.masterExam;
  const submissions = session.submissions;
  const totalSubs = submissions.length;

  const analyses: QuestionAnalysis[] = [];

  // 1. Phân tích Phần I: Trắc nghiệm Nhiều Lựa Chọn (Multiple Choice)
  const mcQuestions = master?.multipleChoice || [];
  mcQuestions.forEach((mc, idx) => {
    const qIndex = idx + 1;
    let correctCount = 0;
    const choiceCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

    submissions.forEach((sub) => {
      // Tìm câu trả lời của học sinh cho câu hỏi này
      // mcAnswers lưu theo questionId mc.id
      const ans = (sub.mcAnswers?.[mc.id] || '').trim().toUpperCase();
      if (ans && choiceCounts[ans] !== undefined) {
        choiceCounts[ans]++;
      }
      if (ans === mc.correctAnswer.toUpperCase()) {
        correctCount++;
      }
    });

    const totalAttempts = totalSubs > 0 ? totalSubs : 1;
    const correctRate = Math.round((correctCount / totalAttempts) * 100);
    const incorrectCount = totalAttempts - correctCount;

    let difficultyLabel: 'Dễ' | 'Trung bình' | 'Phân hóa' | 'Khó / Sai nhiều' = 'Trung bình';
    let difficultyBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';

    if (correctRate >= 80) {
      difficultyLabel = 'Dễ';
      difficultyBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    } else if (correctRate >= 60) {
      difficultyLabel = 'Trung bình';
      difficultyBadgeColor = 'bg-sky-100 text-sky-800 border-sky-200';
    } else if (correctRate >= 40) {
      difficultyLabel = 'Phân hóa';
      difficultyBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
    } else {
      difficultyLabel = 'Khó / Sai nhiều';
      difficultyBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200 font-black';
    }

    const choiceDistribution: Record<string, { count: number; percent: number }> = {};
    ['A', 'B', 'C', 'D'].forEach((letter) => {
      const c = choiceCounts[letter] || 0;
      choiceDistribution[letter] = {
        count: c,
        percent: Math.round((c / totalAttempts) * 100),
      };
    });

    analyses.push({
      questionIndex: qIndex,
      questionId: mc.id,
      type: 'mc',
      part: 'I',
      partLabel: 'Phần I: Trắc Nghiệm 4 Lựa Chọn',
      questionText: mc.question,
      correctAnswerText: `Đáp án ${mc.correctAnswer}`,
      options: mc.options,
      explanation: mc.explanation,
      totalAttempts,
      correctCount,
      incorrectCount,
      correctRate,
      difficultyLabel,
      difficultyBadgeColor,
      choiceDistribution,
    });
  });

  // 2. Phân tích Phần II: Đúng / Sai (True / False)
  const tfQuestions = master?.trueFalseQuestions || [];
  tfQuestions.forEach((tf, tfIdx) => {
    const qIndex = tfIdx + 1;
    let tfTotalCorrectStatements = 0;
    const subItemsAnalysis = (tf.items || []).map((item) => {
      let itemCorrectCount = 0;
      submissions.forEach((sub) => {
        const studentChoice = sub.tfAnswers?.[tf.id]?.[item.key];
        if (studentChoice === item.isCorrect) {
          itemCorrectCount++;
        }
      });
      const subTotalAttempts = totalSubs > 0 ? totalSubs : 1;
      const subRate = Math.round((itemCorrectCount / subTotalAttempts) * 100);
      tfTotalCorrectStatements += subRate;
      return {
        key: item.key.toUpperCase(),
        statement: item.statement,
        isCorrect: item.isCorrect,
        correctCount: itemCorrectCount,
        correctRate: subRate,
      };
    });

    const averageCorrectRate =
      subItemsAnalysis.length > 0
        ? Math.round(tfTotalCorrectStatements / subItemsAnalysis.length)
        : 70;
    const totalAttempts = totalSubs > 0 ? totalSubs : 1;
    const correctCount = Math.round((averageCorrectRate / 100) * totalAttempts);
    const incorrectCount = totalAttempts - correctCount;

    let difficultyLabel: 'Dễ' | 'Trung bình' | 'Phân hóa' | 'Khó / Sai nhiều' = 'Phân hóa';
    let difficultyBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
    if (averageCorrectRate >= 80) {
      difficultyLabel = 'Dễ';
      difficultyBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    } else if (averageCorrectRate >= 60) {
      difficultyLabel = 'Trung bình';
      difficultyBadgeColor = 'bg-sky-100 text-sky-800 border-sky-200';
    } else if (averageCorrectRate < 40) {
      difficultyLabel = 'Khó / Sai nhiều';
      difficultyBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200 font-black';
    }

    analyses.push({
      questionIndex: qIndex,
      questionId: tf.id,
      type: 'tf',
      part: 'II',
      partLabel: 'Phần II: Đúng / Sai',
      questionText: tf.prompt,
      correctAnswerText: subItemsAnalysis.map((i) => `${i.key}: ${i.isCorrect ? 'ĐÚNG' : 'SAI'}`).join(', '),
      explanation: 'Học sinh làm đủ 4 ý a, b, c, d của từng câu theo thang điểm chuẩn Bộ GD&ĐT.',
      totalAttempts,
      correctCount,
      incorrectCount,
      correctRate: averageCorrectRate,
      difficultyLabel,
      difficultyBadgeColor,
      subItems: subItemsAnalysis,
    });
  });

  // 3. Phân tích Phần III: Tự luận / Trả lời ngắn
  const essays = master?.essays || [];
  essays.forEach((es, esIdx) => {
    const qIndex = esIdx + 1;
    const totalAttempts = totalSubs > 0 ? totalSubs : 1;
    // Điểm trung bình tự luận
    let totalScoreAwarded = 0;
    submissions.forEach((sub) => {
      const eAns = sub.essayAnswers?.[es.id] || Object.values(sub.essayAnswers || {})[esIdx];
      const score = eAns?.grading?.totalScore || (sub.essayScore ? sub.essayScore / essays.length : 2.2);
      totalScoreAwarded += score;
    });
    const avgScore = totalScoreAwarded / totalAttempts;
    const maxScore = es.maxPoints || 3.0;
    const correctRate = Math.min(100, Math.round((avgScore / maxScore) * 100));
    const correctCount = Math.round((correctRate / 100) * totalAttempts);

    analyses.push({
      questionIndex: qIndex,
      questionId: es.id,
      type: 'essay',
      part: 'III',
      partLabel: 'Phần III: Tự Luận & Barem Chấm Bằng AI',
      questionText: es.question,
      correctAnswerText: `Điểm tối đa: ${maxScore} điểm. Đạt trung bình: ${avgScore.toFixed(2)}/${maxScore} điểm`,
      explanation: es.rubric?.map((r) => `${r.step}: ${r.points}đ`).join(' | ') || '',
      totalAttempts,
      correctCount,
      incorrectCount: totalAttempts - correctCount,
      correctRate,
      difficultyLabel: correctRate >= 70 ? 'Trung bình' : 'Phân hóa',
      difficultyBadgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    });
  });

  // Sắp xếp các câu hỏi sai nhiều nhất (Tỷ lệ làm đúng thấp nhất)
  const topFailedQuestions = [...analyses]
    .filter((a) => a.totalAttempts > 0)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 5);

  const overallAccuracy =
    analyses.length > 0
      ? Math.round(analyses.reduce((acc, curr) => acc + curr.correctRate, 0) / analyses.length)
      : 0;

  return {
    analyses,
    topFailedQuestions,
    summary: {
      totalQuestions: analyses.length,
      mcCount: mcQuestions.length,
      tfCount: tfQuestions.length,
      essayCount: essays.length,
      overallAccuracy,
      easyCount: analyses.filter((a) => a.difficultyLabel === 'Dễ').length,
      mediumCount: analyses.filter((a) => a.difficultyLabel === 'Trung bình').length,
      hardCount: analyses.filter((a) => a.difficultyLabel === 'Khó / Sai nhiều' || a.difficultyLabel === 'Phân hóa').length,
    },
  };
}
