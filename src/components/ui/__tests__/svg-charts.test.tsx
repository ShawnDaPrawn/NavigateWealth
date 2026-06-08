import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SVGBarChart, SVGLineChart, SVGPieChart, SVGAreaSparkline } from '../svg-charts';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SVGBarChart', () => {
  const data = [
    { month: 'Jan', revenue: 1000, expenses: 800 },
    { month: 'Feb', revenue: 1200, expenses: 900 },
    { month: 'Mar', revenue: 900, expenses: 700 },
  ];
  const series = [
    { key: 'revenue', label: 'Revenue', color: '#6d28d9' },
    { key: 'expenses', label: 'Expenses', color: '#dc2626' },
  ];

  it('renders without crashing', () => {
    const { container } = render(<SVGBarChart data={data} categoryKey="month" series={series} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with empty data', () => {
    const { container } = render(<SVGBarChart data={[]} categoryKey="month" series={series} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders without legend when showLegend=false', () => {
    const { container } = render(
      <SVGBarChart data={data} categoryKey="month" series={series} showLegend={false} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders without grid when showGrid=false', () => {
    const { container } = render(
      <SVGBarChart data={data} categoryKey="month" series={series} showGrid={false} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom height', () => {
    const { container } = render(
      <SVGBarChart data={data} categoryKey="month" series={series} height={400} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders with yAxisFormatter', () => {
    const { container } = render(
      <SVGBarChart
        data={data}
        categoryKey="month"
        series={series}
        yAxisFormatter={(v) => `R${v}`}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders with barColorFn', () => {
    const { container } = render(
      <SVGBarChart data={data} categoryKey="month" series={series} barColorFn={() => '#ff0000'} />,
    );
    expect(container.firstChild).toBeDefined();
  });
});

describe('SVGLineChart', () => {
  const data = [
    { month: 'Jan', value: 100 },
    { month: 'Feb', value: 150 },
    { month: 'Mar', value: 120 },
  ];
  const series = [{ key: 'value', label: 'Value', color: '#6d28d9' }];

  it('renders without crashing', () => {
    const { container } = render(<SVGLineChart data={data} categoryKey="month" series={series} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with empty data', () => {
    const { container } = render(<SVGLineChart data={[]} categoryKey="month" series={series} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom height', () => {
    const { container } = render(
      <SVGLineChart data={data} categoryKey="month" series={series} height={350} />,
    );
    expect(container.firstChild).toBeDefined();
  });
});

describe('SVGPieChart', () => {
  const data = [
    { name: 'Equity', value: 60, color: '#6d28d9' },
    { name: 'Bonds', value: 30, color: '#7c3aed' },
    { name: 'Cash', value: 10, color: '#a78bfa' },
  ];

  it('renders without crashing', () => {
    const { container } = render(<SVGPieChart data={data} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with empty data', () => {
    const { container } = render(<SVGPieChart data={[]} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders without labels when showLabels=false', () => {
    const { container } = render(<SVGPieChart data={data} showLabels={false} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders as donut chart with innerRadius', () => {
    const { container } = render(<SVGPieChart data={data} innerRadius={60} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with tooltipFormatter', () => {
    const { container } = render(
      <SVGPieChart data={data} tooltipFormatter={(v, n) => `${n}: ${v}%`} />,
    );
    expect(container.firstChild).toBeDefined();
  });
});

describe('SVGAreaSparkline', () => {
  const data = [
    { date: '2026-01', value: 100 },
    { date: '2026-02', value: 120 },
    { date: '2026-03', value: 110 },
    { date: '2026-04', value: 140 },
  ];

  it('renders without crashing', () => {
    const { container } = render(<SVGAreaSparkline data={data} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with empty data', () => {
    const { container } = render(<SVGAreaSparkline data={[]} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom color', () => {
    const { container } = render(<SVGAreaSparkline data={data} color="#6d28d9" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom height', () => {
    const { container } = render(<SVGAreaSparkline data={data} height={100} />);
    expect(container.firstChild).toBeDefined();
  });
});
