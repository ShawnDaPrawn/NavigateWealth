/**
 * The newsletter's line chart, drawn from data.
 *
 * The markets page carries one line chart. Plotting it by hand each month is
 * where mistakes creep in, so an issue's content file gives the numbers and
 * this module draws the SVG and its legend in the template's style: up to
 * three series, the first in ink with a light area under it, the second in
 * violet, the third in warm grey.
 *
 * Pure functions, no DOM: render-newsletter.mjs calls buildChart() and sets
 * the result into the template's chart.svg and chart.legend slots.
 */

export const CHART_COLOURS = ['#0d1626', '#6d28d9', '#b9b2a4'];

const W = 600;
const H = 230;
const LEFT = 34;
const RIGHT = 14;
const TOP = 12;
const BOTTOM = 26;
/** More gridlines than this would be unreadable, and a tiny step would never finish. */
const MAX_TICKS = 40;

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A tick step of 1, 2, 2.5 or 5 × 10^n giving about five gridlines. */
export function niceStep(span) {
  const raw = span / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / magnitude;
  const factor = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return factor * magnitude;
}

function formatTick(value, step) {
  const decimals = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2;
  return Number(value.toFixed(decimals)).toString();
}

/**
 * @param {{
 *   labels: string[],
 *   series: { name: string, values: number[] }[],
 *   yMin?: number, yMax?: number, yStep?: number,
 *   baseline?: number,
 *   unit?: string,
 *   annotation?: { index: number, series?: number, text: string },
 *   ariaLabel?: string,
 * }} chart
 * @returns {{ svg: string, legend: string }}
 */
