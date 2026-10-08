export interface RubricStep {
  step: string;
  description: string;
  points: number;
}

export interface MultipleChoiceQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string; // 'A' | 'B' | 'C' | 'D'
  points: number;
  explanation?: string;
  visualType?: 'variation_table_rational' | 'variation_table_cubic' | 'plot_rational' | 'plot_cubic' | 'statistics_table' | 'geometry_pyramid';
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
  visualType?: 'variation_table_rational' | 'variation_table_cubic' | 'plot_rational' | 'plot_cubic' | 'statistics_table' | 'geometry_pyramid';
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
  visualType?: 'variation_table_rational' | 'variation_table_cubic' | 'plot_rational' | 'plot_cubic' | 'statistics_table' | 'geometry_pyramid';
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

export interface StudentSubmission {
  id: string;
  studentName: string;
  studentClass: string;
  studentId: string;
  examCode: string;
  submittedAt: string;
  startTime?: string;
  tabViolations?: number;
  mcAnswers: Record<string, string>;
  tfAnswers: Record<string, Record<string, boolean | null>>;
  shortAnswers?: Record<string, string>;
  essayAnswers: Record<string, {
    imageUrl: string;
    imageUrls?: string[];
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
}

export interface ClassGroup {
  id: string;
  name: string; // Ví dụ: "10A1", "10A2", "12A8"
  grade: string; // "10" | "11" | "12"
  schoolYear: string; // Ví dụ: "2024 - 2025"
  studentCount?: number;
  createdAt?: string;
}

export interface StudentRosterItem {
  id: string;
  stt: number;
  fullName: string;
  className: string;
  sbd: string;
  assignedCode?: string;
  createdAt?: string;
  username?: string;
  password?: string;
  isAccountCreated?: boolean;
}

export type UserRole = 'admin' | 'teacher' | 'student';

export interface AppUser {
  uid: string;
  role: UserRole;
  fullName: string;
  username: string;
  email?: string;
  school?: string;
  className?: string;
  subject?: string;
  sbd?: string;
  createdAt?: string;
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
