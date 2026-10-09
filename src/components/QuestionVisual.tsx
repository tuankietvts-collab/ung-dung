import React from 'react';
import { VariationTable } from './VariationTable';
import { FunctionPlot } from './FunctionPlot';
import { StatisticsTable } from './StatisticsTable';
import { GeometryDiagram } from './GeometryDiagram';
import { QuestionVisualType } from '../types/exam';

interface QuestionVisualProps {
  visualType?: QuestionVisualType;
  caption?: string;
  questionText?: string;
  forceAutoDetect?: boolean;
}

/**
 * Tự động nhận diện loại trực quan (đồ thị, bảng biến thiên, bảng xét dấu)
 * từ văn bản câu hỏi nếu visualType chưa được gán sẵn.
 */
function inferVisualTypeFromText(text?: string): QuestionVisualType | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Nhận diện Bảng xét dấu
  if (lower.includes('bảng xét dấu') || lower.includes('xét dấu đạo hàm') || lower.includes('xét dấu f\'')) {
    return 'sign_table';
  }

  // 2. Nhận diện Bảng biến thiên
  if (lower.includes('bảng biến thiên') || lower.includes('bbt như sau') || lower.includes('bbt hình bên')) {
    if (lower.includes('phân thức') || /y\s*=\s*\\?(?:d?frac|\/)/i.test(text) || /(tiệm cận|tcd|tcn)/i.test(lower)) {
      return 'variation_table_rational';
    }
    if (lower.includes('bậc hai') || lower.includes('parabol') || /y\s*=\s*[+-]?\d*x\^2(?!\s*x\^)/i.test(text)) {
      return 'variation_table_quadratic';
    }
    if (lower.includes('trùng phương') || /x\^4/i.test(text)) {
      return 'variation_table_quartic';
    }
    return 'variation_table_cubic';
  }

  // 3. Nhận diện Đồ thị hàm số
  if (
    lower.includes('đồ thị như hình') ||
    lower.includes('đồ thị hàm số như hình') ||
    lower.includes('đường cong trong hình') ||
    lower.includes('hình vẽ bên là đồ thị') ||
    lower.includes('đồ thị của hàm số nào dưới đây') ||
    lower.includes('đồ thị (c) như hình') ||
    lower.includes('cho đồ thị')
  ) {
    if (lower.includes('phân thức') || /y\s*=\s*\\?(?:d?frac|\/)/i.test(text) || /(tiệm cận|tcd|tcn)/i.test(lower)) {
      return 'plot_rational';
    }
    if (lower.includes('bậc hai') || lower.includes('parabol') || /y\s*=\s*[+-]?\d*x\^2(?!\s*x\^)/i.test(text)) {
      return 'plot_quadratic';
    }
    if (lower.includes('trùng phương') || /x\^4/i.test(text)) {
      return 'plot_quartic';
    }
    return 'plot_cubic';
  }

  // 4. Nhận diện Không gian Oxyz
  if (lower.includes('không gian oxyz') && (lower.includes('hệ tọa độ') || lower.includes('vectơ đơn vị') || lower.includes('hệ trục'))) {
    return 'geometry_oxyz';
  }

  // 5. Nhận diện Hình chóp không gian
  if (lower.includes('cho hình chóp s.abcd') || lower.includes('khối chóp s.abcd')) {
    return 'geometry_pyramid';
  }

  // 6. Nhận diện Bảng thống kê
  if (lower.includes('bảng tần số') || lower.includes('ghép nhóm') || lower.includes('bảng số liệu')) {
    return 'statistics_table';
  }

  return null;
}

export const QuestionVisual: React.FC<QuestionVisualProps> = ({
  visualType,
  caption,
  questionText,
  forceAutoDetect = true,
}) => {
  // Nếu chưa có visualType, tự động nhận diện từ văn bản đề bài
  const effectiveType = visualType || (forceAutoDetect ? inferVisualTypeFromText(questionText) : null);

  if (!effectiveType) return null;

  switch (effectiveType) {
    // Bảng biến thiên
    case 'variation_table_cubic':
      return <VariationTable type="cubic" title={caption} questionText={questionText} />;
    case 'variation_table_rational':
      return <VariationTable type="rational" title={caption} questionText={questionText} />;
    case 'variation_table_quadratic':
      return <VariationTable type="quadratic" title={caption} questionText={questionText} />;
    case 'variation_table_quartic':
      return <VariationTable type="quartic" title={caption} questionText={questionText} />;
    case 'variation_table_custom':
      return <VariationTable type="cubic" title={caption} questionText={questionText} />;

    // Bảng xét dấu SGK
    case 'sign_table':
      return <VariationTable type="sign_table" title={caption || 'Bảng xét dấu chuẩn SGK'} questionText={questionText} />;

    // Đồ thị hàm số
    case 'plot_cubic':
      return <FunctionPlot type="cubic" title={caption} questionText={questionText} />;
    case 'plot_rational':
      return <FunctionPlot type="rational" title={caption} questionText={questionText} />;
    case 'plot_quadratic':
      return <FunctionPlot type="quadratic" title={caption} questionText={questionText} />;
    case 'plot_quartic':
      return <FunctionPlot type="quartic" title={caption} questionText={questionText} />;
    case 'plot_custom':
      return <FunctionPlot type="cubic" title={caption} questionText={questionText} />;

    // Hình học & Thống kê
    case 'geometry_oxyz':
      return <FunctionPlot type="oxyz" title={caption} questionText={questionText} />;
    case 'statistics_table':
      return <StatisticsTable />;
    case 'geometry_pyramid':
      return <GeometryDiagram />;

    default:
      return null;
  }
};
