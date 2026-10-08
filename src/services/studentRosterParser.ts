import * as XLSX from 'xlsx';
import { StudentRosterItem } from '../types/exam';

/**
 * Result of parsing a student roster file
 */
export interface ParsedRosterResult {
  students: StudentRosterItem[];
  detectedClass: string;
  totalParsed: number;
  formatNote?: string;
}

/**
 * Clean text, stripping non-breaking spaces (\u00a0), carriage returns, and normalizing to Unicode NFC.
 * Preserves tabs (\t) so clipboard data from spreadsheets can be split accurately.
 */
export function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/\u00a0/g, ' ') // replace non-breaking space with normal space
    .replace(/\r/g, '') // remove carriage returns
    .trim()
    .normalize('NFC');
}

// Common Vietnamese family names (surnames) for heuristic detection
const VIETNAMESE_SURNAMES = [
  'nguyễn', 'nguyen', 'trần', 'tran', 'lê', 'le', 'phạm', 'pham',
  'hoàng', 'hoang', 'huỳnh', 'huynh', 'phan', 'vũ', 'vu', 'võ', 'vo',
  'đặng', 'dang', 'bùi', 'bui', 'đỗ', 'do', 'hồ', 'ho', 'ngô', 'ngo',
  'dương', 'duong', 'lý', 'ly', 'đào', 'dao', 'đinh', 'dinh', 'đoàn', 'doan',
  'lâm', 'lam', 'mai', 'trịnh', 'trinh', 'cao', 'hà', 'ha', 'lưu', 'luu',
  'lương', 'luong', 'thái', 'thai', 'châu', 'chau', 'tạ', 'ta', 'tăng', 'tang',
  'quách', 'quach', 'phùng', 'phung', 'tô', 'to', 'la', 'nhâm', 'nham',
  'trương', 'truong', 'văn', 'van', 'diệp', 'diep', 'lục', 'luc', 'thẩm', 'tham',
  'chu', 'khúc', 'khuc', 'triệu', 'trieu', 'tống', 'tong', 'uông', 'uong',
  'kiều', 'kieu', 'vương', 'vuong', 'nghiêm', 'nghiem', 'giáp', 'giap',
  'từ', 'tu', 'bàng', 'bang', 'đổng', 'dong', 'mã', 'ma', 'ngụy', 'nguy',
  'tôn', 'ton', 'phí', 'phi', 'cấn', 'can', 'liêu', 'lieu', 'tiêu', 'tieu'
];

/**
 * Clean and normalize a person's name (Title Case, single spaces, strip stray marks)
 */
