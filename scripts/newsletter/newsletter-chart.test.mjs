// Run with: npm run newsletter:test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChart, niceStep } from './newsletter-chart.mjs';

const labels = ['Jan', 'Feb', 'Mar'];

test('draws one polyline and one end dot per series, and a legend entry each', () => {
  const { svg, legend } = buildChart({
    labels,
    series: [
      { name: 'CPI', values: [3.1, 3.4, 3.0] },
      { name: 'Repo rate', values: [7, 7, 6.75] },
    ],
  });
  assert.equal(svg.match(/<polyline /g).length, 2);
  assert.equal(svg.match(/<circle /g).length, 2);
  assert.match(legend, /CPI/);
  assert.match(legend, /Repo rate/);
});

test('refuses a series whose length does not match the labels', () => {
  assert.throws(
    () => buildChart({ labels, series: [{ name: 'X', values: [1, 2] }] }),
    /exactly 3 values/,
  );
});

test('refuses values outside an explicit axis range', () => {
  assert.throws(
    () => buildChart({ labels, series: [{ name: 'X', values: [1, 2, 9] }], yMin: 0, yMax: 5 }),
    /outside yMin/,
  );
});

test('refuses non-numeric values and more than three series', () => {
  assert.throws(
    () => buildChart({ labels, series: [{ name: 'X', values: [1, '2', 3] }] }),
    /not a number/,
  );
  const s = { name: 'S', values: [1, 2, 3] };
  assert.throws(() => buildChart({ labels, series: [s, s, s, s] }), /1 to 3 series/);
});

test('escapes text so names cannot inject markup', () => {
  const { svg, legend } = buildChart({
    labels: ['<b>', 'b'],
    series: [{ name: 'A & <B>', values: [1, 2] }],
  });
  assert.doesNotMatch(svg, /<b>/);
  assert.match(legend, /A &amp; &lt;B&gt;/);
});

test('adds a unit to the y-axis labels', () => {
  const { svg } = buildChart({ labels, series: [{ name: 'CPI', values: [3, 4, 5] }], unit: '%' });
  assert.match(svg, />4%</);
});

test('picks a round tick step', () => {
  assert.equal(niceStep(20), 5);
  assert.equal(niceStep(4), 1);
  assert.equal(niceStep(1.2), 0.25);
});
