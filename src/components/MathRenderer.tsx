import React, { useMemo } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export { InlineMath, BlockMath };

export interface MathRendererProps {
  content: string;
  className?: string;
  block?: boolean;
}

/**
 * Normalizes text and math expressions:
 * 1. Fixes common corrupted LaTeX like `(a e 0)` -> `$(a \ne 0)$`
 * 2. Fixes glued words without spaces around parentheses, brackets and dollar signs
 * 3. Ensures proper space between Vietnamese text and math formulas
 */
function preprocessText(raw: string): string {
  if (!raw) return '';

  let text = String(raw);

  // 1. Fix broken `(a e 0)` or `a e 0` -> `$(a \ne 0)$`
  text = text.replace(/\(\s*a\s+[e\u2208\u2260\\]+\s*0\s*\)/gi, () => '$(a \\ne 0)$');
  text = text.replace(/\(\s*a\s*e\s*0\s*\)/gi, () => '$(a \\ne 0)$');
  text = text.replace(/a\s+e\s+0(?=\s|[)cđ\.,;:])/gi, 'a \\ne 0');
  text = text.replace(/\(\s*a\s*\\?ne\s*0\s*\)/gi, () => '$(a \\ne 0)$');
  text = text.replace(/\(\s*a\s*\\?neq\s*0\s*\)/gi, () => '$(a \\ne 0)$');

  // 2. Comprehensive Vietnamese glued words fix (e.g. `(a e 0)cóđồthịđi qua` -> `(a \ne 0) có đồ thị đi qua`)
  text = text.replace(/cóđồthịđi/gi, ' có đồ thị đi ');
  text = text.replace(/cóđồthị/gi, ' có đồ thị ');
  text = text.replace(/đồthịđi/gi, ' đồ thị đi ');
  text = text.replace(/điqua/gi, ' đi qua ');
  text = text.replace(/hàmsố/gi, ' hàm số ');
  text = text.replace(/đồngbiến/gi, ' đồng biến ');
  text = text.replace(/nghịchbiến/gi, ' nghịch biến ');
  text = text.replace(/cựcđại/gi, ' cực đại ');
  text = text.replace(/cựctiểu/gi, ' cực tiểu ');
  text = text.replace(/tiệmcận/gi, ' tiệm cận ');
  text = text.replace(/tiệmcậnđứng/gi, ' tiệm cận đứng ');
  text = text.replace(/tiệmcậnngang/gi, ' tiệm cận ngang ');
  text = text.replace(/bảngbiếnthiên/gi, ' bảng biến thiên ');
  text = text.replace(/bảngxétdấu/gi, ' bảng xét dấu ');
  text = text.replace(/phânthức/gi, ' phân thức ');
  text = text.replace(/tậpxácđịnh/gi, ' tập xác định ');
  text = text.replace(/tậpnghiệm/gi, ' tập nghiệm ');
  text = text.replace(/giátrị/gi, ' giá trị ');
  text = text.replace(/lớnnhất/gi, ' lớn nhất ');
  text = text.replace(/nhỏnhất/gi, ' nhỏ nhất ');
  text = text.replace(/phươngtrình/gi, ' phương trình ');
  text = text.replace(/bấtphươngtrình/gi, ' bất phương trình ');
  text = text.replace(/mệnhđề/gi, ' mệnh đề ');
  text = text.replace(/trắcnghiệm/gi, ' trắc nghiệm ');
  text = text.replace(/tựluận/gi, ' tự luận ');
  text = text.replace(/trảlờingắn/gi, ' trả lời ngắn ');

  // 3. Insert space between closing delimiters and Vietnamese words
  // e.g. `$(C)$có` -> `$(C)$ có`, `(H)và` -> `(H) và`, `)có` -> `) có`
  text = text.replace(/\$([^\$]+)\$([a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])/gu, (_, math, word) => `$${math}$ ${word}`);
  text = text.replace(/([a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])\$([^\$]+)\$/gu, (_, word, math) => `${word} $${math}$`);
  text = text.replace(/\)(?=[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])/gu, ') ');
  text = text.replace(/([a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])\(/gu, (_, word) => `${word} (`);
  text = text.replace(/\}(?=[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])/gu, '} ');

  // 4. Normalize standard LaTeX delimiters
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => `$$${math}$$`);
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => `$${math}$`);

  // 5. Clean extra spaces
  text = text.replace(/[ \t]{2,}/g, ' ');

  return text;
}

/**
 * Sanitizes math formulas for standard KaTeX rendering.
 */
function sanitizeFormula(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\s+/g, ' ');
}

/**
 * Renders an array environment (Bảng xét dấu / Bảng biến thiên) as a crisp,
 * bordered Vietnamese High School (SGK GDPT 2018) table.
 */
interface TableProps {
  arrayCode: string;
}

