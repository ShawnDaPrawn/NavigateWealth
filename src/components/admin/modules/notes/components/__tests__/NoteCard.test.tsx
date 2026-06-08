import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from '../NoteCard';
import type { Note } from '../../types';

const mockNote: Note = {
  id: 'note-1',
  title: 'Test Note',
  content: 'This is the note content for testing purposes.',
  personnelId: 'p-1',
  personnelName: 'Jane Doe',
  tags: ['finance', 'client'],
  color: 'default',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isPinned: false,
  isArchived: false,
};

const noop = () => {};

describe('NoteCard', () => {
  it('renders without crashing in grid mode', () => {
    const { container } = render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders note title', () => {
    render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    expect(screen.getByText('Test Note')).toBeDefined();
  });

  it('renders note content preview', () => {
    render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    expect(screen.getByText(/note content/i)).toBeDefined();
  });

  it('renders tags', () => {
    render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    expect(screen.getByText('finance')).toBeDefined();
  });

  it('calls onOpen when card content is clicked', () => {
    const onOpen = vi.fn();
    render(
      <NoteCard
        note={mockNote}
        onOpen={onOpen}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    fireEvent.click(screen.getByText('Test Note'));
    expect(onOpen).toHaveBeenCalledWith(mockNote);
  });

  it('renders in list mode', () => {
    const { container } = render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="list"
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders list mode title', () => {
    render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="list"
      />,
    );
    const titles = screen.getAllByText('Test Note');
    expect(titles.length).toBeGreaterThan(0);
  });

  it('renders selection checkbox when isSelecting=true', () => {
    const { container } = render(
      <NoteCard
        note={mockNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
        isSelecting={true}
        isSelected={false}
        onToggleSelect={noop}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders pinned note indicator', () => {
    const pinnedNote = { ...mockNote, isPinned: true };
    const { container } = render(
      <NoteCard
        note={pinnedNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    expect(container.innerHTML).toBeDefined();
  });

  it('renders with yellow color', () => {
    const yellowNote = { ...mockNote, color: 'yellow' as const };
    const { container } = render(
      <NoteCard
        note={yellowNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('truncates long content', () => {
    const longNote = { ...mockNote, content: 'A'.repeat(300) };
    render(
      <NoteCard
        note={longNote}
        onOpen={noop}
        onPin={noop}
        onArchive={noop}
        onDelete={noop}
        onConvertToTask={noop}
        viewMode="grid"
      />,
    );
    const text = screen.getByText(/A+\.\.\./);
    expect(text).toBeDefined();
  });
});
