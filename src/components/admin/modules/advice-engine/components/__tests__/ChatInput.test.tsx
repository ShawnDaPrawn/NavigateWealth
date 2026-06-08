import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('renders textarea', () => {
    render(<ChatInput value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('renders current value in textarea', () => {
    render(<ChatInput value="Hello" onChange={() => {}} onSubmit={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello');
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<ChatInput value="" onChange={onChange} onSubmit={() => {}} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New text' } });
    expect(onChange).toHaveBeenCalledWith('New text');
  });

  it('calls onSubmit when send button is clicked', () => {
    const onSubmit = vi.fn();
    render(<ChatInput value="Hello" onChange={() => {}} onSubmit={onSubmit} />);
    const sendBtn = screen.getByRole('button');
    fireEvent.click(sendBtn);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('shows loading state when isLoading=true', () => {
    const { container } = render(
      <ChatInput value="" onChange={() => {}} onSubmit={() => {}} isLoading={true} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('disables send button when value is empty', () => {
    render(<ChatInput value="" onChange={() => {}} onSubmit={() => {}} />);
    const sendBtn = screen.getByRole('button');
    expect(sendBtn.hasAttribute('disabled')).toBe(true);
  });
});
