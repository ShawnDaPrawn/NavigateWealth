import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bold01, TextEditor, TextEditorButton, VideoPlayer, formatVideoTime } from '../index';

describe('Untitled UI TextEditor', () => {
  let exec: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    // jsdom has no editing commands; record what the editor asks for.
    exec = vi.fn(() => true);
    Object.assign(document, { execCommand: exec, queryCommandState: vi.fn(() => false) });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
    Reflect.deleteProperty(document, 'queryCommandState');
  });

  it('renders a labelled multi-line textbox with a formatting toolbar and hint', () => {
    render(<TextEditor label="Notes" hint="964 characters left" size="sm" />);
    const box = screen.getByRole('textbox', { name: 'Notes' });
    expect(box.getAttribute('aria-multiline')).toBe('true');
    expect(box.getAttribute('contenteditable')).toBe('true');
    expect(document.getElementById(box.getAttribute('aria-describedby')!)?.textContent).toBe(
      '964 characters left',
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
    expect(toolbar.querySelectorAll('button')).toHaveLength(8);
    expect(box.closest('.uui-text-editor')?.getAttribute('data-size')).toBe('sm');
  });

  it('applies formatting from the toolbar and the keyboard', () => {
    render(<TextEditor aria-label="Body" />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(exec).toHaveBeenCalledWith('bold', false, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(exec).toHaveBeenCalledWith('insertUnorderedList', false, undefined);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Body' }), { key: 'i', ctrlKey: true });
    expect(exec).toHaveBeenCalledWith('italic', false, undefined);
  });

  it('starts from defaultValue and reports HTML and text on input', () => {
    const onChange = vi.fn();
    render(<TextEditor aria-label="Body" defaultValue="<p>Hello</p>" onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'Body' });
    expect(box.innerHTML).toBe('<p>Hello</p>');
    box.innerHTML = '<p>Hello there</p>';
    fireEvent.input(box);
    expect(onChange).toHaveBeenCalledWith('<p>Hello there</p>', 'Hello there');
  });

  it('pastes plain text only', () => {
    render(<TextEditor aria-label="Body" />);
    fireEvent.paste(screen.getByRole('textbox', { name: 'Body' }), {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'plain' : '<b>x</b>') },
    });
    expect(exec).toHaveBeenCalledWith('insertText', false, 'plain');
  });

  it('only links to http, https and mailto URLs', () => {
    const prompt = vi.spyOn(window, 'prompt');
    render(<TextEditor aria-label="Body" allowLinks />);
    const link = screen.getByRole('button', { name: 'Link' });
    prompt.mockReturnValueOnce('javascript:alert(1)');
    fireEvent.click(link);
    expect(exec).not.toHaveBeenCalledWith('createLink', false, expect.anything());
    prompt.mockReturnValueOnce('https://navigatewealth.co.za');
    fireEvent.click(link);
    expect(exec).toHaveBeenCalledWith('createLink', false, 'https://navigatewealth.co.za');
    prompt.mockRestore();
  });

  it('turns off editing when disabled', () => {
    render(<TextEditor aria-label="Body" disabled />);
    expect(screen.getByRole('textbox', { name: 'Body' }).getAttribute('contenteditable')).toBe(
      'false',
    );
    expect((screen.getByRole('button', { name: 'Bold' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('exposes the current state of a toolbar button', () => {
    render(<TextEditorButton icon={Bold01} label="Bold" active />);
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Untitled UI VideoPlayer', () => {
  it('formats times', () => {
    expect(formatVideoTime(0)).toBe('00:00');
    expect(formatVideoTime(504)).toBe('08:24');
    expect(formatVideoTime(3723)).toBe('1:02:03');
    expect(formatVideoTime(Number.NaN)).toBe('00:00');
  });

  it('is a named region with a video, an overlay play button and controls', () => {
    const { container } = render(<VideoPlayer title="Intro" size="lg" src="/intro.mp4" />);
    const region = screen.getByRole('region', { name: 'Intro' });
    expect(region.getAttribute('data-size')).toBe('lg');
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/intro.mp4');
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
    screen.getByRole('button', { name: 'Mute' });
    screen.getByRole('button', { name: 'Full screen' });
    screen.getByRole('slider', { name: 'Seek' });
  });

  it('follows the video: pause button while playing, time and remaining time', () => {
    const { container } = render(<VideoPlayer title="Intro" />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 504, configurable: true });
    fireEvent.loadedMetadata(video);
    fireEvent.play(video);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    // The overlay play button hides while playing.
    expect(screen.queryAllByRole('button', { name: 'Play' })).toHaveLength(0);
    video.currentTime = 64;
    fireEvent.timeUpdate(video);
    expect(container.querySelector('.uui-video__progress')?.textContent).toBe('01:04-07:20');
  });

  it('calls play and pause, mutes, and seeks', () => {
    const { container } = render(<VideoPlayer title="Intro" />);
    const video = container.querySelector('video')!;
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
    expect(play).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(video.muted).toBe(true);
    fireEvent.volumeChange(video);
    screen.getByRole('button', { name: 'Unmute' });

    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
    fireEvent.loadedMetadata(video);
    fireEvent.change(screen.getByRole('slider', { name: 'Seek' }), { target: { value: '40' } });
    expect(video.currentTime).toBe(40);
  });

  it('can hide the controls and overlay', () => {
    render(<VideoPlayer title="Loop" controls={false} overlayAction={false} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
