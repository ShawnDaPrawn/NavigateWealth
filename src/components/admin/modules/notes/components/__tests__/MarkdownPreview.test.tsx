import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../MarkdownPreview';

describe('MarkdownPreview', () => {
  it('renders without crashing', () => {
    const { container } = render(<MarkdownPreview content="" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders plain text content', () => {
    render(<MarkdownPreview content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('renders bold text', () => {
    const { container } = render(<MarkdownPreview content="**bold text**" />);
    expect(container.querySelector('strong')).toBeDefined();
  });

  it('renders italic text', () => {
    const { container } = render(<MarkdownPreview content="*italic text*" />);
    expect(container.querySelector('em')).toBeDefined();
  });

  it('renders heading', () => {
    const { container } = render(<MarkdownPreview content="# Heading One" />);
    expect(container.querySelector('h1')).toBeDefined();
  });

  it('renders h2 heading', () => {
    const { container } = render(<MarkdownPreview content="## Heading Two" />);
    expect(container.querySelector('h2')).toBeDefined();
  });

  it('renders unordered list', () => {
    const { container } = render(<MarkdownPreview content="- item one\n- item two" />);
    expect(container.querySelector('ul')).toBeDefined();
  });

  it('renders ordered list', () => {
    const { container } = render(<MarkdownPreview content="1. first\n2. second" />);
    expect(container.querySelector('ol')).toBeDefined();
  });

  it('renders blockquote', () => {
    const { container } = render(<MarkdownPreview content="> quoted text" />);
    expect(container.querySelector('blockquote')).toBeDefined();
  });

  it('renders inline code', () => {
    const { container } = render(<MarkdownPreview content="`code snippet`" />);
    expect(container.querySelector('code')).toBeDefined();
  });

  it('renders horizontal rule', () => {
    const { container } = render(<MarkdownPreview content="---" />);
    expect(container.querySelector('hr')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<MarkdownPreview content="text" className="my-custom" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('my-custom');
  });

  it('renders non-empty container with content', () => {
    const { container } = render(<MarkdownPreview content="Some content here" />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
