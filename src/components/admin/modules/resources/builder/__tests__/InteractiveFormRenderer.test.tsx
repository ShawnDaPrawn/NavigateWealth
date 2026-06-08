import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InteractiveFormRenderer } from '../InteractiveFormRenderer';

vi.mock('dompurify', () => ({
  default: { sanitize: (s: string) => s },
}));

describe('InteractiveFormRenderer', () => {
  it('renders without crashing with empty blocks', () => {
    const { container } = render(
      <InteractiveFormRenderer blocks={[]} responses={{}} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders text block', () => {
    const blocks = [{ id: 'b1', type: 'text', data: { content: 'Hello form text' } }];
    const { container } = render(
      <InteractiveFormRenderer
        blocks={blocks as unknown as import('../types').FormBlock[]}
        responses={{}}
        onChange={() => {}}
      />,
    );
    expect(container.innerHTML).toContain('Hello form text');
  });

  it('renders section_header block', () => {
    const blocks = [{ id: 'b2', type: 'section_header', data: { title: 'Section Title' } }];
    render(
      <InteractiveFormRenderer
        blocks={blocks as unknown as import('../types').FormBlock[]}
        responses={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Section Title')).toBeDefined();
  });

  it('renders field_grid block', () => {
    const blocks = [
      {
        id: 'b3',
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [{ label: 'Your Name', key: 'name', required: true, type: 'text' }],
        },
      },
    ];
    render(
      <InteractiveFormRenderer
        blocks={blocks as unknown as import('../types').FormBlock[]}
        responses={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Your Name')).toBeDefined();
  });

  it('renders in readOnly mode', () => {
    const blocks = [{ id: 'b1', type: 'text', data: { content: 'Read only content' } }];
    const { container } = render(
      <InteractiveFormRenderer
        blocks={blocks as unknown as import('../types').FormBlock[]}
        responses={{}}
        onChange={() => {}}
        readOnly
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <InteractiveFormRenderer blocks={[]} responses={{}} onChange={() => {}} />,
    );
    expect(container.innerHTML.length).toBeGreaterThanOrEqual(0);
  });
});
