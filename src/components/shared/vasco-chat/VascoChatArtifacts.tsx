import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { SVGBarChart, SVGLineChart } from '../../ui/svg-charts';
import type {
  VascoChatArtifact,
  VascoArtifactMetric,
  VascoBarChartArtifact,
  VascoLineChartArtifact,
  VascoTableArtifact,
} from './types';

function formatValueFactory(format?: 'currency' | 'percent' | 'number') {
  if (format === 'currency') {
    return (value: number) =>
      new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        maximumFractionDigits: 0,
      }).format(value);
  }

  if (format === 'percent') {
    return (value: number) => `${value.toFixed(1)}%`;
  }

  return (value: number) => value.toLocaleString();
}

function MetricCard({ metric }: { metric: VascoArtifactMetric }) {
  const toneClass =
    metric.tone === 'positive'
      ? 'border-green-200 bg-green-50 text-green-900'
      : metric.tone === 'negative'
        ? 'border-red-200 bg-red-50 text-red-900'
        : metric.tone === 'accent'
          ? 'border-[#6d28d9]/20 bg-[#6d28d9]/5 text-[#4c1d95]'
          : 'border-gray-200 bg-gray-50 text-gray-900';

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current/70">{metric.label}</p>
      <p className="mt-1 text-lg font-semibold text-current">{metric.value}</p>
      {metric.helper && <p className="mt-1 text-xs text-current/70">{metric.helper}</p>}
    </div>
  );
}

function ArtifactTitle({ title }: { title?: string }) {
  if (!title) return null;
  return <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{title}</p>;
}

function ArtifactTable({ artifact }: { artifact: VascoTableArtifact }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <ArtifactTitle title={artifact.title} />
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {artifact.columns.map((column) => (
                <TableHead key={column} className="text-gray-700">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {artifact.rows.map((row, index) => (
              <TableRow key={`${artifact.title || 'table'}-${index}`}>
                {artifact.columns.map((column) => (
                  <TableCell key={`${column}-${index}`} className="text-gray-900">
                    {row[column] ?? '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ArtifactLineChart({ artifact }: { artifact: VascoLineChartArtifact }) {
  const formatter = formatValueFactory(artifact.valueFormat);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <ArtifactTitle title={artifact.title} />
      <SVGLineChart
        data={artifact.data}
        categoryKey={artifact.categoryKey}
        series={artifact.series.map((series, index) => ({
          key: series.key,
          label: series.label,
          color: series.color || ['#6d28d9', '#0f766e', '#2563eb', '#ea580c'][index % 4],
        }))}
        yAxisFormatter={formatter}
        tooltipFormatter={formatter}
      />
    </div>
  );
}

function ArtifactBarChart({ artifact }: { artifact: VascoBarChartArtifact }) {
  const formatter = formatValueFactory(artifact.valueFormat);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <ArtifactTitle title={artifact.title} />
      <SVGBarChart
        data={artifact.data}
        categoryKey={artifact.categoryKey}
        series={artifact.series.map((series, index) => ({
          key: series.key,
          label: series.label,
          color: series.color || ['#6d28d9', '#0f766e', '#2563eb', '#ea580c'][index % 4],
        }))}
        yAxisFormatter={formatter}
        tooltipFormatter={formatter}
      />
    </div>
  );
}

export function VascoChatArtifacts({ artifacts }: { artifacts?: VascoChatArtifact[] }) {
  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {artifacts.map((artifact, index) => {
        if (artifact.type === 'metric_cards') {
          return (
            <div key={`metric-cards-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <ArtifactTitle title={artifact.title} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {artifact.metrics.map((metric, metricIndex) => (
                  <MetricCard key={`${metric.label}-${metricIndex}`} metric={metric} />
                ))}
              </div>
            </div>
          );
        }

        if (artifact.type === 'assumptions') {
          return (
            <div key={`assumptions-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <ArtifactTitle title={artifact.title || 'Projection Assumptions'} />
              <div className="space-y-2">
                {artifact.items.map((item, itemIndex) => (
                  <div
                    key={`${item.label}-${itemIndex}`}
                    className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
                    </div>
                    <p className="text-sm font-semibold text-[#4c1d95]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (artifact.type === 'projection_note') {
          const toneClass =
            artifact.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : artifact.tone === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-gray-200 bg-gray-50 text-gray-900';

          return (
            <div key={`projection-note-${index}`} className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
              <ArtifactTitle title={artifact.title || 'Projection Note'} />
              <p className="text-sm leading-relaxed">{artifact.body}</p>
            </div>
          );
        }

        if (artifact.type === 'table') {
          return <ArtifactTable key={`table-${index}`} artifact={artifact} />;
        }

        if (artifact.type === 'line_chart') {
          return <ArtifactLineChart key={`line-chart-${index}`} artifact={artifact} />;
        }

        if (artifact.type === 'bar_chart') {
          return <ArtifactBarChart key={`bar-chart-${index}`} artifact={artifact} />;
        }

        return null;
      })}
    </div>
  );
}
