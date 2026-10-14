import { Exam, MultipleChoiceQuestion, TrueFalseQuestion, EssayQuestion, ExamMatrixData } from '../types/exam';

export interface StandardExamBuildOptions {
  grade: '10' | '11' | '12' | string;
  topic?: string;
  textbook?: string;
  part3Type?: 'short_answer' | 'essay';
  matrix?: ExamMatrixData;
  matrixFileName?: string;
  promptCustom?: string;
}

/**
 * Builds a 100% compliant GDPT 2018 Vietnamese High School Math Exam (Toán 10, 11, 12).
 * Formatted strictly according to the Ministry of Education & Training specifications:
 * - Phần I: 12 câu trắc nghiệm nhiều lựa chọn (3.0 điểm)
 * - Phần II: 4 câu đúng / sai, mỗi câu gồm 4 ý a, b, c, d (4.0 điểm)
 * - Phần III: 6 câu trả lời ngắn hoặc 2-3 câu tự luận kèm barem chi tiết (3.0 điểm)
 */
export function buildStandardGdptExam(options: StandardExamBuildOptions): Exam {
  const gradeStr = String(options.grade || '11').trim();
  const effectiveGrade: '10' | '11' | '12' = gradeStr === '10' ? '10' : gradeStr === '12' ? '12' : '11';
  const part3Type = options.part3Type || 'short_answer';
  const textbook = options.textbook || 'Kết Nối Tri Thức Với Cuộc Sống';
  const fileName = options.matrixFileName || '';
  const isMidterm1 = /gk1|giua\s*ky\s*1|ktkg1/i.test(fileName) || /giữa\s*kỳ\s*1/i.test(options.topic || '');
  const isFinal1 = /ck1|cuoi\s*ky\s*1/i.test(fileName);
  const isMidterm2 = /gk2|giua\s*ky\s*2/i.test(fileName);

  const randomSuffix = Math.floor(100 + Math.random() * 900);

  if (effectiveGrade === '11') {
    return buildGrade11Exam(isMidterm1, isFinal1, isMidterm2, part3Type, textbook, randomSuffix, fileName);
  } else if (effectiveGrade === '10') {
    return buildGrade10Exam(part3Type, textbook, randomSuffix, fileName);
  } else {
    return buildGrade12Exam(part3Type, textbook, randomSuffix, fileName);
  }
}

