export interface RubricStep {
  step: string;
  description: string;
  points: number;
}

export type QuestionVisualType =
  | 'variation_table_rational'
  | 'variation_table_cubic'
  | 'variation_table_quartic'
  | 'variation_table_quadratic'
  | 'variation_table_custom'
  | 'sign_table'
  | 'plot_rational'
  | 'plot_cubic'
  | 'plot_quadratic'
  | 'plot_quartic'
  | 'plot_trig'
  | 'plot_trig_sin'
  | 'plot_trig_cos'
  | 'plot_custom'
  | 'statistics_table'
  | 'geometry_pyramid'
  | 'geometry_oxyz';

export interface MultipleChoiceQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string; // 'A' | 'B' | 'C' | 'D'
  points: number;
  explanation?: string;
  visualType?: QuestionVisualType;
  visualCaption?: string;
  customImageUrl?: string;
}

export interface TrueFalseSubItem {
  key: string; // 'a' | 'b' | 'c' | 'd'
  statement: string;
  isCorrect: boolean;
}

export interface TrueFalseQuestion {
  id: string;
  prompt: string;
  items: TrueFalseSubItem[];
  pointsPerSub: number;
  visualType?: QuestionVisualType;
  visualCaption?: string;
  customImageUrl?: string;
}

export interface EssayQuestion {
  id: string;
  question: string;
  maxPoints: number;
  rubric: RubricStep[];
  type?: 'short_answer' | 'essay';
  shortAnswerKey?: string;
  shortAnswerPlaceholder?: string;
  sampleSolution?: string;
  visualType?: QuestionVisualType;
  visualCaption?: string;
  customImageUrl?: string;
}

export interface Exam {
  id: string;
  title: string;
  examCode: string;
  masterExamCode?: string;
  variantIndex?: number;
  assignedStudentId?: string;
  assignedStudentName?: string;
  grade: string;
  durationMinutes: number;
  totalPoints: number;
  textbook?: string;
  topic?: string;
  part3Type?: 'short_answer' | 'essay';
  multipleChoice: MultipleChoiceQuestion[];
  trueFalseQuestions: TrueFalseQuestion[];
  essays: EssayQuestion[];
  createdAt: string;
  className?: string;
  assignedClassNames?: string[];
  assignedStudentIds?: string[];
  assignedGroupDetails?: string;
  maxAttempts?: number; // Số lần làm bài tối đa cho phép (1, 2, 3... hoặc undefined/0 là không giới hạn)
  variantCount?: number; // Số mã đề cần sinh (ví dụ: 1, 2, 4, 8, 24, 45)
  variants?: Exam[];
}

export interface RubricEvaluationItem {
  stepTitle: string;
  maxStepPoints: number;
  awardedPoints: number;
  isCorrect: boolean;
  comment: string;
}

export interface TeacherEssayOverride {
  originalAiScore: number;
  teacherScore: number;
  teacherFeedback: string;
  overrideReason?: 'ai_too_strict' | 'ai_too_lenient' | 'ocr_misread' | 'alternative_valid_method' | 'partial_credit' | 'other';
  adjustedAt: string;
  teacherName?: string;
  stepAdjustments?: Record<number, { awardedPoints: number; comment?: string }>;
}

export interface GradingCalibrationFeedback {
  id: string;
  submissionId: string;
  studentName: string;
  studentClass: string;
  studentId?: string;
  essayId: string;
  questionText: string;
  ocrTranscription?: string;
  aiScore: number;
  teacherScore: number;
  scoreDelta: number;
  aiFeedback?: string;
  teacherFeedback: string;
  reason: string;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt: string;
  teacherName?: string;
}

export interface EssayGradingResult {
  ocrTranscription: string;
  detectedSteps: string[];
  rubricEvaluation: RubricEvaluationItem[];
  universityMethodDetected: boolean;
  universityMethodDetails?: string;
  strengths: string[];
  weaknesses: string[];
  totalScore: number;
  maxPoints: number;
  finalTeacherNote: string;
}