const LatexArrayTable: React.FC<TableProps> = ({ arrayCode }) => {
  // Parse rows and columns from \begin{array}{...} ... \end{array} or \begin{matrix} ... \end{matrix}
  const parsedTable = useMemo(() => {
    try {
      let code = arrayCode.trim();
      // Remove outer dollars if any
      code = code.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();

      // Extract inner content from array/matrix environment
      // Matches \begin{array}{...}, \\begin{array}{...}, \begin{matrix}, etc.
      const envMatch = code.match(/\\*begin\{(?:array|matrix|tabular|cases|pmatrix|vmatrix)\}\s*(?:\[[^\]]*\])?\s*(?:\{[^}]*\})?([\s\S]*?)\\*end\{(?:array|matrix|tabular|cases|pmatrix|vmatrix)\}/i);
      
      let innerContent = envMatch ? envMatch[1] : code;

      // Normalize row breaks: \cr, \newline, \\ \hline, \\
      innerContent = innerContent
        .replace(/\\cr\b/gi, '\\\\')
        .replace(/\\newline\b/gi, '\\\\')
        .replace(/\\hline/gi, '')
        .replace(/\\cline\{[^}]*\}/gi, '')
        .replace(/\\\\\[[^\]]*\]/gi, '\\\\'); // Remove optional row heights like \\[5pt]

      // Split into rows
      const rawRows = innerContent
        .split(/\\\\/)
        .map((r) => r.trim())
        .filter((r) => r.length > 0 && !/^\\hline$/.test(r));

      if (rawRows.length === 0) return null;

      const rows: string[][] = [];
      for (const rawRow of rawRows) {
        const cleaned = rawRow.replace(/\\hline/g, '').trim();
        if (!cleaned) continue;
        const cells = cleaned.split('&').map((c) => c.trim());
        rows.push(cells);
      }

      if (rows.length < 1) return null;
      return rows;
    } catch (e) {
      console.warn('Could not parse LaTeX array to table:', e);
      return null;
    }
  }, [arrayCode]);

  // If table structure successfully parsed
  if (parsedTable && parsedTable.length >= 1) {
    const isSignTable = parsedTable.length === 2; // Bảng xét dấu: hàng x và hàng y' / f'(x)
    const isVariationTable = parsedTable.length >= 3; // Bảng biến thiên: x, y', y

    return (
      <div className="my-4 max-w-2xl mx-auto overflow-x-auto rounded-xl border-2 border-slate-700 bg-white shadow-sm">
        <div className="bg-slate-100/90 px-3 py-1.5 border-b border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-between">
          <span>{isVariationTable ? '📊 Bảng biến thiên chuẩn SGK GDPT 2018' : isSignTable ? '📈 Bảng xét dấu chuẩn SGK' : 'Bảng toán học'}</span>
          <span className="text-[10px] text-slate-500 font-normal">Kẻ viền chi tiết & mũi tên chuẩn</span>
        </div>
        <table className="w-full text-center border-collapse text-base font-sans select-text">
          <tbody>
            {parsedTable.map((row, rIdx) => {
              const isFirstRow = rIdx === 0;
              const isLastRow = rIdx === parsedTable.length - 1;
              const isYRow = isVariationTable && rIdx === 2;

              return (
                <tr
                  key={rIdx}
                  className={`border-b ${isLastRow ? 'border-none' : 'border-slate-300'} ${
                    isFirstRow ? 'bg-slate-50/90 font-bold border-b-2 border-slate-700' : 'bg-white'
                  }`}
                >
                  {row.map((cell, cIdx) => {
                    const isFirstCol = cIdx === 0;
                    const cellClean = cell.replace(/\$/g, '').trim();

                    // Check for arrows
                    const isDownArrow =
                      cell.includes('\\searrow') ||
                      cell.includes('searrow') ||
                      cell.includes('\\downarrow') ||
                      cell.includes('downarrow');
                    const isUpArrow =
                      cell.includes('\\nearrow') ||
                      cell.includes('nearrow') ||
                      cell.includes('\\uparrow') ||
                      cell.includes('uparrow');
                    const isDoubleBar =
                      cell === '||' ||
                      cell.includes('\\parallel') ||
                      cell === '|' ||
                      cell === '|||';
                    const isPlus = cellClean === '+' || cellClean === '$+$';
                    const isMinus = cellClean === '-' || cellClean === '$-$' || cellClean === '−';
                    const isZero = cellClean === '0' || cellClean === '$0$';

                    return (
                      <td
                        key={cIdx}
                        className={`p-2.5 sm:p-3.5 ${
                          isFirstCol
                            ? 'font-serif italic font-bold border-r-2 border-slate-700 bg-slate-100/90 text-slate-900 w-20 text-center min-w-[60px]'
                            : 'border-r border-slate-200 last:border-r-0 font-medium'
                        } ${isYRow ? 'py-4' : ''}`}
                      >
                        {isDownArrow ? (
                          <div className="flex items-center justify-center text-rose-600 font-black py-1" title="Giảm / Nghịch biến">
                            <svg className="w-6 h-6 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="6" y1="6" x2="18" y2="18" />
                              <polyline points="9 18 18 18 18 9" />
                            </svg>
                          </div>
                        ) : isUpArrow ? (
                          <div className="flex items-center justify-center text-emerald-600 font-black py-1" title="Tăng / Đồng biến">
                            <svg className="w-6 h-6 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="6" y1="18" x2="18" y2="6" />
                              <polyline points="9 6 18 6 18 15" />
                            </svg>
                          </div>
                        ) : isDoubleBar ? (
                          <div className="flex items-center justify-center" title="Điểm không xác định">
                            <span className="inline-block border-l-2 border-r-2 border-slate-800 h-8 w-2 align-middle mx-auto" />
                          </div>
                        ) : isPlus ? (
                          <span className="font-black text-slate-900 text-lg">+</span>
                        ) : isMinus ? (
                          <span className="font-black text-slate-900 text-lg">−</span>
                        ) : isZero ? (
                          <span className="font-bold text-slate-800 text-base">0</span>
                        ) : cellClean ? (
                          <span className={`inline-block font-medium ${isFirstRow || isFirstCol ? 'font-bold text-slate-900' : 'text-slate-800'}`}>
                            <SafeInlineMath math={cellClean} />
                          </span>
                        ) : (
                          <span>&nbsp;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback: render sanitized KaTeX BlockMath
  const formula = arrayCode
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/\\*begin\{array\}\s*\{[^}]*\}/gi, '')
    .replace(/\\*end\{array\}/gi, '')
    .trim();

  return (
    <div className="my-3 text-center overflow-x-auto p-3 bg-slate-50/80 rounded-xl border border-slate-300">
      <SafeInlineMath math={formula} />
    </div>
  );
};

/**
 * Safe wrapper for InlineMath to prevent KaTeX fatal errors from crashing the page
 */
const SafeInlineMath: React.FC<{ math: string }> = ({ math }) => {
  const sanitized = useMemo(() => sanitizeFormula(math), [math]);

  try {
    return <InlineMath math={sanitized} />;
  } catch (e) {
    console.warn('KaTeX inline render error:', e, math);
    return <span className="font-serif italic">{math}</span>;
  }
};

/**
 * Safe wrapper for BlockMath to prevent KaTeX fatal errors
 */
const SafeBlockMath: React.FC<{ math: string }> = ({ math }) => {
  const sanitized = useMemo(() => sanitizeFormula(math), [math]);

  try {
    return <BlockMath math={sanitized} />;
  } catch (e) {
    console.warn('KaTeX block render error:', e, math);
    return <div className="text-center font-serif italic my-2">{math}</div>;
  }
};

export const MathRenderer: React.FC<MathRendererProps> = ({
  content,
  className = '',
  block = false,
}) => {
  const processed = useMemo(() => preprocessText(content), [content]);

  // Regex to split into:
  // 1. Block Math: `$$...$$`
  // 2. Inline Math: `$...$`
  // 3. Raw environments without dollar signs: `\begin{array}...\end{array}`, `\begin{matrix}...\end{matrix}`, etc.
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\*begin\{(?:array|matrix|tabular|pmatrix|vmatrix|cases|aligned)\}[\s\S]+?\\*end\{(?:array|matrix|tabular|pmatrix|vmatrix|cases|aligned)\})/gi;

  const parts = processed.split(tokenRegex);

  return (
    <span
      className={`math-renderer-root text-base sm:text-lg leading-relaxed text-slate-900 ${
        block ? 'block my-2 overflow-x-auto text-center' : 'inline'
      } ${className}`}
    >
      {parts.map((part, index) => {
        if (!part) return null;

        // Raw or wrapped \begin{array}...\end{array} or \begin{matrix}
        if (/begin\{array\}/i.test(part) || (/begin\{matrix\}/i.test(part) && (part.includes('&') || part.includes('\\\\')))) {
          return <LatexArrayTable key={index} arrayCode={part} />;
        }

        // Block Math $$...$$
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const inner = part.slice(2, -2).trim();
          if (/begin\{array\}/i.test(inner)) {
            return <LatexArrayTable key={index} arrayCode={inner} />;
          }
          return (
            <span key={index} className="block my-2.5 text-center overflow-x-auto">
              <SafeBlockMath math={inner} />
            </span>
          );
        }

        // Inline Math $...$
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const inner = part.slice(1, -1).trim();
          if (/begin\{array\}/i.test(inner)) {
            return <LatexArrayTable key={index} arrayCode={inner} />;
          }
          return (
            <span key={index} className="inline-block align-baseline mx-0.5 font-medium">
              <SafeInlineMath math={inner} />
            </span>
          );
        }

        // Raw environment like \begin{matrix}...\end{matrix} or \begin{cases}...\end{cases}
        if (/^\\*begin\{/i.test(part) && /\\*end\{/i.test(part)) {
          return (
            <span key={index} className="block my-2 text-center overflow-x-auto">
              <SafeBlockMath math={part.trim()} />
            </span>
          );
        }

        // Plain text with line breaks
        if (part.includes('\n')) {
          const lines = part.split('\n');
          return (
            <React.Fragment key={index}>
              {lines.map((line, lIdx) => (
                <React.Fragment key={lIdx}>
                  {line}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
};

export default MathRenderer;