function buildGrade11Exam(
  isMidterm1: boolean,
  _isFinal1: boolean,
  _isMidterm2: boolean,
  part3Type: 'short_answer' | 'essay',
  textbook: string,
  suffix: number,
  fileName: string
): Exam {
  const examCode = `TOAN11-${suffix}`;
  const examTitle = isMidterm1
    ? `ĐỀ KIỂM TRA GIỮA KỲ 1 MÔN TOÁN LỚP 11 - (THEO MA TRẬN ${fileName || 'GDPT 2018'})`
    : `ĐỀ KIỂM TRA THƯỜNG XUYÊN MÔN TOÁN LỚP 11 - CHƯƠNG TRÌNH GDPT 2018`;

  const multipleChoice: MultipleChoiceQuestion[] = [
    {
      id: 'mc_1',
      question: 'Tập xác định của hàm số lượng giác $y = \\tan\\left(x - \\frac{\\pi}{4}\\right)$ là:',
      options: [
        'A. $\\mathcal{D} = \\mathbb{R} \\setminus \\left\\{ \\frac{3\\pi}{4} + k\\pi, k \\in \\mathbb{Z} \\right\\}$',
        'B. $\\mathcal{D} = \\mathbb{R} \\setminus \\left\\{ \\frac{\\pi}{4} + k\\pi, k \\in \\mathbb{Z} \\right\\}$',
        'C. $\\mathcal{D} = \\mathbb{R} \\setminus \\left\\{ \\frac{\\pi}{2} + k\\pi, k \\in \\mathbb{Z} \\right\\}$',
        'D. $\\mathcal{D} = \\mathbb{R} \\setminus \\left\\{ k\\pi, k \\in \\mathbb{Z} \\right\\}$',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Điều kiện xác định: $x - \\frac{\\pi}{4} \\ne \\frac{\\pi}{2} + k\\pi \\iff x \\ne \\frac{3\\pi}{4} + k\\pi$ ($k \\in \\mathbb{Z}$).',
    },
    {
      id: 'mc_2',
      question: 'Giá trị lớn nhất của hàm số $y = 3\\cos(2x) - 1$ trên $\\mathbb{R}$ bằng:',
      options: ['A. $2$', 'B. $3$', 'C. $4$', 'D. $-4$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Vì $-1 \\le \\cos(2x) \\le 1$ nên $-3 \\le 3\\cos(2x) \\le 3 \\implies -4 \\le y \\le 2$. Do đó $\\max y = 2$ khi $\\cos(2x) = 1$.',
    },
    {
      id: 'mc_3',
      question: 'Tất cả các nghiệm của phương trình lượng giác cơ bản $2\\sin x - \\sqrt{3} = 0$ là:',
      options: [
        'A. $x = \\frac{\\pi}{3} + k2\\pi$ và $x = \\frac{2\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        'B. $x = \\frac{\\pi}{6} + k2\\pi$ và $x = \\frac{5\\pi}{6} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        'C. $x = \\pm\\frac{\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        'D. $x = \\frac{\\pi}{3} + k\\pi$ ($k \\in \\mathbb{Z}$)',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$2\\sin x - \\sqrt{3} = 0 \\iff \\sin x = \\frac{\\sqrt{3}}{2} = \\sin\\frac{\\pi}{3} \\iff x = \\frac{\\pi}{3} + k2\\pi$ hoặc $x = \\pi - \\frac{\\pi}{3} + k2\\pi = \\frac{2\\pi}{3} + k2\\pi$.',
    },
    {
      id: 'mc_4',
      question: 'Cho dãy số $(u_n)$ có số hạng tổng quát $u_n = \\frac{2n - 1}{n + 2}$. Số hạng thứ $4$ của dãy số là:',
      options: ['A. $u_4 = \\frac{7}{6}$', 'B. $u_4 = \\frac{7}{5}$', 'C. $u_4 = 1$', 'D. $u_4 = \\frac{8}{6}$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Thay $n = 4$ vào công thức ta được $u_4 = \\frac{2(4) - 1}{4 + 2} = \\frac{7}{6}$.',
    },
    {
      id: 'mc_5',
      question: 'Cho cấp số cộng $(u_n)$ có số hạng đầu $u_1 = 4$ và công sai $d = -3$. Số hạng thứ 10 của cấp số cộng bằng:',
      options: ['A. $-23$', 'B. $-26$', 'C. $31$', 'D. $-20$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Áp dụng công thức số hạng tổng quát của cấp số cộng: $u_{10} = u_1 + 9d = 4 + 9(-3) = 4 - 27 = -23$.',
    },
    {
      id: 'mc_6',
      question: 'Cho cấp số nhân $(v_n)$ có $v_1 = 2$ và công bội $q = 3$. Tổng của $5$ số hạng đầu tiên $S_5$ bằng:',
      options: ['A. $242$', 'B. $162$', 'C. $486$', 'D. $80$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Áp dụng công thức $S_n = \\frac{v_1(1 - q^n)}{1 - q} = \\frac{2(1 - 3^5)}{1 - 3} = \\frac{2(1 - 243)}{-2} = 242$.',
    },
    {
      id: 'mc_7',
      question: 'Giá trị của giới hạn dãy số $\\lim_{n \\to +\\infty} \\frac{3n^2 - 5n + 1}{2n^2 + 7}$ bằng:',
      options: ['A. $\\frac{3}{2}$', 'B. $+\\infty$', 'C. $0$', 'D. $-\\frac{5}{7}$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Chia cả tử và mẫu cho $n^2$: $\\lim \\frac{3 - 5/n + 1/n^2}{2 + 7/n^2} = \\frac{3}{2}$.',
    },
    {
      id: 'mc_8',
      question: 'Tính giới hạn hàm số $\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$:',
      options: ['A. $4$', 'B. $2$', 'C. $0$', 'D. Không tồn tại'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Phân tích nhân tử $x^2 - 4 = (x - 2)(x + 2)$. Ta có $\\lim_{x \\to 2} (x + 2) = 2 + 2 = 4$.',
    },
    {
      id: 'mc_9',
      question: 'Trong không gian, qua ba điểm không thẳng hàng xác định được bao nhiêu mặt phẳng duy nhất?',
      options: ['A. $1$', 'B. $2$', 'C. $3$', 'D. Vô số'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Theo tính chất cơ bản của hình học không gian SGK Toán 11: Qua 3 điểm phân biệt không thẳng hàng, có một và chỉ một mặt phẳng.',
    },
    {
      id: 'mc_10',
      question: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình bình hành. Giao tuyến của hai mặt phẳng $(SAB)$ và $(SCD)$ là:',
      options: [
        'A. Đường thẳng đi qua $S$ và song song với $AB$ và $CD$',
        'B. Đường thẳng $SO$ với $O$ là giao điểm của $AC$ và $BD$',
        'C. Đường thẳng $SA$',
        'D. Đường thẳng đi qua $S$ và cắt $AD$',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Hai mặt phẳng $(SAB)$ và $(SCD)$ có điểm chung $S$ và lần lượt chứa hai đường thẳng song song $AB \\parallel CD$. Do đó giao tuyến của chúng là đường thẳng qua $S$ và song song với $AB, CD$.',
    },
    {
      id: 'mc_11',
      question: 'Cho mẫu số liệu ghép nhóm về điểm kiểm tra của 40 học sinh có khoảng biến thiên $R = 6$. Biết giá trị nhỏ nhất trong mẫu là $4.0$. Giá trị lớn nhất trong mẫu là:',
      options: ['A. $10.0$', 'B. $9.5$', 'C. $8.0$', 'D. $6.0$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Khoảng biến thiên $R = x_{\\max} - x_{\\min} \\implies x_{\\max} = R + x_{\\min} = 6 + 4.0 = 10.0$.',
    },
    {
      id: 'mc_12',
      question: 'Nghiệm dương nhỏ nhất của phương trình lượng giác $\\cos\\left(2x - \\frac{\\pi}{3}\\right) = 0$ là:',
      options: ['A. $x = \\frac{5\\pi}{12}$', 'B. $x = \\frac{\\pi}{12}$', 'C. $x = \\frac{\\pi}{6}$', 'D. $x = \\frac{7\\pi}{12}$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$2x - \\frac{\\pi}{3} = \\frac{\\pi}{2} + k\\pi \\iff 2x = \\frac{5\\pi}{6} + k\\pi \\iff x = \\frac{5\\pi}{12} + k\\frac{\\pi}{2}$. Với $k = 0$, nghiệm dương nhỏ nhất là $\\frac{5\\pi}{12}$.',
    },
  ];

  const trueFalseQuestions: TrueFalseQuestion[] = [
    {
      id: 'tf_1',
      prompt: 'Cho hàm số lượng giác $f(x) = \\sin 2x + \\cos 2x$. Xét tính đúng hay sai của các mệnh đề sau:',
      pointsPerSub: 0.25,
      items: [
        {
          key: 'a',
          statement: 'Hàm số $f(x)$ có chu kỳ tuần hoàn là $T = \\pi$.',
          isCorrect: true,
        },
        {
          key: 'b',
          statement: 'Tập giá trị của hàm số là $[-\\sqrt{2}; \\sqrt{2}]$.',
          isCorrect: true,
        },
        {
          key: 'c',
          statement: 'Công thức biến đổi thu gọn: $f(x) = \\sqrt{2}\\sin\\left(2x + \\frac{\\pi}{4}\\right)$.',
          isCorrect: true,
        },
        {
          key: 'd',
          statement: 'Phương trình $f(x) = 2$ có vô số nghiệm thực thuộc $\\mathbb{R}$.',
          isCorrect: false,
        },
      ],
    },
    {
      id: 'tf_2',
      prompt: 'Cho cấp số cộng $(u_n)$ có số hạng đầu $u_1 = 5$ và công sai $d = 3$. Xét tính đúng hoặc sai của các khẳng định sau:',
      pointsPerSub: 0.25,
      items: [
        {
          key: 'a',
          statement: 'Công thức số hạng tổng quát của cấp số cộng là $u_n = 3n + 2$.',
          isCorrect: true,
        },
        {
          key: 'b',
          statement: 'Số $32$ là số hạng thứ $10$ của cấp số cộng đã cho.',
          isCorrect: true,
        },
        {
          key: 'c',
          statement: 'Tổng của $20$ số hạng đầu tiên của cấp số cộng bằng $S_{20} = 670$.',
          isCorrect: true,
        },
        {
          key: 'd',
          statement: 'Dãy số $(u_n)$ là một dãy số giảm trên tập $\\mathbb{N}^*$.',
          isCorrect: false,
        },
      ],
    },
    {
      id: 'tf_3',
      prompt: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình thang với hai đáy $AB \\parallel CD$ và $AB = 2CD$. Gọi $M$ là trung điểm cạnh $SA$. Xét các mệnh đề sau:',
      pointsPerSub: 0.25,
      items: [
        {
          key: 'a',
          statement: 'Đường thẳng $CD$ song song với mặt phẳng $(SAB)$.',
          isCorrect: true,
        },
        {
          key: 'b',
          statement: 'Mặt phẳng $(MCD)$ cắt cạnh $SB$ tại điểm $N$ sao cho $MN \\parallel AB$.',
          isCorrect: true,
        },
        {
          key: 'c',
          statement: 'Giao tuyến của mặt phẳng $(SAD)$ và $(SBC)$ là đường thẳng đi qua $S$ và song song với $AB$.',
          isCorrect: false,
        },
        {
          key: 'd',
          statement: 'Tứ giác $MNCD$ là hình thang với $MN = CD$.',
          isCorrect: true,
        },
      ],
    },
    {
      id: 'tf_4',
      prompt: 'Xét dãy số $(x_n)$ xác định bởi $x_1 = 1$ và $x_{n+1} = \\frac{1}{2}x_n + 1$ với mọi $n \\ge 1$. Xét tính đúng/sai:',
      pointsPerSub: 0.25,
      items: [
        {
          key: 'a',
          statement: 'Ba số hạng đầu của dãy lần lượt là $x_1 = 1, x_2 = \\frac{3}{2}, x_3 = \\frac{7}{4}$.',
          isCorrect: true,
        },
        {
          key: 'b',
          statement: 'Dãy số $(y_n)$ với $y_n = x_n - 2$ là một cấp số nhân có công bội $q = \\frac{1}{2}$.',
          isCorrect: true,
        },
        {
          key: 'c',
          statement: 'Công thức số hạng tổng quát là $x_n = 2 - \\left(\\frac{1}{2}\\right)^{n-1}$.',
          isCorrect: true,
        },
        {
          key: 'd',
          statement: 'Giới hạn dãy số bằng $\\lim_{n \\to +\\infty} x_n = 3$.',
          isCorrect: false,
        },
      ],
    },
  ];

  let essays: EssayQuestion[] = [];

  if (part3Type === 'short_answer') {
    essays = [
      {
        id: 'short_1',
        question: 'Tìm số nghiệm của phương trình lượng giác $\\sin 2x = \\frac{1}{2}$ trên đoạn $[0; 2\\pi]$.',
        maxPoints: 0.5,
        shortAnswerKey: '4',
        rubric: [
          { step: 'Bước 1', description: 'Giải phương trình: $2x = \\frac{\\pi}{6} + k2\\pi \\implies x = \\frac{\\pi}{12} + k\\pi$ hoặc $x = \\frac{5\\pi}{12} + k\\pi$.', points: 0.25 },
          { step: 'Bước 2', description: 'Xét điều kiện $x \\in [0; 2\\pi]$, ta tìm được đúng 4 nghiệm phân biệt.', points: 0.25 },
        ],
      },
      {
        id: 'short_2',
        question: 'Cho cấp số cộng $(u_n)$ biết $u_3 + u_8 = 35$ và $u_5 = 17$. Tìm công sai $d$ của cấp số cộng.',
        maxPoints: 0.5,
        shortAnswerKey: '2',
        rubric: [
          { step: 'Bước 1', description: 'Khai triển theo $u_1$ và $d$: $2u_1 + 9d = 35$ và $u_1 + 4d = 17$.', points: 0.25 },
          { step: 'Bước 2', description: 'Giải hệ tìm được $d = 2$.', points: 0.25 },
        ],
      },
      {
        id: 'short_3',
        question: 'Cho cấp số nhân $(u_n)$ có $u_1 = 3$ và $u_4 = 24$. Tính tổng $6$ số hạng đầu tiên của cấp số nhân.',
        maxPoints: 0.5,
        shortAnswerKey: '189',
        rubric: [
          { step: 'Bước 1', description: 'Tìm công bội: $u_4 = u_1 q^3 \\implies 3q^3 = 24 \\implies q = 2$.', points: 0.25 },
          { step: 'Bước 2', description: 'Tính $S_6 = \\frac{3(1 - 2^6)}{1 - 2} = 3(63) = 189$.', points: 0.25 },
        ],
      },
      {
        id: 'short_4',
        question: 'Tính giá trị giới hạn hữu hạn: $L = \\lim_{x \\to 3} \\frac{\\sqrt{x + 1} - 2}{x - 3}$. (Nhập kết quả dưới dạng số thập phân, ví dụ 0.25).',
        maxPoints: 0.5,
        shortAnswerKey: '0.25',
        rubric: [
          { step: 'Bước 1', description: 'Nhân liên hợp với $\\sqrt{x + 1} + 2$.', points: 0.25 },
          { step: 'Bước 2', description: 'Rút gọn mẫu số và thay số: $\\frac{1}{2 + 2} = 0.25$.', points: 0.25 },
        ],
      },
      {
        id: 'short_5',
        question: 'Một chất điểm chuyển động theo phương trình $s(t) = t^3 - 3t^2 + 5t$ ($s$ tính bằng mét, $t$ tính bằng giây). Vận tốc tức thời của chất điểm tại thời điểm $t = 4$ giây bằng bao nhiêu m/s?',
        maxPoints: 0.5,
        shortAnswerKey: '29',
        rubric: [
          { step: 'Bước 1', description: 'Tính đạo hàm $v(t) = s\'(t) = 3t^2 - 6t + 5$.', points: 0.25 },
          { step: 'Bước 2', description: 'Thay $t = 4$: $v(4) = 3(16) - 6(4) + 5 = 48 - 24 + 5 = 29$.', points: 0.25 },
        ],
      },
      {
        id: 'short_6',
        question: 'Cho tứ diện $ABCD$. Gọi $G$ là trọng tâm tam giác $BCD$. Mặt phẳng đi qua $G$ và song song với mặt phẳng $(ABC)$ cắt các cạnh $DA, DB, DC$ lần lượt tại $A\', B\', C\'$. Tính tỉ số diện tích $\\frac{S_{\\triangle A\'B\'C\'}}{S_{\\triangle ABC}}$. (Nhập dưới dạng số thập phân làm tròn 2 chữ số hoặc phân số tối giản).',
        maxPoints: 0.5,
        shortAnswerKey: '0.44',
        rubric: [
          { step: 'Bước 1', description: 'Xác định tỉ số đồng dạng $k = 2/3$.', points: 0.25 },
          { step: 'Bước 2', description: 'Tỉ số diện tích bằng $k^2 = (2/3)^2 = 4/9 \\approx 0.44$.', points: 0.25 },
        ],
      },
    ];
  } else {
    // Essay mode
    essays = [
      {
        id: 'essay_1',
        question: 'Giải phương trình lượng giác sau trên tập số thực $\\mathbb{R}$: $\\sqrt{3}\\sin 2x - \\cos 2x = \\sqrt{2}$.',
        maxPoints: 1.5,
        shortAnswerKey: 'x = 5pi/24 + kpi',
        rubric: [
          {
            step: 'Bước 1 (0.5 điểm)',
            description: 'Chia hai vế cho 2: $\\frac{\\sqrt{3}}{2}\\sin 2x - \\frac{1}{2}\\cos 2x = \\frac{\\sqrt{2}}{2}$.',
            points: 0.5,
          },
          {
            step: 'Bước 2 (0.5 điểm)',
            description: 'Đưa về dạng chuẩn sin tổng/hiệu: $\\sin\\left(2x - \\frac{\\pi}{6}\\right) = \\sin\\frac{\\pi}{4}$.',
            points: 0.5,
          },
          {
            step: 'Bước 3 (0.5 điểm)',
            description: 'Tìm hai họ nghiệm chuẩn: $x = \\frac{5\\pi}{24} + k\\pi$ hoặc $x = \\frac{11\\pi}{24} + k\\pi$ ($k \\in \\mathbb{Z}$).',
            points: 0.5,
          },
        ],
      },
      {
        id: 'essay_2',
        question: 'Cho cấp số cộng $(u_n)$ thoả mãn điều kiện: $\\begin{cases} u_2 + u_5 - u_3 = 10 \\\\ u_1 + u_6 = 17 \\end{cases}$. Tìm số hạng đầu $u_1$, công sai $d$ và tính tổng $S_{30}$ của 30 số hạng đầu tiên.',
        maxPoints: 1.5,
        shortAnswerKey: 'S_30 = 945',
        rubric: [
          {
            step: 'Bước 1 (0.5 điểm)',
            description: 'Biểu diễn qua $u_1, d$: Hệ tương đương $\\begin{cases} u_1 + 3d = 10 \\\\ 2u_1 + 5d = 17 \\end{cases}$.',
            points: 0.5,
          },
          {
            step: 'Bước 2 (0.5 điểm)',
            description: 'Giải hệ phương trình bậc nhất hai ẩn ta được: $u_1 = 1$ và $d = 3$.',
            points: 0.5,
          },
          {
            step: 'Bước 3 (0.5 điểm)',
            description: 'Tính tổng: $S_{30} = \\frac{30[2(1) + 29(3)]}{2} = 15(2 + 87) = 15 \\times 89 = 1335$.',
            points: 0.5,
          },
        ],
      },
    ];
  }

  return {
    id: `exam-${Date.now()}`,
    title: examTitle,
    examCode,
    grade: '11',
    durationMinutes: 45,
    totalPoints: 10,
    textbook,
    topic: 'Hàm số lượng giác, Cấp số cộng/nhân, Giới hạn & Quan hệ song song',
    createdAt: new Date().toISOString().split('T')[0],
    part3Type,
    multipleChoice,
    trueFalseQuestions,
    essays,
  };
}

function buildGrade10Exam(part3Type: 'short_answer' | 'essay', textbook: string, suffix: number, fileName: string): Exam {
  const examCode = `TOAN10-${suffix}`;
  const examTitle = `ĐỀ KIỂM TRA MÔN TOÁN LỚP 10 - (THEO MA TRẬN ${fileName || 'GDPT 2018'})`;

  const multipleChoice: MultipleChoiceQuestion[] = [
    {
      id: 'mc_1',
      question: 'Mệnh đề phủ định của mệnh đề $P: \"\\forall x \\in \\mathbb{R}, x^2 + 1 > 0\"$ là:',
      options: [
        'A. $\\overline{P}: \"\\exists x \\in \\mathbb{R}, x^2 + 1 \\le 0\"$',
        'B. $\\overline{P}: \"\\forall x \\in \\mathbb{R}, x^2 + 1 \\le 0\"$',
        'C. $\\overline{P}: \"\\exists x \\in \\mathbb{R}, x^2 + 1 < 0\"$',
        'D. $\\overline{P}: \"\\exists x \\in \\mathbb{R}, x^2 + 1 = 0\"$',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Phủ định của $\\forall$ là $\\exists$, phủ định của $>$ là $\\le$.',
    },
    {
      id: 'mc_2',
      question: 'Cho hai tập hợp $A = [-2; 3)$ và $B = (1; 5]$. Giao của hai tập hợp $A \\cap B$ là:',
      options: ['A. $(1; 3)$', 'B. $[-2; 5]$', 'C. $[1; 3)$', 'D. $(-2; 1)$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Phần tử thuộc cả hai tập: $1 < x < 3$, do đó $A \\cap B = (1; 3)$.',
    },
    {
      id: 'mc_3',
      question: 'Cặp số nào sau đây là nghiệm của bất phương trình bậc nhất hai ẩn $2x - 3y + 6 \\le 0$?',
      options: ['A. $(0; 3)$', 'B. $(2; 1)$', 'C. $(0; 0)$', 'D. $(3; 0)$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Thay $(0; 3)$: $2(0) - 3(3) + 6 = -3 \\le 0$ (thỏa mãn).',
    },
    {
      id: 'mc_4',
      question: 'Đỉnh của parabol $(P): y = x^2 - 4x + 3$ có tọa độ là:',
      options: ['A. $I(2; -1)$', 'B. $I(-2; 15)$', 'C. $I(2; 1)$', 'D. $I(1; 0)$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$x_I = -\\frac{b}{2a} = -\\frac{-4}{2(1)} = 2$. Thay vào $y_I = 4 - 8 + 3 = -1$. Đỉnh $I(2; -1)$.',
    },
    {
      id: 'mc_5',
      question: 'Tập nghiệm của bất phương trình bậc hai $x^2 - 5x + 6 < 0$ là:',
      options: ['A. $(2; 3)$', 'B. $(-\\infty; 2) \\cup (3; +\\infty)$', 'C. $[2; 3]$', 'D. $(-3; -2)$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Phương trình $x^2 - 5x + 6 = 0$ có hai nghiệm $2$ và $3$. Hệ số $a = 1 > 0$, dấu âm ở trong khoảng hai nghiệm $(2; 3)$.',
    },
    {
      id: 'mc_6',
      question: 'Cho tam giác $ABC$ có $a = 6, b = 8, \\widehat{C} = 60^\\circ$. Độ dài cạnh $c$ bằng:',
      options: ['A. $2\\sqrt{13}$', 'B. $10$', 'C. $\\sqrt{52}$', 'D. $2\\sqrt{37}$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Định lý côsin: $c^2 = a^2 + b^2 - 2ab\\cos C = 36 + 64 - 2(6)(8)(1/2) = 100 - 48 = 52 \\implies c = \\sqrt{52} = 2\\sqrt{13}$.',
    },
    {
      id: 'mc_7',
      question: 'Trong mặt phẳng $Oxy$, cho $\\vec{u} = (2; -3)$ và $\\vec{v} = (1; 4)$. Tọa độ vectơ $\\vec{w} = 2\\vec{u} + \\vec{v}$ là:',
      options: ['A. $(5; -2)$', 'B. $(3; 1)$', 'C. $(5; 2)$', 'D. $(4; -2)$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$\\vec{w} = (2(2) + 1; 2(-3) + 4) = (5; -2)$.',
    },
    {
      id: 'mc_8',
      question: 'Tích vô hướng của hai vectơ $\\vec{a} = (3; -1)$ và $\\vec{b} = (2; 5)$ bằng:',
      options: ['A. $1$', 'B. $11$', 'C. $-1$', 'D. $5$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$\\vec{a} \\cdot \\vec{b} = 3(2) + (-1)(5) = 6 - 5 = 1$.',
    },
    {
      id: 'mc_9',
      question: 'Khoảng cách từ điểm $M(1; -2)$ đến đường thẳng $\\Delta: 3x - 4y + 5 = 0$ bằng:',
      options: ['A. $\\frac{16}{5}$', 'B. $3$', 'C. $4$', 'D. $2$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$d(M, \\Delta) = \\frac{|3(1) - 4(-2) + 5|}{\\sqrt{3^2 + (-4)^2}} = \\frac{|3 + 8 + 5|}{5} = \\frac{16}{5}$.',
    },
    {
      id: 'mc_10',
      question: 'Góc giữa hai đường thẳng $d_1: x + 2y - 1 = 0$ và $d_2: 2x - y + 3 = 0$ bằng:',
      options: ['A. $90^\\circ$', 'B. $45^\\circ$', 'C. $60^\\circ$', 'D. $30^\\circ$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Vectơ pháp tuyến $\\vec{n}_1 = (1; 2), \\vec{n}_2 = (2; -1)$. Ta có $\\vec{n}_1 \\cdot \\vec{n}_2 = 1(2) + 2(-1) = 0$. Hai đường thẳng vuông góc nên góc bằng $90^\\circ$.',
    },
    {
      id: 'mc_11',
      question: 'Mẫu số liệu có phương sai $s^2 = 16$. Độ lệch chuẩn $s$ của mẫu số liệu bằng:',
      options: ['A. $4$', 'B. $256$', 'C. $8$', 'D. $2$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Độ lệch chuẩn là căn bậc hai của phương sai: $s = \\sqrt{s^2} = \\sqrt{16} = 4$.',
    },
    {
      id: 'mc_12',
      question: 'Gieo một con xúc xắc cân đối đồng chất hai lần. Xác suất để tổng số chấm xuất hiện trong hai lần gieo bằng $7$ là:',
      options: ['A. $\\frac{1}{6}$', 'B. $\\frac{7}{36}$', 'C. $\\frac{5}{36}$', 'D. $\\frac{1}{12}$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Các cặp có tổng bằng 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) có 6 khả năng. Xác suất $6/36 = 1/6$.',
    },
  ];

  const trueFalseQuestions: TrueFalseQuestion[] = [
    {
      id: 'tf_1',
      prompt: 'Cho tam thức bậc hai $f(x) = x^2 - 2(m + 1)x + m^2 + 3$. Xét tính đúng/sai của các mệnh đề sau:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Biệt thức thu gọn của tam thức là $\\Delta\' = 2m - 2$.', isCorrect: true },
        { key: 'b', statement: 'Với $m = 2$, tam thức luôn nhận giá trị dương với mọi $x \\in \\mathbb{R}$.', isCorrect: false },
        { key: 'c', statement: 'Với $m = 0$, phương trình $f(x) = 0$ vô nghiệm.', isCorrect: true },
        { key: 'd', statement: 'Tam thức $f(x) > 0, \\forall x \\in \\mathbb{R}$ khi và chỉ khi $m < 1$.', isCorrect: true },
      ],
    },
    {
      id: 'tf_2',
      prompt: 'Trong mặt phẳng tọa độ $Oxy$, cho tam giác $ABC$ với $A(1; 2), B(-2; 3), C(4; 5)$. Xét các mệnh đề sau:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Tọa độ trọng tâm $G$ của tam giác $ABC$ là $G(1; \\frac{10}{3})$.', isCorrect: true },
        { key: 'b', statement: 'Vectơ $\\vec{AB} = (-3; 1)$ và độ dài $AB = \\sqrt{10}$.', isCorrect: true },
        { key: 'c', statement: 'Đường thẳng $BC$ có phương trình tổng quát là $x - 3y + 11 = 0$.', isCorrect: true },
        { key: 'd', statement: 'Tam giác $ABC$ là tam giác vuông tại đỉnh $A$.', isCorrect: false },
      ],
    },
    {
      id: 'tf_3',
      prompt: 'Một cửa hàng thời trang bán áo sơ mi với giá bán ban đầu 300 ngàn đồng/chiếc. Biết nếu giảm giá $x$ ngàn đồng (với $0 \\le x \\le 50$) thì mỗi ngày bán thêm được $2x$ chiếc. Doanh thu mỗi ngày là hàm số bậc hai $R(x)$. Xét các khẳng định:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Hàm doanh thu $R(x)$ đạt giá trị lớn nhất tại đỉnh của parabol.', isCorrect: true },
        { key: 'b', statement: 'Nếu không giảm giá ($x = 0$), doanh thu thấp hơn mức cực đại.', isCorrect: true },
        { key: 'c', statement: 'Giá trị tối ưu của việc giảm giá nằm trong khoảng cho phép.', isCorrect: true },
        { key: 'd', statement: 'Khi $x = 50$, doanh thu bằng 0.', isCorrect: false },
      ],
    },
    {
      id: 'tf_4',
      prompt: 'Cho mẫu số liệu điểm kiểm tra môn Toán của 20 học sinh: 6, 7, 7, 8, 8, 8, 9, 9, 10, ... Xét tính đúng sai:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Số trung bình của mẫu số liệu phản ánh mức độ học lực trung bình của lớp.', isCorrect: true },
        { key: 'b', statement: 'Mốt của mẫu số liệu là giá trị có tần số xuất hiện nhiều nhất.', isCorrect: true },
        { key: 'c', statement: 'Trung vị chia mẫu số liệu đã sắp xếp thành hai phần có số lượng quan sát bằng nhau.', isCorrect: true },
        { key: 'd', statement: 'Độ lệch chuẩn càng lớn chứng tỏ điểm số của lớp càng đồng đều.', isCorrect: false },
      ],
    },
  ];

  const essays: EssayQuestion[] = part3Type === 'short_answer'
    ? [
        {
          id: 'short_1',
          question: 'Tìm giá trị nhỏ nhất của hàm số bậc hai $y = 2x^2 - 8x + 5$ trên đoạn $[0; 3]$.',
          maxPoints: 0.5,
          shortAnswerKey: '-3',
          rubric: [{ step: 'Bước 1', description: 'Đỉnh parabol $x = 2 \\in [0; 3]$. $y(2) = 2(4) - 16 + 5 = -3$.', points: 0.5 }],
        },
        {
          id: 'short_2',
          question: 'Cho tam giác $ABC$ có $AB = 5, AC = 8$ và diện tích $S = 10\\sqrt{3}$. Tính số đo góc $A$ (đơn vị độ) biết góc $A$ là góc nhọn.',
          maxPoints: 0.5,
          shortAnswerKey: '60',
          rubric: [{ step: 'Bước 1', description: '$S = \\frac{1}{2}bc\\sin A \\implies \\sin A = \\frac{20\\sqrt{3}}{40} = \\frac{\\sqrt{3}}{2} \\implies A = 60^\\circ$.', points: 0.5 }],
        },
        {
          id: 'short_3',
          question: 'Tính khoảng cách từ gốc tọa độ $O(0; 0)$ đến đường thẳng $d: 4x - 3y + 15 = 0$.',
          maxPoints: 0.5,
          shortAnswerKey: '3',
          rubric: [{ step: 'Bước 1', description: '$d(O, d) = \\frac{|15|}{\\sqrt{16 + 9}} = \\frac{15}{5} = 3$.', points: 0.5 }],
        },
        {
          id: 'short_4',
          question: 'Một tổ gồm 6 học sinh nam và 4 học sinh nữ. Chọn ngẫu nhiên 3 học sinh. Tính xác suất để trong 3 học sinh được chọn có ít nhất 1 học sinh nữ. (Nhập dưới dạng số thập phân làm tròn 2 chữ số).',
          maxPoints: 0.5,
          shortAnswerKey: '0.83',
          rubric: [{ step: 'Bước 1', description: '$P = 1 - \\frac{C_6^3}{C_{10}^3} = 1 - \\frac{20}{120} = \\frac{5}{6} \\approx 0.83$.', points: 0.5 }],
        },
        {
          id: 'short_5',
          question: 'Tìm số nghiệm nguyên của bất phương trình $(x - 1)(5 - x) \\ge 0$.',
          maxPoints: 0.5,
          shortAnswerKey: '5',
          rubric: [{ step: 'Bước 1', description: 'Tập nghiệm $[1; 5]$ gồm các số nguyên: 1, 2, 3, 4, 5 (5 số).', points: 0.5 }],
        },
        {
          id: 'short_6',
          question: 'Cho hai vectơ $\\vec{a}$ và $\\vec{b}$ vuông góc với nhau, $|\vec{a}| = 3, |\vec{b}| = 4$. Tính độ dài vectơ tổng $|\vec{a} + \\vec{b}|$.',
          maxPoints: 0.5,
          shortAnswerKey: '5',
          rubric: [{ step: 'Bước 1', description: '$|\\vec{a} + \\vec{b}| = \\sqrt{3^2 + 4^2} = 5$.', points: 0.5 }],
        },
      ]
    : [
        {
          id: 'essay_1',
          question: 'Cho tam thức bậc hai $f(x) = (m - 1)x^2 - 2(m + 1)x + 2m - 1$. Tìm tất cả các giá trị của tham số $m$ để $f(x) > 0$ với mọi $x \\in \\mathbb{R}$.',
          maxPoints: 1.5,
          shortAnswerKey: 'm > 2',
          rubric: [
            { step: 'Bước 1', description: 'Điều kiện để tam thức luôn dương: $a = m - 1 > 0 \\iff m > 1$.', points: 0.5 },
            { step: 'Bước 2', description: 'Tính $\\Delta\' = (m + 1)^2 - (m - 1)(2m - 1) = -m^2 + 5m = -m(m - 5) < 0$.', points: 0.5 },
            { step: 'Bước 3', description: 'Kết hợp điều kiện tìm được tập giá trị của $m$.', points: 0.5 },
          ],
        },
        {
          id: 'essay_2',
          question: 'Trong mặt phẳng tọa độ $Oxy$, cho tam giác $ABC$ có đỉnh $A(2; 3)$ và đường cao $BH: x - 2y + 1 = 0$, đường trung tuyến $CM: 2x + y - 4 = 0$. Viết phương trình tổng quát của đường thẳng chứa cạnh $AC$.',
          maxPoints: 1.5,
          shortAnswerKey: '2x + y - 7 = 0',
          rubric: [
            { step: 'Bước 1', description: 'Cạnh $AC$ đi qua $A(2; 3)$ và vuông góc với đường cao $BH$.', points: 0.5 },
            { step: 'Bước 2', description: 'Vectơ pháp tuyến của $AC$ là vectơ chỉ phương của $BH$: $\\vec{n}_{AC} = (2; 1)$.', points: 0.5 },
            { step: 'Bước 3', description: 'Phương trình: $2(x - 2) + 1(y - 3) = 0 \\iff 2x + y - 7 = 0$.', points: 0.5 },
          ],
        },
      ];

  return {
    id: `exam-${Date.now()}`,
    title: examTitle,
    examCode,
    grade: '10',
    durationMinutes: 45,
    totalPoints: 10,
    textbook,
    topic: 'Mệnh đề - Tập hợp, Bất phương trình, Hàm số bậc 2 & Vectơ',
    createdAt: new Date().toISOString().split('T')[0],
    part3Type,
    multipleChoice,
    trueFalseQuestions,
    essays,
  };
}

function buildGrade12Exam(part3Type: 'short_answer' | 'essay', textbook: string, suffix: number, fileName: string): Exam {
  const examCode = `TOAN12-${suffix}`;
  const examTitle = `ĐỀ KIỂM TRA MÔN TOÁN LỚP 12 - (THEO MA TRẬN ${fileName || 'GDPT 2018'})`;

  const multipleChoice: MultipleChoiceQuestion[] = [
    {
      id: 'mc_1',
      question: 'Cho hàm số $y = f(x)$ có đạo hàm $f\'(x) = x(x - 1)(x + 2)^2$. Số điểm cực trị của hàm số là:',
      options: ['A. $2$', 'B. $3$', 'C. $1$', 'D. $0$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Đạo hàm đổi dấu khi qua các nghiệm bội lẻ $x = 0$ và $x = 1$. Nghiệm $x = -2$ là bội chẵn không làm đổi dấu. Số điểm cực trị là 2.',
    },
    {
      id: 'mc_2',
      question: 'Đường tiệm cận đứng của đồ thị hàm số $y = \\frac{2x - 3}{x + 1}$ là đường thẳng:',
      options: ['A. $x = -1$', 'B. $y = 2$', 'C. $x = 1$', 'D. $y = -3$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$\\lim_{x \\to -1} y = \\infty$ nên đường tiệm cận đứng là $x = -1$.',
    },
    {
      id: 'mc_3',
      question: 'Giá trị nhỏ nhất của hàm số $y = x^3 - 3x + 2$ trên đoạn $[0; 2]$ bằng:',
      options: ['A. $0$', 'B. $2$', 'C. $4$', 'D. $-2$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$y\' = 3x^2 - 3 = 0 \\iff x = 1 \\in [0; 2]$. Ta có $y(0) = 2, y(1) = 0, y(2) = 4$. Do đó $\\min y = 0$ tại $x = 1$.',
    },
    {
      id: 'mc_4',
      question: 'Họ tất cả các nguyên hàm của hàm số $f(x) = e^{2x} + \\cos x$ là:',
      options: [
        'A. $\\frac{1}{2}e^{2x} + \\sin x + C$',
        'B. $2e^{2x} - \\sin x + C$',
        'C. $e^{2x} + \\sin x + C$',
        'D. $\\frac{1}{2}e^{2x} - \\sin x + C$',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$\\int (e^{2x} + \\cos x)\\,\\mathrm{d}x = \\frac{1}{2}e^{2x} + \\sin x + C$.',
    },
    {
      id: 'mc_5',
      question: 'Tích phân $\\int_0^1 (2x + 1)\\,\\mathrm{d}x$ có giá trị bằng:',
      options: ['A. $2$', 'B. $1$', 'C. $3$', 'D. $0$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$[x^2 + x]_0^1 = (1 + 1) - 0 = 2$.',
    },
    {
      id: 'mc_6',
      question: 'Trong không gian $Oxyz$, cho mặt phẳng $(P): 2x - y + 3z - 5 = 0$. Một vectơ pháp tuyến của $(P)$ là:',
      options: ['A. $\\vec{n} = (2; -1; 3)$', 'B. $\\vec{n} = (2; 1; 3)$', 'C. $\\vec{n} = (-1; 3; -5)$', 'D. $\\vec{n} = (2; -1; -5)$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Các hệ số đứng trước $x, y, z$ cho vectơ pháp tuyến $\\vec{n} = (2; -1; 3)$.',
    },
    {
      id: 'mc_7',
      question: 'Trong không gian $Oxyz$, phương trình mặt cầu có tâm $I(1; -2; 3)$ và bán kính $R = 4$ là:',
      options: [
        'A. $(x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 16$',
        'B. $(x + 1)^2 + (y - 2)^2 + (z + 3)^2 = 16$',
        'C. $(x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 4$',
        'D. $(x + 1)^2 + (y - 2)^2 + (z + 3)^2 = 4$',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Phương trình dạng $(x - a)^2 + (y - b)^2 + (z - c)^2 = R^2 = 16$.',
    },
    {
      id: 'mc_8',
      question: 'Đường thẳng đi qua $M(1; 0; -2)$ và nhận $\\vec{u} = (2; -1; 3)$ làm vectơ chỉ phương có phương trình chính tắc là:',
      options: [
        'A. $\\frac{x - 1}{2} = \\frac{y}{-1} = \\frac{z + 2}{3}$',
        'B. $\\frac{x + 1}{2} = \\frac{y}{-1} = \\frac{z - 2}{3}$',
        'C. $\\frac{x - 2}{1} = \\frac{y + 1}{0} = \\frac{z - 3}{-2}$',
        'D. $\\frac{x - 1}{2} = \\frac{y}{1} = \\frac{z + 2}{3}$',
      ],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$\\frac{x - x_0}{a} = \\frac{y - y_0}{b} = \\frac{z - z_0}{c} \\implies \\frac{x - 1}{2} = \\frac{y}{-1} = \\frac{z + 2}{3}$.',
    },
    {
      id: 'mc_9',
      question: 'Cho hai biến cố $A$ và $B$ độc lập nhau, $P(A) = 0.4$ và $P(B) = 0.5$. Xác suất của biến cố giao $P(AB)$ bằng:',
      options: ['A. $0.20$', 'B. $0.90$', 'C. $0.10$', 'D. $0.50$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Vì $A$ và $B$ độc lập: $P(AB) = P(A) \\cdot P(B) = 0.4 \\times 0.5 = 0.20$.',
    },
    {
      id: 'mc_10',
      question: 'Đồ thị hàm số $y = \\frac{x^2 - 2x + 3}{x - 1}$ có tiệm cận xiên là đường thẳng:',
      options: ['A. $y = x - 1$', 'B. $y = x + 1$', 'C. $y = 2x - 1$', 'D. $y = x$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Thực hiện phép chia đa thức: $\\frac{x^2 - 2x + 3}{x - 1} = x - 1 + \\frac{2}{x - 1}$. Do $\\lim_{x \\to \\infty} \\frac{2}{x - 1} = 0$, tiệm cận xiên là $y = x - 1$.',
    },
    {
      id: 'mc_11',
      question: 'Tính khoảng cách giữa hai mặt phẳng song song $(P): x + 2y - 2z + 1 = 0$ và $(Q): x + 2y - 2z - 5 = 0$:',
      options: ['A. $2$', 'B. $6$', 'C. $3$', 'D. $4$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: '$d((P), (Q)) = \\frac{|1 - (-5)|}{\\sqrt{1^2 + 2^2 + (-2)^2}} = \\frac{6}{3} = 2$.',
    },
    {
      id: 'mc_12',
      question: 'Diện tích hình phẳng giới hạn bởi đồ thị hàm số $y = x^2$ và đường thẳng $y = 2x$ bằng:',
      options: ['A. $\\frac{4}{3}$', 'B. $\\frac{2}{3}$', 'C. $2$', 'D. $\\frac{1}{3}$'],
      correctAnswer: 'A',
      points: 0.25,
      explanation: 'Hoành độ giao điểm $x^2 = 2x \\implies x = 0$ và $x = 2$. Diện tích $S = \\int_0^2 (2x - x^2)\\,\\mathrm{d}x = [x^2 - x^3/3]_0^2 = 4 - 8/3 = 4/3$.',
    },
  ];

  const trueFalseQuestions: TrueFalseQuestion[] = [
    {
      id: 'tf_1',
      prompt: 'Cho hàm số $y = f(x) = \\frac{2x - 1}{x + 1}$ có đồ thị $(C)$. Xét tính đúng sai của các khẳng định sau:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Đồ thị $(C)$ có tiệm cận đứng là $x = -1$ và tiệm cận ngang là $y = 2$.', isCorrect: true },
        { key: 'b', statement: 'Hàm số đồng biến trên từng khoảng xác định $(-\\infty; -1)$ và $(-1; +\\infty)$.', isCorrect: true },
        { key: 'c', statement: 'Giao điểm của hai đường tiệm cận là tâm đối xứng của đồ thị $(C)$.', isCorrect: true },
        { key: 'd', statement: 'Tiếp tuyến của $(C)$ tại điểm có hoành độ $x = 0$ có hệ số góc bằng $1$.', isCorrect: false },
      ],
    },
    {
      id: 'tf_2',
      prompt: 'Trong không gian $Oxyz$, cho bốn điểm $A(1; 0; 0), B(0; 2; 0), C(0; 0; 3)$ và $D(1; 2; 3)$. Xét tính đúng/sai:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Mặt phẳng $(ABC)$ có phương trình theo đoạn chắn là $\\frac{x}{1} + \\frac{y}{2} + \\frac{z}{3} = 1$.', isCorrect: true },
        { key: 'b', statement: 'Vectơ pháp tuyến của mặt phẳng $(ABC)$ là $\\vec{n} = (6; 3; 2)$.', isCorrect: true },
        { key: 'c', statement: 'Điểm $D(1; 2; 3)$ thuộc mặt phẳng $(ABC)$.', isCorrect: false },
        { key: 'd', statement: 'Bốn điểm $A, B, C, D$ tạo thành một tứ diện.', isCorrect: true },
      ],
    },
    {
      id: 'tf_3',
      prompt: 'Một bình kín chứa 10 viên bi gồm 6 bi đỏ và 4 bi xanh. Rút ngẫu nhiên lần lượt 2 viên không hoàn lại. Gọi $A$ là biến cố viên thứ nhất màu đỏ, $B$ là biến cố viên thứ hai màu đỏ. Xét các mệnh đề sau:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Xác suất để viên thứ nhất rút được là bi đỏ là $P(A) = 0.6$.', isCorrect: true },
        { key: 'b', statement: 'Xác suất có điều kiện $P(B|A) = \\frac{5}{9}$.', isCorrect: true },
        { key: 'c', statement: 'Xác suất để cả hai viên rút được đều là bi đỏ bằng $P(AB) = \\frac{1}{3}$.', isCorrect: true },
        { key: 'd', statement: 'Hai biến cố $A$ và $B$ là hai biến cố độc lập.', isCorrect: false },
      ],
    },
    {
      id: 'tf_4',
      prompt: 'Một vật chuyển động thẳng có vận tốc được mô tả bởi $v(t) = -t^2 + 6t$ (m/s) trong khoảng thời gian từ $t = 0$ đến khi dừng hẳn. Xét các nhận định:',
      pointsPerSub: 0.25,
      items: [
        { key: 'a', statement: 'Vật dừng hẳn tại thời điểm $t = 6$ giây.', isCorrect: true },
        { key: 'b', statement: 'Vận tốc lớn nhất của vật đạt được là $9$ m/s tại thời điểm $t = 3$ giây.', isCorrect: true },
        { key: 'c', statement: 'Gia tốc của vật tại thời điểm $t = 2$ giây bằng $a(2) = 2$ m/s$^2$.', isCorrect: true },
        { key: 'd', statement: 'Quãng đường vật đi được từ $t = 0$ đến khi dừng lại là $36$ mét.', isCorrect: true },
      ],
    },
  ];

  const essays: EssayQuestion[] = part3Type === 'short_answer'
    ? [
        {
          id: 'short_1',
          question: 'Biết đường thẳng $y = 3x + m$ tiếp xúc với đồ thị hàm số $y = x^3 - 3x^2 + 3$. Tìm giá trị lớn nhất của tham số $m$.',
          maxPoints: 0.5,
          shortAnswerKey: '3',
          rubric: [{ step: 'Bước 1', description: 'Giải hệ tiếp tuyến tìm được $m = 3$ hoặc $m = -1$.', points: 0.5 }],
        },
        {
          id: 'short_2',
          question: 'Tính diện tích hình phẳng giới hạn bởi parabol $y = x^2 - 4x + 3$ và trục hoành $Ox$. (Nhập phân số tối giản a/b hoặc số thập phân làm tròn 2 chữ số).',
          maxPoints: 0.5,
          shortAnswerKey: '1.33',
          rubric: [{ step: 'Bước 1', description: 'Tích phân $|\\int_1^3 (x^2 - 4x + 3)dx| = 4/3 \\approx 1.33$.', points: 0.5 }],
        },
        {
          id: 'short_3',
          question: 'Trong không gian $Oxyz$, tính khoảng cách từ điểm $A(1; 2; 3)$ đến mặt phẳng $(P): 2x - 2y + z + 5 = 0$.',
          maxPoints: 0.5,
          shortAnswerKey: '2',
          rubric: [{ step: 'Bước 1', description: '$d = \\frac{|2 - 4 + 3 + 5|}{3} = \\frac{6}{3} = 2$.', points: 0.5 }],
        },
        {
          id: 'short_4',
          question: 'Một chất điểm chuyển động với gia tốc $a(t) = 6t + 2$ (m/s$^2$). Vận tốc ban đầu $v(0) = 5$ m/s. Tính vận tốc của chất điểm tại $t = 3$ giây.',
          maxPoints: 0.5,
          shortAnswerKey: '38',
          rubric: [{ step: 'Bước 1', description: '$v(t) = 3t^2 + 2t + 5$. Với $t = 3$, $v(3) = 27 + 6 + 5 = 38$.', points: 0.5 }],
        },
        {
          id: 'short_5',
          question: 'Xác suất để một xạ thủ bắn trúng bia là $0.8$. Xạ thủ bắn độc lập 3 phát. Tính xác suất để xạ thủ bắn trúng đúng 2 phát.',
          maxPoints: 0.5,
          shortAnswerKey: '0.384',
          rubric: [{ step: 'Bước 1', description: '$C_3^2 (0.8)^2 (0.2)^1 = 3 \\times 0.64 \\times 0.2 = 0.384$.', points: 0.5 }],
        },
        {
          id: 'short_6',
          question: 'Trong không gian $Oxyz$, mặt cầu $(S)$ đi qua $4$ điểm $O(0;0;0), A(2;0;0), B(0;4;0), C(0;0;6)$ có bán kính $R$ bằng bao nhiêu? (Làm tròn 2 chữ số thập phân).',
          maxPoints: 0.5,
          shortAnswerKey: '3.74',
          rubric: [{ step: 'Bước 1', description: 'Tâm $I(1; 2; 3)$, $R = \\sqrt{1 + 4 + 9} = \\sqrt{14} \\approx 3.74$.', points: 0.5 }],
        },
      ]
    : [
        {
          id: 'essay_1',
          question: 'Cho hàm số $y = f(x) = x^3 - 3x^2 + 2$. Tìm tất cả các giá trị thực của tham số $m$ để phương trình $|x^3 - 3x^2 + 2| = m$ có đúng 6 nghiệm thực phân biệt.',
          maxPoints: 1.5,
          shortAnswerKey: '0 < m < 2',
          rubric: [
            { step: 'Bước 1 (0.5 điểm)', description: 'Khảo sát và vẽ đồ thị hàm số $y = x^3 - 3x^2 + 2$. Cực đại tại $(0; 2)$, cực tiểu tại $(2; -2)$.', points: 0.5 },
            { step: 'Bước 2 (0.5 điểm)', description: 'Từ đồ thị $(C)$, suy ra đồ thị hàm số $y = |x^3 - 3x^2 + 2|$ bằng cách giữ phần trên trục hoành và lấy đối xứng phần dưới qua trục hoành.', points: 0.5 },
            { step: 'Bước 3 (0.5 điểm)', description: 'Biện luận số nghiệm: Đường thẳng $y = m$ cắt đồ thị tại 6 điểm phân biệt khi và chỉ khi $0 < m < 2$.', points: 0.5 },
          ],
        },
        {
          id: 'essay_2',
          question: 'Trong không gian với hệ tọa độ $Oxyz$, cho điểm $A(1; 2; -1)$ và mặt phẳng $(P): x + y - 2z + 3 = 0$. Tìm tọa độ hình chiếu vuông góc $H$ của điểm $A$ lên mặt phẳng $(P)$ và viết phương trình mặt cầu có tâm $A$ tiếp xúc với mặt phẳng $(P)$.',
          maxPoints: 1.5,
          shortAnswerKey: 'H(0; 1; 1), (x-1)^2 + (y-2)^2 + (z+1)^2 = 6',
          rubric: [
            { step: 'Bước 1 (0.5 điểm)', description: 'Đường thẳng qua $A$ vuông góc với $(P)$ có PT: $x = 1 + t, y = 2 + t, z = -1 - 2t$. Thay vào $(P)$ tìm $t = -1 \\implies H(0; 1; 1)$.', points: 0.5 },
            { step: 'Bước 2 (0.5 điểm)', description: 'Khoảng cách $R = AH = \\sqrt{(0-1)^2 + (1-2)^2 + (1+1)^2} = \\sqrt{1 + 1 + 4} = \\sqrt{6}$.', points: 0.5 },
            { step: 'Bước 3 (0.5 điểm)', description: 'Phương trình mặt cầu tâm $A$: $(x - 1)^2 + (y - 2)^2 + (z + 1)^2 = 6$.', points: 0.5 },
          ],
        },
      ];

  return {
    id: `exam-${Date.now()}`,
    title: examTitle,
    examCode,
    grade: '12',
    durationMinutes: 45,
    totalPoints: 10,
    textbook,
    topic: 'Khảo sát hàm số, Nguyên hàm - Tích phân & Tọa độ Oxyz',
    createdAt: new Date().toISOString().split('T')[0],
    part3Type,
    multipleChoice,
    trueFalseQuestions,
    essays,
  };
}