export interface StudentAppeal {
  id: string;
  submissionId: string;
  examCode: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  questionRef: string; // e.g. "Câu 1 Phần III", "Điểm toàn bài"
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  teacherReply?: string;
  adjustedScore?: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface StudentSubmission {
  id: string;
  studentName: string;
  studentClass: string;
  studentId: string;
  examCode: string;
  examId?: string;
  attemptNumber?: number; // Lần làm bài thứ mấy (1, 2, 3...)
  submittedAt: string;
  startTime?: string;
  tabViolations?: number;
  mcAnswers: Record<string, string>;
  tfAnswers: Record<string, Record<string, boolean | null>>;
  shortAnswers?: Record<string, string>;
  essayAnswers: Record<string, {
    imageUrl?: string;
    imageUrls?: string[];
    typedSolution?: string;
    submissionType?: 'image' | 'typed' | 'both';
    grading?: EssayGradingResult;
  }>;
  mcScore: number;
  essayScore: number;
  totalScore: number;
  status: 'graded' | 'pending';
  examSnapshot?: Exam;
  teacherOverrides?: Record<string, TeacherEssayOverride>;
  teacherGeneralComment?: string;
  isTeacherReviewed?: boolean;
  reviewedAt?: string;
  appeals?: StudentAppeal[];
  isPendingSubmission?: boolean;
}

export interface ClassGroup {
  id: string; // [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP], VD: "VTS_TO_26_12A8"
  name: string; // Ví dụ: "12A8"
  grade: string; // "10" | "11" | "12"
  schoolYear: string; // Ví dụ: "2026-2027"
  schoolFullName?: string; // Ví dụ: "THPT Võ Thị Sáu"
  schoolCode?: string; // Ví dụ: "VTS"
  subjectFullName?: string; // Ví dụ: "Toán"
  subjectCode?: string; // Ví dụ: "TO"
  yearCode?: string; // Ví dụ: "26"
  studentCount?: number;
  createdAt?: string;
  teacherId?: string;
  teacherName?: string;
}

export interface StudentRosterItem {
  id: string; // [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP]_[STT_2_SỐ], VD: "VTS_TO_26_12A8_01"
  stt: number;
  fullName: string;
  className: string;
  classId?: string; // "VTS_TO_26_12A8"
  sbd: string;
  assignedCode?: string;
  createdAt?: string;
  username?: string; // "12a801"
  password?: string; // "123456"
  isAccountCreated?: boolean;
  schoolFullName?: string;
  schoolCode?: string;
  subjectFullName?: string;
  subjectCode?: string;
  yearCode?: string;
}

export type UserRole = 'admin' | 'teacher' | 'student';

export interface AppUser {
  uid: string;
  role: UserRole;
  fullName: string;
  username: string;
  email?: string;
  school?: string;
  schoolCode?: string;
  className?: string;
  classId?: string;
  subject?: string;
  subjectCode?: string;
  yearCode?: string;
  sbd?: string;
  createdAt?: string;
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface TeacherProfile {
  uid: string;
  email: string;
  fullName: string;
  school?: string;
  subject?: string;
  createdAt?: string;
  role?: UserRole;
}

export interface MatrixSectionCount {
  title?: string;
  nhanBiet: number;
  thongHieu: number;
  vanDung: number;
  vanDungCao?: number;
  totalQuestions: number;
  points: number;
}

export interface ExamMatrixData {
  topic?: string;
  grade?: string;
  textbook?: string;
  durationMinutes?: number;
  totalPoints?: number;
  part1: MatrixSectionCount; // Trắc nghiệm nhiều lựa chọn
  part2: MatrixSectionCount; // Trắc nghiệm Đúng / Sai
  part3: MatrixSectionCount; // Tự luận
  part3Type?: 'short_answer' | 'essay'; // 'short_answer' (Trả lời ngắn) | 'essay' (Tự luận giải chi tiết)
  rawSummary?: string;
}