export function buildChart(chart) {
  const { labels, series } = chart ?? {};
  if (!Array.isArray(labels) || labels.length < 2 || labels.length > 24) {
    throw new Error('chart.labels must list 2 to 24 x-axis labels');
  }
  if (!Array.isArray(series) || series.length < 1 || series.length > CHART_COLOURS.length) {
    throw new Error(`chart.series must hold 1 to ${CHART_COLOURS.length} series`);
  }
  for (const s of series) {
    if (!s || typeof s.name !== 'string' || !s.name.trim()) {
      throw new Error('every chart series needs a name');
    }
    if (!Array.isArray(s.values) || s.values.length !== labels.length) {
      throw new Error(`chart series "${s.name}" needs exactly ${labels.length} values`);
    }
    if (!s.values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error(`chart series "${s.name}" has a value that is not a number`);
    }
  }

  const all = series.flatMap((s) => s.values);
  if (typeof chart.baseline === 'number') all.push(chart.baseline);
  const dataMin = Math.min(...all);
  const dataMax = Math.max(...all);
  const step = chart.yStep ?? niceStep(dataMax - dataMin || Math.abs(dataMax) || 1);
  if (typeof step !== 'number' || !Number.isFinite(step) || step <= 0) {
    throw new Error('chart.yStep must be a positive number');
  }
  for (const bound of ['yMin', 'yMax']) {
    if (chart[bound] !== undefined && !Number.isFinite(chart[bound])) {
      throw new Error(`chart.${bound} must be a number`);
    }
  }
  const yMin = chart.yMin ?? Math.floor(dataMin / step) * step;
  let yMax = chart.yMax ?? Math.ceil(dataMax / step) * step;
  if (yMax <= yMin) yMax = yMin + step;
  if ((yMax - yMin) / step > MAX_TICKS) {
    throw new Error(
      `chart.yStep ${step} gives more than ${MAX_TICKS} gridlines; use a larger step`,
    );
  }
  if (dataMin < yMin || dataMax > yMax) {
    throw new Error(`chart values run outside yMin ${yMin} to yMax ${yMax}`);
  }

  const plotW = W - LEFT - RIGHT;
  const plotH = H - TOP - BOTTOM;
  const x = (i) => LEFT + (i * plotW) / (labels.length - 1);
  const y = (v) => TOP + ((yMax - v) * plotH) / (yMax - yMin);
  const r = (n) => Number(n.toFixed(1));
  const unit = chart.unit ?? '';

  const ticks = [];
  for (let t = yMin; t <= yMax + step / 1000; t += step) ticks.push(t);

  const parts = [];
  parts.push(
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(
      chart.ariaLabel ?? `Line chart of ${series.map((s) => s.name).join(', ')}`,
    )}">`,
  );
  parts.push('<g stroke="#ece7de" stroke-width="1">');
  for (const t of ticks) {
    if (typeof chart.baseline === 'number' && Math.abs(t - chart.baseline) < step / 1000) continue;
    parts.push(`<line x1="${LEFT}" y1="${r(y(t))}" x2="${W - RIGHT}" y2="${r(y(t))}" />`);
  }
  parts.push('</g>');
  if (typeof chart.baseline === 'number') {
    const by = r(y(chart.baseline));
    parts.push(
      `<line x1="${LEFT}" y1="${by}" x2="${W - RIGHT}" y2="${by}" stroke="#b9b2a4" stroke-dasharray="2 3" />`,
    );
  }
  parts.push('<g text-anchor="end">');
  for (const t of ticks) {
    parts.push(
      `<text x="${LEFT - 6}" y="${r(y(t) + 3)}">${escapeXml(formatTick(t, step) + unit)}</text>`,
    );
  }
  parts.push('</g>');
  parts.push('<g text-anchor="middle">');
  labels.forEach((label, i) => {
    parts.push(`<text x="${r(x(i))}" y="${H - 8}">${escapeXml(label)}</text>`);
  });
  parts.push('</g>');

  const points = (s) => s.values.map((v, i) => `${r(x(i))},${r(y(v))}`).join(' ');
  const first = series[0];
  parts.push(
    `<path d="M${first.values.map((v, i) => `${r(x(i))},${r(y(v))}`).join(' L')} L${r(
      x(labels.length - 1),
    )},${r(y(yMin))} L${LEFT},${r(y(yMin))} Z" fill="#0d1626" fill-opacity="0.04" />`,
  );
  // Draw back to front so the first series sits on top.
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const width = i === 0 ? 2.2 : i === 1 ? 1.8 : 1.6;
    parts.push(
      `<polyline fill="none" stroke="${CHART_COLOURS[i]}" stroke-width="${width}" stroke-linejoin="round" points="${points(series[i])}" />`,
    );
  }
  series.forEach((s, i) => {
    const last = s.values.length - 1;
    parts.push(
      `<circle cx="${r(x(last))}" cy="${r(y(s.values[last]))}" r="3" fill="${CHART_COLOURS[i]}" />`,
    );
  });

  if (chart.annotation) {
    const { index, text } = chart.annotation;
    const si = chart.annotation.series ?? 0;
    if (!Number.isInteger(index) || index < 0 || index >= labels.length || !series[si]) {
      throw new Error('chart.annotation needs a valid index and series');
    }
    const ax = r(x(index));
    const ay = r(y(series[si].values[index]));
    // Label a dip from below and a peak from above, away from the lines.
    const vals = series[si].values;
    const prev = vals[index - 1] ?? vals[index];
    const next = vals[index + 1] ?? vals[index];
    const below = vals[index] <= Math.min(prev, next) && ay + 14 <= TOP + plotH;
    const ty = below ? ay + 14 : Math.max(TOP + 8, ay - 10);
    const anchor = index > labels.length * 0.66 ? 'end' : 'start';
    const tx = anchor === 'end' ? ax - 6 : ax + 6;
    parts.push(
      `<line x1="${ax}" y1="${ay}" x2="${ax}" y2="${below ? ay + 12 : ay - 12}" stroke="#6d28d9" stroke-width="1" />`,
    );
    parts.push(
      `<text x="${tx}" y="${r(ty)}" text-anchor="${anchor}" style="fill: #6d28d9; font-weight: 600">${escapeXml(text)}</text>`,
    );
  }
  parts.push('</svg>');

  const legend = series
    .map(
      (s, i) => `<span><i style="background: ${CHART_COLOURS[i]}"></i>${escapeXml(s.name)}</span>`,
    )
    .join('');

  return { svg: parts.join(''), legend };
}
