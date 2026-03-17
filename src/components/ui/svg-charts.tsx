/**
 * Custom SVG Chart Components
 *
 * Pure SVG-based chart implementations to replace recharts.
 * Provides: SVGBarChart, SVGLineChart, SVGPieChart, SVGAreaSparkline
 *
 * All components are responsive via ResizeObserver and render tooltips
 * on hover. No external charting library dependencies.
 */

import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';

// ─── Shared utilities ────────────────────────────────────────────────

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setWidth(el.clientWidth);

    return () => ro.disconnect();
  }, [ref]);

  return width;
}

/** Compute nice Y-axis ticks for a given max value */
function computeYTicks(maxVal: number, tickCount = 5): number[] {
  if (maxVal <= 0) return [0];
  const raw = maxVal / (tickCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = Math.ceil(raw / mag) * mag;
  const ticks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    ticks.push(nice * i);
  }
  return ticks;
}

/** Default tooltip container */
function ChartTooltip({
  x,
  y,
  visible,
  children,
  containerWidth,
}: {
  x: number;
  y: number;
  visible: boolean;
  children: React.ReactNode;
  containerWidth: number;
}) {
  if (!visible) return null;

  // Flip tooltip to the left if it would overflow
  const tooltipWidth = 180;
  const flipped = x + tooltipWidth + 16 > containerWidth;

  return (
    <div
      className="absolute pointer-events-none z-50 bg-white shadow-lg rounded-lg border border-gray-200 px-3 py-2 text-xs"
      style={{
        left: flipped ? x - tooltipWidth - 8 : x + 12,
        top: y - 10,
        minWidth: 120,
        maxWidth: tooltipWidth,
      }}
    >
      {children}
    </div>
  );
}

// ─── SVGBarChart ─────────────────────────────────────────────────────

export interface BarChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface SVGBarChartProps {
  data: Record<string, unknown>[];
  categoryKey: string;
  series: BarChartSeries[];
  height?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGrid?: boolean;
  /** Override bar color per data entry (used for conditional coloring with single series) */
  barColorFn?: (entry: Record<string, unknown>, seriesKey: string, index: number) => string | undefined;
  margin?: { top: number; right: number; bottom: number; left: number };
}

