/**
 * safeJsonParser.ts
 * Bóc tách và làm sạch chuỗi JSON phản hồi từ Gemini API.
 * Khắc phục triệt để:
 * - "Unexpected non-whitespace character after JSON at position 7474"
 * - "Bad escaped character in JSON at position ..."
 * - Định dạng markdown bọc ngoài (```json ... ```)
 * - Mọi công thức LaTeX chứa single hoặc double backslash (\frac, \sqrt, \alpha, \vec, \sin, \int...)
 */

export function repairLatexInJson(str: string): string {
  let out = '';
  let inString = false;
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const ch = str[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }

    if (ch === '\n') { out += '\\n'; continue; }
    if (ch === '\r') { out += '\\r'; continue; }
    if (ch === '\t') { out += '\\t'; continue; }

    if (ch === '\\') {
      const next = i + 1 < len ? str[i + 1] : '';

      // 1. Double quote
      if (next === '"') { out += '\\"'; i++; continue; }

      // 2. Already escaped backslash \\ -> preserve both!
      if (next === '\\') { out += '\\\\'; i++; continue; }

      // 3. LaTeX commands colliding with JSON control escapes:
      const lookahead = str.slice(i + 1, i + 10).toLowerCase();
      if (/^f(rac|loat)/.test(lookahead)) { out += '\\\\f'; i++; continue; }
      if (/^t(ext|an|au|heta|imes|ilde|op|riangle|o\b)/.test(lookahead)) { out += '\\\\t'; i++; continue; }
      if (/^n(eq?|otin|abla|atural|eg|u\b)/.test(lookahead)) { out += '\\\\n'; i++; continue; }
      if (/^r(ight|ho|m\b|angle)/.test(lookahead)) { out += '\\\\r'; i++; continue; }
      if (/^b(ar|eta|inom|oldsymbol|matrix|ullet)/.test(lookahead)) { out += '\\\\b'; i++; continue; }

      // 4. Standard valid JSON escapes
      if (next === '/' || next === 'b' || next === 'f' || next === 'n' || next === 'r' || next === 't') {
        out += '\\' + next;
        i++;
        continue;
      }

      // 5. Unicode escape \uXXXX
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(str.slice(i + 2, i + 6))) {
        out += '\\u' + str.slice(i + 2, i + 6);
        i += 5;
        continue;
      }

      // 6. Any other character (e.g. \sqrt, \alpha, \int, \le, \sin...) -> escape the backslash: \\ + next
      out += '\\\\' + next;
      i++;
      continue;
    }

    out += ch;
  }

  // Remove trailing commas before } or ]
  return out.replace(/,\s*([}\]])/g, '$1');
}

export function safeParseGeminiResponse<T = any>(rawText: string): T {
  if (!rawText) {
    throw new Error('Dữ liệu phản hồi từ AI rỗng');
  }

  let cleanText = rawText.trim();

  // 1. Loại bỏ các khối code block markdown nếu có
  cleanText = cleanText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // 2. Tìm vị trí dấu ngoặc nhọn mở đầu tiên và đóng cuối cùng
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  // 3. Thử parse trực tiếp nếu chuỗi đã là JSON chuẩn
  try {
    return JSON.parse(cleanText);
  } catch (directErr: any) {
    const errorMsg = String(directErr?.message || '');

    // Trường hợp ký tự thừa sau JSON (position error ví dụ position 7474)
    const match = errorMsg.match(/position\s+(\d+)/i);
    if (match) {
      const pos = parseInt(match[1], 10);
      if (pos > 0 && pos <= cleanText.length) {
        const truncated = cleanText.substring(0, pos).trim();
        try {
          return JSON.parse(truncated);
        } catch {
          const lastValidBrace = cleanText.lastIndexOf('}', pos);
          if (lastValidBrace !== -1 && lastValidBrace > 0) {
            try {
              return JSON.parse(cleanText.substring(0, lastValidBrace + 1).trim());
            } catch {}
          }
        }
      }
    }

    // Trường hợp lỗi cú pháp escape LaTeX: chạy bộ phân tích lexical repair
    try {
      const repaired = repairLatexInJson(cleanText);
      return JSON.parse(repaired);
    } catch (repairErr: any) {
      // Cố gắng thêm 1 lần nữa nếu chuỗi repaired có position error
      const repMatch = String(repairErr?.message || '').match(/position\s+(\d+)/i);
      if (repMatch) {
        const repPos = parseInt(repMatch[1], 10);
        if (repPos > 0 && repPos <= cleanText.length) {
          try {
            return JSON.parse(cleanText.substring(0, repPos).trim());
          } catch {}
        }
      }

      throw new Error(`Lỗi parse JSON từ Gemini: ${repairErr?.message || errorMsg}`);
    }
  }
}

export default safeParseGeminiResponse;
