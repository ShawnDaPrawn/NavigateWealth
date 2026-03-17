/**
 * Chart utility re-exports
 *
 * Previously this file wrapped recharts primitives.
 * Now it re-exports the custom SVG chart components from svg-charts.tsx.
 * Kept for backward compatibility in case any future code imports from here.
 */

export {
  SVGBarChart,
  SVGLineChart,
  SVGPieChart,
  SVGAreaSparkline,
} from './svg-charts';

export type {
  BarChartSeries,
  SVGBarChartProps,
  LineChartSeries,
  SVGLineChartProps,
  PieSlice,
  SVGPieChartProps,
  SparklineDataPoint,
  SVGAreaSparklineProps,
} from './svg-charts';
