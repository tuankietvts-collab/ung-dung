import { Exam, StudentSubmission } from '../types/exam';

// Helper: generate realistic mathematical handwritten paper images as data URLs
export function createHandwrittenMathSvg(type: 'perfect' | 'university_error' | 'calculation_error'): string {
  if (type === 'university_error') {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="700" viewBox="0 0 800 700">
        <rect width="100%" height="100%" fill="#fffcf0" />
        <defs>
          <pattern id="grid" width="20" height="25" patternUnits="userSpaceOnUse">
            <line x1="0" y1="25" x2="20" y2="25" stroke="#e2e8f0" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <line x1="60" y1="0" x2="60" y2="700" stroke="#fca5a5" stroke-width="1.5" />
        <text x="80" y="45" font-family="'Caveat', cursive, sans-serif" font-size="20" fill="#1e3a8a">
          Bài làm Tự luận Toán - Học sinh dự thi
        </text>
        <text x="80" y="85" font-family="'Caveat', cursive, sans-serif" font-size="22" fill="#0f172a" font-weight="bold">
          Câu tự luận giải toán:
        </text>
        <text x="80" y="130" font-family="'Caveat', cursive, sans-serif" font-size="20" fill="#0369a1">
          Các bước biến đổi toán học thực tế trên giấy thi...
        </text>
      </svg>
    `)}`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="700" viewBox="0 0 800 700">
      <rect width="100%" height="100%" fill="#fffdfa" />
      <line x1="60" y1="0" x2="60" y2="700" stroke="#fca5a5" stroke-width="1.5" />
      <text x="80" y="50" font-family="'Caveat', cursive, sans-serif" font-size="20" fill="#1e3a8a">
        Bài làm Tự luận Toán học sinh
      </text>
      <text x="80" y="100" font-family="'Caveat', cursive, sans-serif" font-size="20" fill="#0f172a">
        Thí sinh làm bài thi theo đúng chuẩn SGK GDPT 2018.
      </text>
    </svg>
  `)}`;
}

export const INITIAL_SUBMISSIONS: StudentSubmission[] = [];