export function normalizeVietnameseName(name: string): string {
  const clean = cleanText(name);
  if (!clean) return '';
  return clean
    .replace(/[;|,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => {
      if (!w) return '';
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Intelligently combines Họ và chữ lót (Family + Middle name) with Tên (Given name).
 * E.g.:
 *  "Thái Thị Tuyết" + "Hồng" -> "Thái Thị Tuyết Hồng"
 *  "Nguyễn Văn" + "An" -> "Nguyễn Văn An"
 *  "Trần" + "Bảo Nam" -> "Trần Bảo Nam"
 * Avoids duplicate words if hoPart already ends with tenPart.
 */
export function combineHoAndTen(hoPart: string = '', tenPart: string = ''): string {
  const cleanHo = normalizeVietnameseName(hoPart);
  const cleanTen = normalizeVietnameseName(tenPart);

  if (!cleanHo && !cleanTen) return '';
  if (!cleanHo) return cleanTen;
  if (!cleanTen) return cleanHo;

  // Safeguard: if cleanHo already ends with cleanTen, don't duplicate
  // Example: cleanHo="Nguyễn Văn An", cleanTen="An" -> returns "Nguyễn Văn An"
  const hoWords = cleanHo.split(' ');
  const lastHoWord = hoWords[hoWords.length - 1];
  if (lastHoWord.toLowerCase() === cleanTen.toLowerCase() && hoWords.length >= 2) {
    return cleanHo;
  }

  return `${cleanHo} ${cleanTen}`.trim();
}

/**
 * Detect class name from text lines, sheet name or file name (e.g. "Khối 11 - Lớp 11A1" -> "11A1")
 */
export function detectClassFromText(text: string): string | null {
  const clean = cleanText(text);
  if (!clean) return null;

  // Pattern 1: "Lớp: 11A1", "Lớp 11A1", "Khối 11 - Lớp 11A1", "Lop_11A1", "11A1"
  const classMatch = clean.match(/(?:khối\s*\d+\s*[-_–]\s*)?lớp\s*[:\s_-]*([0-9]{1,2}\s*[a-zA-Z0-9]+)/i);
  if (classMatch && classMatch[1]) {
    return classMatch[1].replace(/[\s_-]+/g, '').toUpperCase();
  }

  // Pattern 2: standalone "10A1", "11B2", "12A8", "10A12", "11A1"
  const standaloneMatch = clean.match(/\b(1[0-2][a-zA-Z][0-9]{1,2})\b/i);
  if (standaloneMatch && standaloneMatch[1]) {
    return standaloneMatch[1].replace(/[\s_-]+/g, '').toUpperCase();
  }

  return null;
}

/**
 * Checks if a row is a section break, summary, or statistics row in vnEdu
 * In vnEdu spreadsheets, after the student list ends, summary and statistics rows appear:
 * "Khối 11", "Thống kê", "Số học sinh đạt", "Tổng số học sinh", "Giáo viên chủ nhiệm", etc.
 * When this function returns TRUE during student parsing, parsing must IMMEDIATELY STOP.
 */
export function isStopRow(entireRowText: string): boolean {
  if (!entireRowText) return false;
  const clean = cleanText(entireRowText).toLowerCase();

  return (
    clean.includes('khối 10') ||
    clean.includes('khối 11') ||
    clean.includes('khối 12') ||
    clean.includes('khoi 10') ||
    clean.includes('khoi 11') ||
    clean.includes('khoi 12') ||
    clean.startsWith('khối') ||
    clean.startsWith('khoi') ||
    clean.includes('thống kê') ||
    clean.includes('thong ke') ||
    clean.includes('số học sinh đạt') ||
    clean.includes('số lượng') ||
    clean.includes('tỉ lệ') ||
    clean.includes('tỷ lệ') ||
    clean.includes('tổng số') ||
    clean.includes('tổng cộng') ||
    clean.includes('xếp loại') ||
    clean.includes('học lực') ||
    clean.includes('hạnh kiểm') ||
    clean.includes('báo cáo') ||
    clean.includes('giáo viên bộ môn') ||
    clean.includes('giáo viên chủ nhiệm') ||
    clean.includes('hiệu trưởng') ||
    clean.includes('ban giám hiệu') ||
    clean.includes('chữ ký') ||
    clean.includes('xác nhận')
  );
}

/**
 * Check if a string is a header, title, or summary row that should be ignored
 */
export function isIgnoredRowText(val: string): boolean {
  if (!val) return true;
  const clean = cleanText(val).toLowerCase();

  const ignoredKeywords = [
    'sở giáo dục', 'phòng giáo dục', 'trường thpt', 'trường thcs',
    'bảng điểm', 'danh sách học sinh', 'học kỳ', 'năm học',
    'thống kê', 'thong ke', 'số học sinh đạt', 'số lượng - tỉ lệ',
    'số lượng', 'tỉ lệ', 'tỷ lệ', 'kết quả',
    'giáo viên bộ môn', 'giáo viên chủ nhiệm', 'hiệu trưởng', 'tổ trưởng',
    'chữ ký', 'nhận xét', 'stt', 'đđgtx', 'đđggk', 'đđgck', 'đtbmhk',
    'điểm trung bình', 'tổng số học sinh', 'tổng số', 'tổng cộng',
    'nam:', 'nữ:', 'dân tộc:', 'khối 10', 'khối 11', 'khối 12',
    'khối:', 'lớp 10', 'lớp 11', 'lớp 12', 'môn toán', 'bgh'
  ];

  return ignoredKeywords.some((kw) => clean.includes(kw));
}

/**
 * Validates whether a string is a legitimate student full name.
 * Strictly rejects summary rows, grade headers, or statistics keywords:
 *  - "Khối 11"
 *  - "Thống kê"
 *  - "Khối 11 - Lớp 11A1"
 *  - "THỐNG KÊ HỌC KỲ 1"
 *  - "Tổng số học sinh"
 *  - Single-word non-names or strings containing digits.
 */
export function isInvalidStudentName(name: string): boolean {
  if (!name || name.trim().length < 2) return true;
  const clean = cleanText(name).toLowerCase();

  // Legitimate Vietnamese student names NEVER contain digits (e.g. "Khối 11", "11A1", "2024-2025")
  if (/\d/.test(clean)) return true;

  // Legitimate Vietnamese names ALWAYS have at least 2 words (Họ + Tên, e.g. "Lê An", "Trần Bình")
  // Single words like "Khối", "Lớp", "Thống", "Tổng", "Nam", "Nữ" are NOT student names
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;

  // Blacklist of summary / footer / title / statistic keywords
  const badKeywords = [
    'thống kê', 'thong ke',
    'khối', 'khoi',
    'lớp', 'lop',
    'học kỳ', 'hoc ky',
    'học sinh đạt', 'hoc sinh dat',
    'số lượng', 'so luong',
    'tỉ lệ', 'ti le', 'tỷ lệ', 'ty le',
    'bảng điểm', 'bang diem',
    'kết quả', 'ket qua',
    'tổng số', 'tong so',
    'tổng cộng', 'tong cong',
    'giáo viên', 'giao vien',
    'gvcn', 'gvbm',
    'hiệu trưởng', 'hieu truong',
    'bgh', 'ban giám hiệu',
    'chữ ký', 'chu ky',
    'ký tên', 'ky ten',
    'nhận xét', 'nhan xet',
    'học lực', 'hoc luc',
    'hạnh kiểm', 'hanh kiem',
    'xếp loại', 'xep loai',
    'báo cáo', 'bao cao',
    'đđg', 'đtb', 'dtb', 'điểm trung bình', 'diem trung binh',
    'năm học', 'nam hoc',
    'sở giáo dục', 'so giao duc',
    'phòng giáo dục', 'phong giao duc',
    'trường thpt', 'truong thpt',
    'trường thcs', 'truong thcs',
    'danh sách', 'danh sach',
    'môn toán', 'mon toan'
  ];

  if (badKeywords.some((kw) => clean.includes(kw))) {
    return true;
  }

  // Reject if starts with generic title prefixes
  if (clean.startsWith('khối') || clean.startsWith('khoi') || clean.startsWith('lớp') || clean.startsWith('lop')) {
    return true;
  }

  return false;
}

/**
 * Test whether a cell value matches "Họ và chữ lót" / "Họ và đệm" (vnEdu format)
 */
export function isHoDemOrLotHeader(val: string): boolean {
  const v = cleanText(val).toLowerCase().replace(/\s+/g, ' ');
  if (!v) return false;
  // Must NOT match class, school, subject, exam, or date
  if (v.includes('lớp') || v.includes('trường') || v.includes('môn') || v.includes('kỳ') || v.includes('năm') || v.includes('ngày')) {
    return false;
  }

  return (
    v.includes('chữ lót') ||
    v.includes('tên lót') ||
    v.includes('họ lót') ||
    v.includes('họ và chữ lót') ||
    v.includes('họ & chữ lót') ||
    v.includes('họ chữ lót') ||
    v.includes('họ và tên lót') ||
    v.includes('họ & tên lót') ||
    v.includes('họ tên lót') ||
    v.includes('đệm') ||
    v.includes('họ và đệm') ||
    v.includes('họ & đệm') ||
    v.includes('họ đệm') ||
    v.includes('họ và tên đệm') ||
    v.includes('họ & tên đệm') ||
    v.includes('họ tên đệm') ||
    v.includes('họ và chữ đệm') ||
    v.includes('họ chữ đệm') ||
    v === 'họ' ||
    v === 'ho' ||
    v === 'họ học sinh' ||
    v === 'họ hs' ||
    v === 'họ đệm học sinh' ||
    v === 'họ và đệm học sinh' ||
    v === 'họ và chữ lót học sinh'
  );
}

/**
 * Test whether a cell value matches "Tên" (vnEdu format)
 */
export function isTenHeader(val: string): boolean {
  const v = cleanText(val).toLowerCase().replace(/\s+/g, ' ');
  if (!v) return false;
  // Must NOT match "họ", "lớp", "trường", "môn", "bài", "kỳ", "năm", "ngày"
  if (v.includes('họ') || v.includes('lớp') || v.includes('trường') || v.includes('môn') || v.includes('bài') || v.includes('kỳ') || v.includes('năm') || v.includes('ngày')) {
    return false;
  }
  return (
    v === 'tên' ||
    v === 'ten' ||
    v === 'tên học sinh' ||
    v === 'tên hs' ||
    v === 'tên gọi' ||
    v === 'tên của học sinh' ||
    v === 'first name' ||
    v === 'given name'
  );
}

/**
 * Test whether a cell value matches combined "Họ và tên" (Single column)
 */
export function isFullNameHeader(val: string): boolean {
  const v = cleanText(val).toLowerCase().replace(/\s+/g, ' ');
  return (
    v === 'họ và tên' ||
    v === 'họ & tên' ||
    v === 'họ tên' ||
    v === 'họ và tên học sinh' ||
    v === 'họ tên học sinh' ||
    v === 'họ tên hs' ||
    v === 'họ và tên hs' ||
    v === 'fullname' ||
    v === 'full name' ||
    v === 'student name'
  );
}

/**
 * Test whether a cell value matches STT
 */
export function isSttHeader(val: string): boolean {
  const v = cleanText(val).toLowerCase();
  return (
    v === 'stt' ||
    v === 'stt.' ||
    v === 'số tt' ||
    v === 'số tt' ||
    v === 'số thứ tự' ||
    v === 'thứ tự' ||
    v === 'tt' ||
    v === 'no' ||
    v === 'no.' ||
    v === 'order'
  );
}

/**
 * Test whether a cell value matches Student ID / SBD / Mã vnEdu
 */
export function isSbdOrIdHeader(val: string): boolean {
  const v = cleanText(val).toLowerCase();
  if (v.includes('đề') || v.includes('exam')) return false;
  return (
    v.includes('mã học sinh') ||
    v.includes('mã hs') ||
    v.includes('mã định danh') ||
    v.includes('mã vnedu') ||
    v.includes('mã số') ||
    v.includes('mã số hs') ||
    v === 'sbd' ||
    v.includes('số báo danh') ||
    v.includes('mã định danh học sinh') ||
    v === 'mã' ||
    v === 'ma hs' ||
    v === 'student id'
  );
}

/**
 * Test whether a cell value matches Class
 */
export function isClassHeader(val: string): boolean {
  const v = cleanText(val).toLowerCase();
  return (
    v === 'lớp' ||
    v === 'lop' ||
    v === 'tên lớp' ||
    v === 'lớp học' ||
    v === 'khối/lớp' ||
    v === 'class'
  );
}

/**
 * Parse student roster from an Excel/CSV Workbook.
 * Fully supports:
 *  - vnEdu format (2 separate columns: "Họ và chữ lót" (hoặc "Họ và đệm") + "Tên")
 *  - vnEdu merged 2-row header formats
 *  - Single-column "Họ và tên"
 *  - Immediate stoppage upon reaching summary / statistics rows ("Khối 11", "Thống kê", ...)
 */
export function parseStudentRosterFromWorkbook(
  workbook: XLSX.WorkBook,
  fallbackClass: string = '10A1'
): ParsedRosterResult {
  const firstSheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('File Excel rỗng hoặc không có đủ dữ liệu học sinh.');
  }

  // 1. Detect Class from sheet name or top banner rows
  let detectedClass = detectClassFromText(firstSheetName) || '';

  if (!detectedClass) {
    for (let r = 0; r < Math.min(10, rawRows.length); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;
      const rowText = row.map((cell) => cleanText(cell)).join(' ');
      const cls = detectClassFromText(rowText);
      if (cls) {
        detectedClass = cls;
        break;
      }
    }
  }

  const effectiveClass = (detectedClass || fallbackClass || '10A1').toUpperCase().trim();

  // 2. Scan for Table Header Rows (supports multi-row merged headers like row 4 "Họ và tên", row 5 "Họ và chữ lót" + "Tên")
  let headerRowIndex = -1;
  let colIdxStt = -1;
  let colIdxHo = -1;
  let colIdxTen = -1;
  let colIdxFullName = -1;
  let colIdxClass = -1;
  let colIdxSbd = -1;

  for (let r = 0; r < Math.min(15, rawRows.length); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    let rowHasStt = false;
    let rowHasHo = false;
    let rowHasTen = false;
    let rowHasFullName = false;

    for (let c = 0; c < row.length; c++) {
      const val = cleanText(row[c]);
      if (!val) continue;

      if (isSttHeader(val)) {
        colIdxStt = c;
        rowHasStt = true;
      } else if (isHoDemOrLotHeader(val)) {
        colIdxHo = c;
        rowHasHo = true;
      } else if (isTenHeader(val)) {
        colIdxTen = c;
        rowHasTen = true;
      } else if (isFullNameHeader(val)) {
        colIdxFullName = c;
        rowHasFullName = true;
      } else if (isClassHeader(val)) {
        colIdxClass = c;
      } else if (isSbdOrIdHeader(val)) {
        colIdxSbd = c;
      }
    }

    // Direct vnEdu 2-column header row found!
    if (rowHasHo && rowHasTen) {
      headerRowIndex = r;
      break;
    }

    // If row has STT and either FullName or Ho or Ten
    if (rowHasStt && (rowHasFullName || rowHasHo || rowHasTen)) {
      // Check if next row (r+1) has subheaders (e.g. "Họ và chữ lót" and "Tên")
      const nextRow = rawRows[r + 1];
      if (Array.isArray(nextRow)) {
        for (let c = 0; c < nextRow.length; c++) {
          const valNext = cleanText(nextRow[c]);
          if (isHoDemOrLotHeader(valNext)) colIdxHo = c;
          if (isTenHeader(valNext)) colIdxTen = c;
          if (isClassHeader(valNext)) colIdxClass = c;
          if (isSbdOrIdHeader(valNext)) colIdxSbd = c;
        }
        if (colIdxHo !== -1 && colIdxTen !== -1) {
          headerRowIndex = r + 1; // 2-row merged header, data starts at r + 2
          break;
        }
      }

      headerRowIndex = r;
      break;
    }
  }

  // 2.2 If Ten was found, but Ho was not explicitly labeled, Ho is usually the column directly preceding Ten
  if (colIdxTen !== -1 && colIdxHo === -1) {
    if (colIdxTen > 0) {
      colIdxHo = colIdxTen - 1;
      colIdxFullName = -1;
    }
  }

  // 2.3 If Ho was found, but Ten was not explicitly labeled, check if Ho + 1 contains given names
  if (colIdxHo !== -1 && colIdxTen === -1) {
    const candidateTenCol = colIdxHo + 1;
    let singleWordCount = 0;
    for (let checkR = Math.max(0, headerRowIndex + 1); checkR < Math.min(headerRowIndex + 6, rawRows.length); checkR++) {
      const row = rawRows[checkR];
      if (!row || !Array.isArray(row)) continue;
      const cellVal = cleanText(row[candidateTenCol]);
      if (cellVal && cellVal.length >= 1 && cellVal.length <= 15 && !/\d/.test(cellVal) && !cellVal.includes(' ')) {
        singleWordCount++;
      }
    }
    if (singleWordCount >= 1) {
      colIdxTen = candidateTenCol;
      colIdxFullName = -1;
    }
  }

  // 2.5 Heuristic data row scan: check if candidate column is Họ đệm and adjacent column is Tên
  if (colIdxHo === -1 || colIdxTen === -1) {
    const startScanCol = colIdxFullName !== -1 ? colIdxFullName : 2;
    for (let c = 1; c < Math.min(6, (rawRows[headerRowIndex + 1] || []).length - 1); c++) {
      let matchedTwoCol = 0;
      for (let checkR = Math.max(0, headerRowIndex + 1); checkR < Math.min(headerRowIndex + 8, rawRows.length); checkR++) {
        const row = rawRows[checkR];
        if (!row || !Array.isArray(row)) continue;
        const c1 = cleanText(row[c]).toLowerCase();
        const c2 = cleanText(row[c + 1]);

        const isC1Vietnamese = VIETNAMESE_SURNAMES.some((s) => c1.startsWith(s));
        const isC2SingleWord = c2.length >= 1 && c2.length <= 15 && !/\d/.test(c2) && !c2.includes(' ');

        if (isC1Vietnamese && isC2SingleWord) {
          matchedTwoCol++;
        }
      }

      if (matchedTwoCol >= 2) {
        colIdxHo = c;
        colIdxTen = c + 1;
        colIdxFullName = -1;
        break;
      }
    }
  }

  // Determine whether this sheet uses 2 separate columns (Họ và chữ lót + Tên)
  const isSeparateHoTen = colIdxHo !== -1 && colIdxTen !== -1;

  if (colIdxStt === -1) colIdxStt = 0;

  const parsedStudents: StudentRosterItem[] = [];
  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const entireRowText = row.map((c) => cleanText(c)).join(' ').trim();

    // STOP CONDITION: In vnEdu, student list ends when the summary / statistics section begins
    // Once "Khối 11", "Thống kê", "Số học sinh đạt", "Tổng số học sinh" is reached AFTER students have been parsed:
    // STOP READING IMMEDIATELY! This prevents "Khối 11", "Thống kê" from being added as students!
    if (parsedStudents.length > 0 && isStopRow(entireRowText)) {
      break;
    }

    if (isIgnoredRowText(entireRowText)) {
      continue;
    }

    const sttRaw = cleanText(row[colIdxStt]);
    const sttNum = parseInt(sttRaw, 10);

    let fullName = '';

    if (isSeparateHoTen) {
      // vnEdu standard: combine Họ và chữ lót (hoPart) + Tên (tenPart)
      const hoPart = cleanText(row[colIdxHo]);
      const tenPart = cleanText(row[colIdxTen]);

      if (!hoPart && !tenPart) continue;
      // Skip if this row is a repeat header
      if (isHoDemOrLotHeader(hoPart) || isTenHeader(tenPart)) continue;

      fullName = combineHoAndTen(hoPart, tenPart);
    } else {
      // Single column "Họ và tên"
      const nameCol = colIdxFullName !== -1 ? colIdxFullName : colIdxHo !== -1 ? colIdxHo : 1;
      fullName = cleanText(row[nameCol]);
      if (isFullNameHeader(fullName)) continue;
      fullName = normalizeVietnameseName(fullName);
    }

    // Strict validation: Reject summary rows or non-names
    if (
      !fullName ||
      fullName.length < 2 ||
      isInvalidStudentName(fullName) ||
      isIgnoredRowText(fullName)
    ) {
      continue;
    }

    // Class name
    let studentClass = effectiveClass;
    if (colIdxClass !== -1 && row[colIdxClass]) {
      const cVal = cleanText(row[colIdxClass]).toUpperCase();
      if (cVal && !isIgnoredRowText(cVal) && cVal.length <= 12) {
        studentClass = cVal;
      }
    }

    // Sequence number
    const finalStt = !isNaN(sttNum) && sttNum > 0 ? sttNum : parsedStudents.length + 1;

    // SBD / Mã học sinh (vnEdu ID)
    let sbdVal = '';
    if (colIdxSbd !== -1 && row[colIdxSbd]) {
      const sVal = cleanText(row[colIdxSbd]);
      if (sVal && !isIgnoredRowText(sVal) && !/\s{4,}/.test(sVal)) {
        sbdVal = sVal;
      }
    }
    if (!sbdVal) {
      sbdVal = `${studentClass}-${String(finalStt).padStart(2, '0')}`;
    }

    const safeId = `${studentClass}_${sbdVal}`.replace(/[\/\s#?]+/g, '_');

    parsedStudents.push({
      id: safeId,
      stt: finalStt,
      fullName,
      className: studentClass,
      sbd: sbdVal,
      createdAt: new Date().toISOString()
    });
  }

  if (parsedStudents.length === 0) {
    throw new Error('Không nhận diện được học sinh nào từ file. Hãy kiểm tra định dạng các cột STT, Họ và chữ lót, Tên (hoặc Họ và tên).');
  }

  return {
    students: parsedStudents,
    detectedClass: effectiveClass,
    totalParsed: parsedStudents.length,
    formatNote: isSeparateHoTen
      ? 'Định dạng vnEdu (Tự động gộp chuẩn 2 cột "Họ và chữ lót" + "Tên" thành Họ và tên đầy đủ)'
      : 'Định dạng danh sách 1 cột Họ và tên'
  };
}

/**
 * Parse quick-pasted text (supports single column, tab-separated vnEdu columns, etc.)
 * Intelligently identifies vnEdu columns when teachers copy from Excel or web.
 */
export function parseQuickPasteText(
  pastedText: string,
  targetClass: string = '10A1'
): StudentRosterItem[] {
  if (!pastedText || !pastedText.trim()) return [];

  const lines = pastedText.split('\n').map((l) => cleanText(l)).filter(Boolean);
  const parsedStudents: StudentRosterItem[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // STOP CONDITION: Stop if reaching summary or statistics row
    if (parsedStudents.length > 0 && isStopRow(line)) {
      break;
    }

    if (isIgnoredRowText(line)) continue;

    let stt = parsedStudents.length + 1;
    let fullName = '';
    let sbd = '';
    let studentClass = targetClass.trim().toUpperCase();

    // Check tab or semicolon/pipe separated (copied from Excel or vnEdu)
    if (line.includes('\t') || line.includes(';') || line.includes('|')) {
      const parts = line.split(/[\t;|]+/).map((p) => cleanText(p)).filter(Boolean);

      // Skip header lines
      if (parts.some((p) => isSttHeader(p) || isHoDemOrLotHeader(p) || isFullNameHeader(p) || isTenHeader(p))) {
        continue;
      }

      if (parts.length >= 4) {
        // vnEdu common cases:
        // Format A: [STT, Mã HS, Họ và chữ lót, Tên, (Lớp/Ngày sinh)] -> 5+ cols
        // e.g. "1 \t 2300184912 \t Thái Thị Tuyết \t Hồng \t 11A1"
        if (/^\d+$/.test(parts[0])) {
          stt = parseInt(parts[0], 10);
          // Check if parts[1] is Student Code (all digits or alphanumeric code)
          if (/^[a-zA-Z0-9_-]{5,}$/.test(parts[1]) || /^\d{4,}$/.test(parts[1])) {
            sbd = parts[1];
            fullName = combineHoAndTen(parts[2], parts[3]);
            if (parts[4] && /^[0-9]{1,2}[A-Za-z0-9]+$/.test(parts[4])) {
              studentClass = parts[4].toUpperCase();
            }
          } else {
            // Format B: [STT, Họ và chữ lót, Tên, Lớp hoặc SBD]
            fullName = combineHoAndTen(parts[1], parts[2]);
            if (parts[3]) {
              if (/^[0-9]{1,2}[A-Za-z0-9]+$/.test(parts[3])) {
                studentClass = parts[3].toUpperCase();
              } else {
                sbd = parts[3];
              }
            }
          }
        } else {
          // [Họ và chữ lót, Tên, Lớp, SBD]
          fullName = combineHoAndTen(parts[0], parts[1]);
          if (parts[2] && /^[0-9]{1,2}[A-Za-z0-9]+$/.test(parts[2])) {
            studentClass = parts[2].toUpperCase();
          }
          if (parts[3]) sbd = parts[3];
        }
      } else if (parts.length === 3) {
        // 3 columns:
        // [STT, Họ và chữ lót, Tên] -> vnEdu 3-column copy
        if (/^\d+$/.test(parts[0])) {
          stt = parseInt(parts[0], 10);
          fullName = combineHoAndTen(parts[1], parts[2]);
        } else {
          // [Họ và chữ lót, Tên, Lớp/SBD]
          fullName = combineHoAndTen(parts[0], parts[1]);
          if (/^[0-9]{1,2}[A-Za-z0-9]+$/.test(parts[2])) {
            studentClass = parts[2].toUpperCase();
          } else {
            sbd = parts[2];
          }
        }
      } else if (parts.length === 2) {
        // 2 columns:
        // If part 0 is a number -> [STT, Họ và tên]
        if (/^\d+$/.test(parts[0])) {
          stt = parseInt(parts[0], 10);
          fullName = normalizeVietnameseName(parts[1]);
        } else {
          // [Họ và chữ lót, Tên] -> Combine!
          fullName = combineHoAndTen(parts[0], parts[1]);
        }
      }
    } else {
      // Single string line
      // Strips leading number like "1. Thái Thị Tuyết Hồng", "01 - Thái Thị Tuyết Hồng"
      const numMatch = line.match(/^(\d+)[\.\-\s|:]+(.+)$/);
      if (numMatch) {
        stt = parseInt(numMatch[1], 10);
        fullName = numMatch[2].trim();
      } else {
        fullName = line.trim();
      }
      fullName = normalizeVietnameseName(fullName);
    }

    if (
      fullName &&
      fullName.length >= 2 &&
      !isInvalidStudentName(fullName) &&
      !isIgnoredRowText(fullName)
    ) {
      if (!sbd) {
        sbd = `${studentClass}-${String(stt).padStart(2, '0')}`;
      }
      const safeId = `${studentClass}_${sbd}`.replace(/[\/\s#?]+/g, '_');

      parsedStudents.push({
        id: safeId,
        stt,
        fullName,
        className: studentClass,
        sbd,
        createdAt: new Date().toISOString()
      });
    }
  }

  return parsedStudents;
}