export function SVGBarChart({
  data,
  categoryKey,
  series,
  height = 280,
  yAxisFormatter = (v) => String(v),
  tooltipFormatter,
  showLegend = true,
  showGrid = true,
  barColorFn,
  margin: marginProp,
}: SVGBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    values: { key: string; seriesLabel: string; value: number; color: string }[];
  } | null>(null);

  const margin = marginProp || { top: 20, right: 20, bottom: 30, left: 60 };
  const chartWidth = containerWidth - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Compute max value
  const maxVal = useMemo(() => {
    let max = 0;
    for (const d of data) {
      for (const s of series) {
        const v = Number(d[s.key]) || 0;
        if (v > max) max = v;
      }
    }
    return max;
  }, [data, series]);

  const yTicks = useMemo(() => computeYTicks(maxVal), [maxVal]);
  const yMax = yTicks[yTicks.length - 1] || 1;

  if (containerWidth === 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  const groupCount = data.length;
  const barCount = series.length;
  const groupWidth = chartWidth / groupCount;
  const barGap = 4;
  const totalBarWidth = groupWidth * 0.6;
  const barWidth = (totalBarWidth - barGap * (barCount - 1)) / barCount;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - margin.left;
    const groupIdx = Math.floor(mx / groupWidth);
    if (groupIdx < 0 || groupIdx >= groupCount) {
      setTooltip(null);
      return;
    }
    const d = data[groupIdx];
    const values = series.map((s, si) => ({
      key: s.key,
      seriesLabel: s.label,
      value: Number(d[s.key]) || 0,
      color: barColorFn ? (barColorFn(d, s.key, groupIdx) || s.color) : s.color,
    }));
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      label: String(d[categoryKey]),
      values,
    });
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg width={containerWidth} height={height}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines */}
          {showGrid &&
            yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={chartWidth}
                y1={chartHeight - (tick / yMax) * chartHeight}
                y2={chartHeight - (tick / yMax) * chartHeight}
                stroke="#f0f0f0"
                strokeDasharray="3 3"
              />
            ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={-8}
              y={chartHeight - (tick / yMax) * chartHeight + 4}
              textAnchor="end"
              className="fill-gray-500"
              fontSize={10}
            >
              {yAxisFormatter(tick)}
            </text>
          ))}

          {/* Bars */}
          {data.map((d, gi) => {
            const groupX = gi * groupWidth + (groupWidth - totalBarWidth) / 2;
            return series.map((s, si) => {
              const val = Number(d[s.key]) || 0;
              const barH = (val / yMax) * chartHeight;
              const bx = groupX + si * (barWidth + barGap);
              const by = chartHeight - barH;
              const fill = barColorFn ? (barColorFn(d, s.key, gi) || s.color) : s.color;
              return (
                <rect
                  key={`${gi}-${si}`}
                  x={bx}
                  y={by}
                  width={Math.max(barWidth, 1)}
                  height={Math.max(barH, 0)}
                  fill={fill}
                  rx={3}
                />
              );
            });
          })}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={i * groupWidth + groupWidth / 2}
              y={chartHeight + 18}
              textAnchor="middle"
              className="fill-gray-500"
              fontSize={11}
            >
              {String(d[categoryKey])}
            </text>
          ))}

          {/* X-axis line */}
          <line x1={0} x2={chartWidth} y1={chartHeight} y2={chartHeight} stroke="#e5e7eb" />
        </g>
      </svg>

      {/* Hover overlay */}
      <div
        className="absolute inset-0"
        style={{ left: margin.left, top: margin.top, width: chartWidth, height: chartHeight }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* Tooltip */}
      {tooltip && (
        <ChartTooltip x={tooltip.x} y={tooltip.y} visible containerWidth={containerWidth}>
          <p className="font-medium text-gray-900 mb-1">{tooltip.label}</p>
          {tooltip.values.map((v) => (
            <div key={v.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
                <span className="text-gray-600">{v.seriesLabel}</span>
              </div>
              <span className="font-medium text-gray-900">
                {tooltipFormatter ? tooltipFormatter(v.value) : v.value.toLocaleString()}
              </span>
            </div>
          ))}
        </ChartTooltip>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-center gap-4 mt-2">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SVGLineChart ────────────────────────────────────────────────────

export interface LineChartSeries {
  key: string;
  label: string;
  color: string;
  strokeWidth?: number;
}

export interface SVGLineChartProps {
  data: Record<string, unknown>[];
  categoryKey: string;
  series: LineChartSeries[];
  height?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  showGrid?: boolean;
  margin?: { top: number; right: number; bottom: number; left: number };
}

export function SVGLineChart({
  data,
  categoryKey,
  series,
  height = 260,
  yAxisFormatter = (v) => String(v),
  tooltipFormatter,
  showGrid = true,
  margin: marginProp,
}: SVGLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const margin = marginProp || { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = containerWidth - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const maxVal = useMemo(() => {
    let max = 0;
    for (const d of data) {
      for (const s of series) {
        const v = Number(d[s.key]) || 0;
        if (v > max) max = v;
      }
    }
    return max;
  }, [data, series]);

  const yTicks = useMemo(() => computeYTicks(maxVal), [maxVal]);
  const yMax = yTicks[yTicks.length - 1] || 1;

  if (containerWidth === 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  const pointGap = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const getPath = (s: LineChartSeries) => {
    return data
      .map((d, i) => {
        const x = i * pointGap;
        const y = chartHeight - ((Number(d[s.key]) || 0) / yMax) * chartHeight;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - margin.left;
    const idx = Math.round(mx / pointGap);
    if (idx < 0 || idx >= data.length) {
      setHoverIdx(null);
      return;
    }
    setHoverIdx(idx);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg width={containerWidth} height={height}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid */}
          {showGrid &&
            yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={chartWidth}
                y1={chartHeight - (tick / yMax) * chartHeight}
                y2={chartHeight - (tick / yMax) * chartHeight}
                stroke="#f0f0f0"
                strokeDasharray="3 3"
              />
            ))}

          {/* Y labels */}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={-8}
              y={chartHeight - (tick / yMax) * chartHeight + 4}
              textAnchor="end"
              className="fill-gray-500"
              fontSize={10}
            >
              {yAxisFormatter(tick)}
            </text>
          ))}

          {/* Lines */}
          {series.map((s) => (
            <path
              key={s.key}
              d={getPath(s)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.strokeWidth || 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Hover dots */}
          {hoverIdx !== null &&
            series.map((s) => {
              const val = Number(data[hoverIdx][s.key]) || 0;
              const cx = hoverIdx * pointGap;
              const cy = chartHeight - (val / yMax) * chartHeight;
              return <circle key={s.key} cx={cx} cy={cy} r={4} fill={s.color} stroke="white" strokeWidth={2} />;
            })}

          {/* Hover vertical line */}
          {hoverIdx !== null && (
            <line
              x1={hoverIdx * pointGap}
              x2={hoverIdx * pointGap}
              y1={0}
              y2={chartHeight}
              stroke="#d1d5db"
              strokeDasharray="3 3"
            />
          )}

          {/* X labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={i * pointGap}
              y={chartHeight + 18}
              textAnchor="middle"
              className="fill-gray-500"
              fontSize={11}
            >
              {String(d[categoryKey])}
            </text>
          ))}

          <line x1={0} x2={chartWidth} y1={chartHeight} y2={chartHeight} stroke="#e5e7eb" />
        </g>
      </svg>

      {/* Hover overlay */}
      <div
        className="absolute inset-0"
        style={{ left: margin.left, top: margin.top, width: chartWidth, height: chartHeight }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      />

      {/* Tooltip */}
      {hoverIdx !== null && (
        <ChartTooltip x={mousePos.x} y={mousePos.y} visible containerWidth={containerWidth}>
          <p className="font-medium text-gray-900 mb-1">{String(data[hoverIdx][categoryKey])}</p>
          {series.map((s) => {
            const val = Number(data[hoverIdx][s.key]) || 0;
            return (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-600">{s.label}</span>
                </div>
                <span className="font-medium text-gray-900">
                  {tooltipFormatter ? tooltipFormatter(val) : val.toLocaleString()}
                </span>
              </div>
            );
          })}
        </ChartTooltip>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-600">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVGPieChart ─────────────────────────────────────────────────────

export interface PieSlice {
  name: string;
  value: number;
  color: string;
}

export interface SVGPieChartProps {
  data: PieSlice[];
  height?: number;
  showLabels?: boolean;
  tooltipFormatter?: (value: number, name: string) => string;
  innerRadius?: number;
  outerRadius?: number;
}

export function SVGPieChart({
  data,
  height = 220,
  showLabels = true,
  tooltipFormatter,
  innerRadius = 0,
  outerRadius: outerRadiusProp,
}: SVGPieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (containerWidth === 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  const cx = containerWidth / 2;
  const cy = height / 2;
  const outerRadius = outerRadiusProp || Math.min(cx, cy) - 30;

  // Build arc paths
  let startAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = total > 0 ? (d.value / total) * 2 * Math.PI : 0;
    const endAngle = startAngle + angle;
    const midAngle = startAngle + angle / 2;

    const largeArc = angle > Math.PI ? 1 : 0;

    const x1Outer = cx + outerRadius * Math.cos(startAngle);
    const y1Outer = cy + outerRadius * Math.sin(startAngle);
    const x2Outer = cx + outerRadius * Math.cos(endAngle);
    const y2Outer = cy + outerRadius * Math.sin(endAngle);

    let path: string;
    if (innerRadius > 0) {
      const x1Inner = cx + innerRadius * Math.cos(endAngle);
      const y1Inner = cy + innerRadius * Math.sin(endAngle);
      const x2Inner = cx + innerRadius * Math.cos(startAngle);
      const y2Inner = cy + innerRadius * Math.sin(startAngle);

      path = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
        'Z',
      ].join(' ');
    } else {
      path = [
        `M ${cx} ${cy}`,
        `L ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        'Z',
      ].join(' ');
    }

    // Label position
    const labelRadius = outerRadius + 16;
    const labelX = cx + labelRadius * Math.cos(midAngle);
    const labelY = cy + labelRadius * Math.sin(midAngle);

    const result = { path, midAngle, labelX, labelY, ...d };
    startAngle = endAngle;
    return result;
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg width={containerWidth} height={height}>
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth={2}
              opacity={hoverIdx !== null && hoverIdx !== i ? 0.6 : 1}
              onMouseEnter={() => setHoverIdx(i)}
              className="cursor-pointer transition-opacity duration-150"
            />
            {showLabels && slice.value > 0 && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                textAnchor={slice.labelX > cx ? 'start' : 'end'}
                dominantBaseline="middle"
                className="fill-gray-600"
                fontSize={10}
              >
                {slice.name} {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
              </text>
            )}
          </g>
        ))}
      </svg>

      {hoverIdx !== null && data[hoverIdx] && (
        <ChartTooltip x={mousePos.x} y={mousePos.y} visible containerWidth={containerWidth}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: data[hoverIdx].color }} />
            <span className="font-medium text-gray-900">{data[hoverIdx].name}</span>
          </div>
          <p className="text-gray-600 mt-0.5">
            {tooltipFormatter
              ? tooltipFormatter(data[hoverIdx].value, data[hoverIdx].name)
              : `${data[hoverIdx].value}${total > 0 ? ` (${Math.round((data[hoverIdx].value / total) * 100)}%)` : ''}`}
          </p>
        </ChartTooltip>
      )}
    </div>
  );
}

// ─── SVGAreaSparkline ────────────────────────────────────────────────

export interface SparklineDataPoint {
  value: number;
  label?: string;
}

export interface SVGAreaSparklineProps {
  data: SparklineDataPoint[];
  width?: number;
  height?: number;
  color: string;
  gradientId?: string;
  showTooltip?: boolean;
}

export function SVGAreaSparkline({
  data,
  width = 80,
  height = 24,
  color,
  gradientId: gradientIdProp,
  showTooltip = true,
}: SVGAreaSparklineProps) {
  const autoId = useId();
  const gradientId = gradientIdProp || `spark-${autoId.replace(/:/g, '')}`;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (data.length < 2) return null;

  const minVal = Math.min(...data.map((d) => d.value));
  const maxVal = Math.max(...data.map((d) => d.value));
  const range = maxVal - minVal || 1;
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * innerW,
    y: padding + innerH - ((d.value - minVal) / range) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const idx = Math.round(((mx - padding) / innerW) * (data.length - 1));
    if (idx >= 0 && idx < data.length) {
      setHoverIdx(idx);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      style={{ width, height }}
      onMouseMove={showTooltip ? handleMouseMove : undefined}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg width={width} height={height}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {hoverIdx !== null && points[hoverIdx] && (
          <circle cx={points[hoverIdx].x} cy={points[hoverIdx].y} r={2.5} fill={color} stroke="white" strokeWidth={1} />
        )}
      </svg>

      {showTooltip && hoverIdx !== null && data[hoverIdx] && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white shadow-md rounded px-2 py-1 border text-[10px] whitespace-nowrap pointer-events-none z-50"
        >
          <span className="font-medium text-gray-700">{Math.round(data[hoverIdx].value * 100)}%</span>
          {data[hoverIdx].label && <span className="text-gray-400 ml-1">{data[hoverIdx].label}</span>}
        </div>
      )}
    </div>
  );
}
