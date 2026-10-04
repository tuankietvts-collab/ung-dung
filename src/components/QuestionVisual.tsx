import React from 'react';
import { VariationTable } from './VariationTable';
import { FunctionPlot } from './FunctionPlot';
import { StatisticsTable } from './StatisticsTable';
import { GeometryDiagram } from './GeometryDiagram';

interface QuestionVisualProps {
  visualType?:
    | 'variation_table_rational'
    | 'variation_table_cubic'
    | 'plot_rational'
    | 'plot_cubic'
    | 'statistics_table'
    | 'geometry_pyramid'
    | 'geometry_oxyz';
  caption?: string;
  questionText?: string;
}

export const QuestionVisual: React.FC<QuestionVisualProps> = ({
  visualType,
  caption,
  questionText,
}) => {
  if (!visualType) return null;

  switch (visualType) {
    case 'variation_table_cubic':
      return <VariationTable type="cubic" title={caption} />;
    case 'variation_table_rational':
      return <VariationTable type="rational" title={caption} />;
    case 'plot_cubic':
      return <FunctionPlot type="cubic" title={caption} questionText={questionText} />;
    case 'plot_rational':
      return <FunctionPlot type="rational" title={caption} questionText={questionText} />;
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
