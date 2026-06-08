import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlashCommandMenu } from '../SlashCommandMenu';
import type { Editor } from '@tiptap/react';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mockEditor = {
  state: { selection: { from: 0, to: 0 }, doc: { textBetween: vi.fn().mockReturnValue('') } },
  chain: () => ({
    focus: () => ({
      setParagraph: () => ({ run: vi.fn() }),
      deleteRange: () => ({ run: vi.fn() }),
    }),
  }),
} as unknown as Editor;

const position = { top: 100, left: 200 };

describe('SlashCommandMenu', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <SlashCommandMenu
        editor={mockEditor}
        isOpen={false}
        onClose={vi.fn()}
        query=""
        position={position}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders menu items when open with empty query', () => {
    render(
      <SlashCommandMenu
        editor={mockEditor}
        isOpen
        onClose={vi.fn()}
        query=""
        position={position}
      />,
    );
    expect(screen.getByText('Paragraph')).toBeDefined();
  });

  it('renders Heading 1 item', () => {
    render(
      <SlashCommandMenu
        editor={mockEditor}
        isOpen
        onClose={vi.fn()}
        query=""
        position={position}
      />,
    );
    expect(screen.getByText('Heading 1')).toBeDefined();
  });

  it('filters items by query', () => {
    render(
      <SlashCommandMenu
        editor={mockEditor}
        isOpen
        onClose={vi.fn()}
        query="heading"
        position={position}
      />,
    );
    expect(screen.queryByText('Paragraph')).toBeNull();
    expect(screen.getAllByText(/heading/i).length).toBeGreaterThan(0);
  });

  it('returns null when query matches nothing', () => {
    const { container } = render(
      <SlashCommandMenu
        editor={mockEditor}
        isOpen
        onClose={vi.fn()}
        query="xyznonexistent"
        position={position}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders non-empty container when open', () => {
    const { container } = render(
      <SlashCommandMenu
        editor={mockEditor}
        isOpen
        onClose={vi.fn()}
        query=""
        position={position}
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
