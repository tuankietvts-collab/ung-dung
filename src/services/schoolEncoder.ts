/**
 * Utility functions for School, Subject, and School Year encoding
 * According to system specifications:
 * - encodeSchoolName(name): e.g. "THPT Võ Thị Sáu" -> "VTS", "THPT An Phú" -> "AP", "THPT Chuyên Thoại Ngọc Hầu" -> "CTNH"
 * - encodeSubjectName(subject): e.g. "Toán" -> "TO", "Vật Lý" -> "VL", "Ngữ Văn" -> "NV", "Toán Học" -> "TO"
 * - encodeSchoolYear(year): e.g. "2026-2027" -> "26"
 * - Document ID format for Class: [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP] (e.g. "VTS_TO_26_12A8")
 * - Document ID format for Student: [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP]_[STT_2_SỐ] (e.g. "VTS_TO_26_12A8_01")
 * - Student Username format: [tên_lớp_viết_thường][stt_2_số] (e.g. "12a801")
 */

export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .trim();
}

/**
 * Hàm encodeSchoolName(name):
 * Bỏ dấu tiếng Việt, loại bỏ các từ tiền tố chung (trường, thpt, thcs, ptth, trung học, phổ thông),
 * sau đó lấy chữ cái đầu của tất cả các từ còn lại ghép lại viết hoa.
 */
export function encodeSchoolName(name: string): string {
  if (!name || !name.trim()) return 'VTS';
  const noAccents = removeVietnameseAccents(name);
  const rawTokens = noAccents.split(/[\s,._-]+/).filter(Boolean);

  const ignoredPrefixes = new Set([
    'truong',
    'thpt',
    'thcs',
    'ptth',
    'trung',
    'hoc',
    'pho',
    'thong',
  ]);

  const tokens = rawTokens.filter((t) => !ignoredPrefixes.has(t.toLowerCase()));

  if (tokens.length === 0) {
    return rawTokens.map((t) => t[0]).join('').toUpperCase().slice(0, 4) || 'VTS';
  }

  return tokens.map((t) => t[0]).join('').toUpperCase();
}

export interface GdptSubject {
  name: string;
  code: string;
}

export const GDPT_SUBJECTS: GdptSubject[] = [
  { name: 'Toán', code: 'TO' },
  { name: 'Vật lí', code: 'VL' },
  { name: 'Hóa học', code: 'HH' },
  { name: 'Sinh học', code: 'SH' },
  { name: 'Tin học', code: 'TH' },
  { name: 'Ngữ văn', code: 'NV' },
  { name: 'Lịch sử', code: 'LS' },
  { name: 'Địa lí', code: 'DL' },
  { name: 'Tiếng Anh', code: 'TA' },
  { name: 'Giáo dục kinh tế và pháp luật', code: 'KTPL' },
  { name: 'Công nghệ', code: 'CN' },
  { name: 'Giáo dục công dân', code: 'GDCD' },
  { name: 'Khoa học tự nhiên', code: 'KHTN' },
  { name: 'Lịch sử và Địa lí', code: 'LSDL' },
];

/**
 * Hàm encodeSubjectName(subject):
 * Chuẩn hóa mã môn học theo chuẩn GDPT 2018 (TO, VL, HH, SH, TH, NV, LS, DL, TA, KTPL, CN, GDCD, KHTN, LSDL)
 */
export function encodeSubjectName(subject: string): string {
  if (!subject || !subject.trim()) return 'TO';
  const cleanSub = removeVietnameseAccents(subject).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleanSub.includes('kinhte') || cleanSub.includes('ktpl') || cleanSub.includes('phapluat')) return 'KTPL';
  if (cleanSub.includes('khoahoctunhien') || cleanSub.includes('khtn')) return 'KHTN';
  if (cleanSub.includes('lichsuvadiali') || cleanSub.includes('lsdl')) return 'LSDL';
  if (cleanSub.includes('congdan') || cleanSub.includes('gdcd')) return 'GDCD';
  if (cleanSub.includes('congnghe')) return 'CN';
  if (cleanSub.includes('toan')) return 'TO';
  if (cleanSub.includes('vatli') || cleanSub.includes('vatly')) return 'VL';
  if (cleanSub.includes('hoahoc') || cleanSub.includes('hoa')) return 'HH';
  if (cleanSub.includes('sinhhoc') || cleanSub.includes('sinh')) return 'SH';
  if (cleanSub.includes('tinhoc') || cleanSub.includes('tin')) return 'TH';
  if (cleanSub.includes('nguvan') || cleanSub.includes('van')) return 'NV';
  if (cleanSub.includes('lichsu') || cleanSub.includes('su')) return 'LS';
  if (cleanSub.includes('diali') || cleanSub.includes('dialy') || cleanSub.includes('dia')) return 'DL';
  if (cleanSub.includes('tienganh') || cleanSub.includes('anh')) return 'TA';

  const rawTokens = removeVietnameseAccents(subject).split(/[\s,._-]+/).filter(Boolean);
  if (rawTokens.length === 0) return 'TO';
  if (rawTokens.length === 1) return rawTokens[0].toUpperCase().slice(0, 2);
  return rawTokens.map((t) => t[0]).join('').toUpperCase().slice(0, 4);
}

/**
 * Hàm encodeSchoolYear(year):
 * Trích xuất 2 chữ số cuối của năm bắt đầu niên khóa (VD: "2026-2027" -> "26").
 */
export function encodeSchoolYear(year: string): string {
  if (!year || !year.trim()) return '26';
  const match = year.match(/\b(20)?(\d{2})\b/);
  if (match && match[2]) {
    return match[2];
  }
  return '26';
}

/**
 * Tạo Class Document ID theo công thức: [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP]
 * Ví dụ: "VTS_TO_26_12A8"
 */
export function generateClassId(
  schoolName: string,
  subjectName: string,
  schoolYear: string,
  className: string
): string {
  const sCode = encodeSchoolName(schoolName);
  const subCode = encodeSubjectName(subjectName);
  const yCode = encodeSchoolYear(schoolYear);
  const cleanClass = className.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${sCode}_${subCode}_${yCode}_${cleanClass}`;
}

/**
 * Tạo Student Document ID: [MÃ_TRƯỜNG]_[MÃ_MÔN]_[NĂM_2_SỐ]_[TÊN_LỚP]_[STT_2_SỐ]
 * Ví dụ: "VTS_TO_26_12A8_01"
 */
export function generateStudentDocId(classId: string, stt: number): string {
  const sttStr = String(stt).padStart(2, '0');
  return `${classId}_${sttStr}`;
}

/**
 * Tạo Student Username siêu ngắn: [tên_lớp_viết_thường][stt_2_số]
 * Ví dụ: "12a801", "12a802"
 */
export function generateStudentUsername(className: string, stt: number): string {
  const cleanClass = className.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const sttStr = String(stt).padStart(2, '0');
  return `${cleanClass}${sttStr}`;
}
