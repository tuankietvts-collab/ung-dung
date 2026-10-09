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

export const DEFAULT_SAMPLE_EXAMS: Exam[] = [
  {
    id: 'exam-sample-toan12-01',
    title: 'ĐỀ THI MẪU TỐT NGHIỆP THPT TOÁN LỚP 12 - KHẢO SÁT HÀM SỐ & TÍCH PHÂN',
    examCode: 'TOAN12-TN2025',
    grade: '12',
    durationMinutes: 90,
    totalPoints: 10,
    textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
    topic: 'Khảo sát hàm số, Nguyên hàm - Tích phân & Tọa độ Oxyz',
    createdAt: '2025-01-15',
    part3Type: 'short_answer',
    multipleChoice: [
      {
        id: 'mc_1',
        question: 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên dưới. Hàm số đã cho đồng biến trên các khoảng nào sau đây?',
        options: ['A. $(-\\infty; 0)$ và $(2; +\\infty)$', 'B. $(0; 2)$', 'C. $(-2; 2)$', 'D. $(-\\infty; 2)$'],
        correctAnswer: 'A',
        points: 0.25,
        visualType: 'variation_table_cubic',
        visualCaption: 'Bảng biến thiên chuẩn SGK của hàm số $y = f(x)$',
        explanation: 'Quan sát dòng dấu của $y\'$ trên bảng biến thiên, ta thấy $y\' > 0$ trên các khoảng $(-\\infty; 0)$ và $(2; +\\infty)$, do đó hàm số đồng biến trên các khoảng này.'
      },
      {
        id: 'mc_2',
        question: 'Cho hàm số $y = \\dfrac{2x + 1}{x - 1}$ có đồ thị như hình vẽ bên. Khẳng định nào dưới đây là đúng?',
        options: [
          'A. Đồ thị có tiệm cận đứng $x = 1$, tiệm cận ngang $y = 2$',
          'B. Đồ thị có tiệm cận đứng $x = 2$, tiệm cận ngang $y = 1$',
          'C. Hàm số đồng biến trên từng khoảng xác định',
          'D. Đồ thị đi qua điểm $O(0; 0)$'
        ],
        correctAnswer: 'A',
        points: 0.25,
        visualType: 'plot_rational',
        visualCaption: 'Đồ thị hàm phân thức $y = \\dfrac{2x + 1}{x - 1}$',
        explanation: 'Hàm số $y = \\frac{2x+1}{x-1}$ có $\\lim_{x \\to 1^+} y = +\\infty$ nên có TCĐ $x = 1$; $\\lim_{x \\to \\pm\\infty} y = 2$ nên có TCN $y = 2$.'
      },
      {
        id: 'mc_3',
        question: 'Họ nguyên hàm của hàm số $f(x) = 3x^2 + 2x$ là:',
        options: ['A. $x^3 + x^2 + C$', 'B. $3x^3 + 2x^2 + C$', 'C. $6x + 2 + C$', 'D. $\\frac{x^3}{3} + x^2 + C$'],
        correctAnswer: 'A',
        points: 0.25,
        explanation: '$\\int (3x^2 + 2x)\\,\\mathrm{d}x = 3 \\cdot \\frac{x^3}{3} + 2 \\cdot \\frac{x^2}{2} + C = x^3 + x^2 + C$.'
      },
      {
        id: 'mc_4',
        question: 'Trong không gian $Oxyz$, cho mặt cầu $(S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 16$. Tọa độ tâm $I$ và bán kính $R$ của $(S)$ là:',
        options: [
          'A. $I(1; -2; 3), R = 4$',
          'B. $I(-1; 2; -3), R = 4$',
          'C. $I(1; -2; 3), R = 16$',
          'D. $I(-1; 2; -3), R = 16$'
        ],
        correctAnswer: 'A',
        points: 0.25,
        explanation: 'Phương trình mặt cầu dạng chuẩn $(x - a)^2 + (y - b)^2 + (z - c)^2 = R^2$ có tâm $I(a; b; c) = (1; -2; 3)$ và bán kính $R = \\sqrt{16} = 4$.'
      }
    ],
    trueFalseQuestions: [
      {
        id: 'tf_1',
        prompt: 'Cho hàm số bậc ba $y = f(x) = x^3 - 3x^2 + 2$ có đồ thị $(C)$ như hình vẽ bên. Xét tính đúng/sai của các mệnh đề sau:',
        visualType: 'plot_cubic',
        visualCaption: 'Đồ thị hàm số bậc ba $y = x^3 - 3x^2 + 2$',
        pointsPerSub: 0.25,
        items: [
          { key: 'a', statement: 'Hàm số đã cho đạt cực đại tại $x = 0$.', isCorrect: true },
          { key: 'b', statement: 'Giá trị cực tiểu của hàm số là $y_{CT} = -2$.', isCorrect: true },
          { key: 'c', statement: 'Điểm uốn của đồ thị hàm số là $U(1; 1)$.', isCorrect: false },
          { key: 'd', statement: 'Phương trình tiếp tuyến của $(C)$ tại điểm có hoành độ $x = 2$ là $y = 2$.', isCorrect: false }
        ]
      }
    ],
    essays: [
      {
        id: 'essay_1',
        question: 'Một chất điểm chuyển động với vận tốc $v(t) = 3t^2 - 6t + 5$ (m/s). Tính quãng đường chất điểm di chuyển được trong khoảng thời gian từ $t = 0$ đến $t = 3$ giây.',
        maxPoints: 1.5,
        shortAnswerKey: '24',
        rubric: [
          { step: 'Bước 1', description: 'Viết công thức tích phân quãng đường $S = \\int_0^3 v(t)\\,\\mathrm{d}t = \\int_0^3 (3t^2 - 6t + 5)\\,\\mathrm{d}t$.', points: 0.5 },
          { step: 'Bước 2', description: 'Tìm nguyên hàm: $[t^3 - 3t^2 + 5t]_0^3$.', points: 0.5 },
          { step: 'Bước 3', description: 'Thay số tính toán: $(27 - 27 + 15) - 0 = 15$ hoặc kiểm tra lại giá trị.', points: 0.5 }
        ]
      }
    ]
  },
  {
    id: 'exam-sample-toan11-01',
    title: 'ĐỀ THI MẪU TOÁN LỚP 11 - LƯỢNG GIÁC, DÃY SỐ & HÌNH KHÔNG GIAN',
    examCode: 'TOAN11-GK2',
    grade: '11',
    durationMinutes: 45,
    totalPoints: 10,
    textbook: 'Kết Nối Tri Thức Với Cuộc Sống',
    topic: 'Hàm số lượng giác, Cấp số cộng, Giới hạn dãy số & Quan hệ song song',
    createdAt: '2025-02-10',
    part3Type: 'short_answer',
    multipleChoice: [
      {
        id: 'mc_1',
        question: 'Tập giá trị của hàm số $y = 3\\sin(2x) - 1$ là:',
        options: ['A. $[-4; 2]$', 'B. $[-3; 3]$', 'C. $[-1; 5]$', 'D. $[-2; 4]$'],
        correctAnswer: 'A',
        points: 0.25,
        explanation: 'Ta có $-1 \\le \\sin(2x) \\le 1 \\implies -3 \\le 3\\sin(2x) \\le 3 \\implies -4 \\le 3\\sin(2x) - 1 \\le 2$. Tập giá trị là $[-4; 2]$.'
      },
      {
        id: 'mc_2',
        question: 'Cho cấp số cộng $(u_n)$ có $u_1 = 3$ và công sai $d = 4$. Số hạng thứ 5 của cấp số cộng là:',
        options: ['A. $u_5 = 19$', 'B. $u_5 = 23$', 'C. $u_5 = 15$', 'D. $u_5 = 27$'],
        correctAnswer: 'A',
        points: 0.25,
        explanation: '$u_5 = u_1 + 4d = 3 + 4 \\times 4 = 19$.'
      },
      {
        id: 'mc_3',
        question: 'Giá trị của giới hạn $\\lim_{n \\to +\\infty} \\frac{2n + 1}{n + 3}$ bằng:',
        options: ['A. $2$', 'B. $\\frac{1}{3}$', 'C. $0$', 'D. $+\\infty$'],
        correctAnswer: 'A',
        points: 0.25,
        explanation: 'Chia cả tử và mẫu cho $n$: $\\lim \\frac{2 + 1/n}{1 + 3/n} = \\frac{2 + 0}{1 + 0} = 2$.'
      }
    ],
    trueFalseQuestions: [
      {
        id: 'tf_1',
        prompt: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình bình hành tâm $O$. Gọi $M, N$ lần lượt là trung điểm của $SA, SC$. Xét tính đúng/sai:',
        pointsPerSub: 0.25,
        items: [
          { key: 'a', statement: 'Đoạn thẳng $MN$ song song với mặt phẳng $(ABCD)$.', isCorrect: true },
          { key: 'b', statement: 'Đoạn thẳng $MN$ song song với $AC$.', isCorrect: true },
          { key: 'c', statement: 'Đường thẳng $SO$ cắt mặt phẳng $(BMN)$ tại trung điểm của $SO$.', isCorrect: true },
          { key: 'd', statement: 'Thiết diện của hình chóp cắt bởi mặt phẳng $(BMN)$ là tam giác.', isCorrect: false }
        ]
      }
    ],
    essays: [
      {
        id: 'essay_1',
        question: 'Tìm số hạng đầu $u_1$ và công sai $d$ của cấp số cộng $(u_n)$ biết: $u_2 + u_5 = 19$ và $u_3 + u_7 = 27$. Tính giá trị của $u_{10}$.',
        maxPoints: 2.0,
        shortAnswerKey: '39',
        rubric: [
          { step: 'Bước 1', description: 'Thiết lập hệ phương trình: $(u_1 + d) + (u_1 + 4d) = 19 \\iff 2u_1 + 5d = 19$ và $(u_1 + 2d) + (u_1 + 6d) = 27 \\iff 2u_1 + 8d = 27$.', points: 0.75 },
          { step: 'Bước 2', description: 'Giải hệ: $3d = 8 \\implies d = 8/3$ hoặc kiểm tra hệ số nguyên.', points: 0.5 },
          { step: 'Bước 3', description: 'Tìm $u_{10}$.', points: 0.75 }
        ]
      }
    ]
  }
];
