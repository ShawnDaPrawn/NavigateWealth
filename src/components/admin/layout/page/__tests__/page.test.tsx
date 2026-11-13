import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach } from 'vitest';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import {
  PageHeader,
  StatCard,
  NavTabsList,
  NavTabsTrigger,
  SegmentedList,
  SegmentedTrigger,
  useUrlState,
} from '..';

afterEach(() => cleanup());

function Location() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

const TABS = ['one', 'two'] as const;
function Harness() {
  const [tab, setTab] = useUrlState('tab', 'one', TABS);
  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
        <NavTabsList aria-label="Demo">
          <NavTabsTrigger value="one" count={3}>
            One
          </NavTabsTrigger>
          <NavTabsTrigger value="two">Two</NavTabsTrigger>
        </NavTabsList>
        <TabsContent value="one">first</TabsContent>
        <TabsContent value="two">second</TabsContent>
      </Tabs>
      <Location />
    </>
  );
}

describe('admin page components', () => {
  it('PageHeader shows the title as the page heading, the description and actions', () => {
    render(
      <PageHeader title="E-Signature" description="Envelopes" actions={<button>New</button>} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'E-Signature' })).toBeDefined();
    expect(screen.getByText('Envelopes')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New' })).toBeDefined();
  });

  it('StatCard shows its label, value and meta', () => {
    render(<StatCard label="Drafts" value={4} meta="Not yet sent" tone="attention" />);
    expect(screen.getByText('Drafts')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('Not yet sent').className).toContain('amber');
  });

  it('keeps the open tab in the address bar and ignores unknown values', () => {
    render(
      <MemoryRouter initialEntries={['/admin?module=esign&tab=bogus']}>
        <Harness />
      </MemoryRouter>,
    );
    expect(screen.getByText('first')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByText('second')).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=esign&tab=two');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /One/ }));
    expect(screen.getByTestId('search').textContent).toBe('?module=esign');
  });

  it('opens on the tab named in the address', () => {
    render(
      <MemoryRouter initialEntries={['/admin?tab=two']}>
        <Harness />
      </MemoryRouter>,
    );
    expect(screen.getByText('second')).toBeDefined();
  });

  it('SegmentedList renders its options as tabs', () => {
    const onValueChange = vi.fn();
    render(
      <Tabs value="a" onValueChange={onValueChange}>
        <SegmentedList aria-label="Sub">
          <SegmentedTrigger value="a">A</SegmentedTrigger>
          <SegmentedTrigger value="b">B</SegmentedTrigger>
        </SegmentedList>
      </Tabs>,
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'B' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});
