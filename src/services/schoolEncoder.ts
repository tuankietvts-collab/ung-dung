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

/**
 * Hàm encodeSubjectName(subject):
 * Bỏ dấu tiếng Việt.
 * Nếu chỉ có 1 từ thì lấy 2 chữ cái đầu (VD: "Toán" -> "TO", "Lý" -> "LY").
 * Nếu từ 2 từ trở lên thì lấy chữ cái đầu của mỗi từ (VD: "Vật Lý" -> "VL", "Ngữ Văn" -> "NV", "Tiếng Anh" -> "TA", "Toán Học" -> "TO").
 */
export function encodeSubjectName(subject: string): string {
  if (!subject || !subject.trim()) return 'TO';
  const noAccents = removeVietnameseAccents(subject);
  const rawTokens = noAccents.split(/[\s,._-]+/).filter(Boolean);

  if (rawTokens.length === 0) return 'TO';

  // "Toán Học" -> "TO"
  if (
    rawTokens.length >= 2 &&
    rawTokens[0].toLowerCase() === 'toan' &&
    rawTokens[1].toLowerCase() === 'hoc'
  ) {
    return 'TO';
  }

  if (rawTokens.length === 1) {
    const single = rawTokens[0].toUpperCase();
    return single.slice(0, 2);
  }

  return rawTokens.map((t) => t[0]).join('').toUpperCase();
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
