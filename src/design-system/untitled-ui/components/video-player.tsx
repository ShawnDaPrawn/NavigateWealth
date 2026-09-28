/**
 * Untitled UI v8.0 "Video player 16:9", "_Video actions bar", "_Video action
 * button" and "_Video overlay action".
 *
 * Figma variants → props:
 *   Size             sm | md | lg        → size (240 / 560 / 720px wide)
 *   Playing          False | True        → the video's own state
 *   Actions bar      True                → controls (default true)
 *   Overlay action   True                → the centre play button while paused
 * The volume slider, playback speed, subtitles, skip and AirPlay buttons are
 * not exported yet.
 *
 * A native `<video>` underneath, so every format, source and track the browser
 * supports works. Space or K toggles playback, M mutes, F goes full screen and
 * the arrow keys seek 5 seconds when the player has focus.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import {
  Maximize01,
  Minimize01,
  PauseSolid,
  PlaySolid,
  VolumeMax,
  VolumeX,
  type UntitledIcon,
} from '../icons/icons';
import { formatVideoTime } from './format-video-time';

export interface VideoPlayerProps extends Omit<
  React.VideoHTMLAttributes<HTMLVideoElement>,
  'controls' | 'title'
> {
  size?: 'sm' | 'md' | 'lg';
  /** Names the player for assistive tech, e.g. the video's title. */
  title: string;
  /** Show the actions bar (Figma "Actions bar"). */
  controls?: boolean;
  /** Show the centre play button while paused (Figma "Overlay action"). */
  overlayAction?: boolean;
  /** Class for the outer frame; `className` goes on the video element. */
  wrapperClassName?: string;
}

function ActionButton({
  icon: Icon,
  label,
  ...props
}: { icon: UntitledIcon; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="uui-video__action" aria-label={label} title={label} {...props}>
      <Icon />
    </button>
  );
}

export const VideoPlayer = React.forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      size = 'md',
      title,
      controls = true,
      overlayAction = true,
      wrapperClassName,
      className,
      onPlay,
      onPause,
      onTimeUpdate,
      onLoadedMetadata,
      onProgress,
      onVolumeChange,
      onClick,
      ...props
    },
    ref,
  ) => {
    const frameRef = React.useRef<HTMLDivElement>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [muted, setMuted] = React.useState(!!props.muted);
    const [time, setTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [buffered, setBuffered] = React.useState(0);
    const [fullscreen, setFullscreen] = React.useState(false);

    // Stable while the forwarded ref is, so React does not detach and
    // re-attach it on every time update.
    const setRefs = React.useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    React.useEffect(() => {
      const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
      document.addEventListener('fullscreenchange', onChange);
      return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggle = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        // play() rejects if the browser blocks autoplay; the button stays "Play".
        void v.play()?.catch?.(() => {});
      } else v.pause();
    };
    const toggleMute = () => {
      const v = videoRef.current;
      if (v) v.muted = !v.muted;
    };
    const toggleFullscreen = () => {
      if (document.fullscreenElement) void document.exitFullscreen?.();
      else void frameRef.current?.requestFullscreen?.();
    };
    const seek = (to: number) => {
      const v = videoRef.current;
      if (v) v.currentTime = Math.max(0, Math.min(to, duration || v.duration || 0));
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // A focused button or the seek bar handles Space, Enter and the arrows itself.
      const onControl =
        e.target !== e.currentTarget && (e.target as HTMLElement).matches('input, button');
      if (onControl && (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow'))) return;
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'k') {
        e.preventDefault();
        toggle();
      } else if (key === 'm') toggleMute();
      else if (key === 'f') toggleFullscreen();
      else if (key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault();
        seek(time + (key === 'arrowright' ? 5 : -5));
      }
    };

    const progress = duration ? (time / duration) * 100 : 0;
    const bufferedPct = duration ? (buffered / duration) * 100 : 0;

    return (
      <div
        ref={frameRef}
        className={clsx('uui-video', wrapperClassName)}
        data-size={size}
        data-playing={playing || undefined}
        role="region"
        aria-label={title}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <video
          ref={setRefs}
          className={clsx('uui-video__media', className)}
          playsInline
          onClick={(e) => {
            onClick?.(e);
            if (!e.defaultPrevented) toggle();
          }}
          onPlay={(e) => {
            setPlaying(true);
            onPlay?.(e);
          }}
          onPause={(e) => {
            setPlaying(false);
            onPause?.(e);
          }}
          onTimeUpdate={(e) => {
            setTime(e.currentTarget.currentTime);
            onTimeUpdate?.(e);
          }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            onLoadedMetadata?.(e);
          }}
          onProgress={(e) => {
            const b = e.currentTarget.buffered;
            if (b.length) setBuffered(b.end(b.length - 1));
            onProgress?.(e);
          }}
          onVolumeChange={(e) => {
            setMuted(e.currentTarget.muted);
            onVolumeChange?.(e);
          }}
          {...props}
        />

        {overlayAction && !playing && (
          <button type="button" className="uui-video__overlay" aria-label="Play" onClick={toggle}>
            <span className="uui-video__overlay-button">
              <PlaySolid />
            </span>
          </button>
        )}

        {controls && (
          <div className="uui-video__bar">
            <ActionButton
              icon={playing ? PauseSolid : PlaySolid}
              label={playing ? 'Pause' : 'Play'}
              onClick={toggle}
            />
            <ActionButton
              icon={muted ? VolumeX : VolumeMax}
              label={muted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
            />
            <div className="uui-video__progress">
              <span className="uui-video__time">{formatVideoTime(time)}</span>
              <div
                className="uui-video__track"
                style={
                  {
                    '--_progress': `${progress}%`,
                    '--_buffered': `${bufferedPct}%`,
                  } as React.CSSProperties
                }
              >
                <input
                  type="range"
                  className="uui-video__seek"
                  min={0}
                  max={duration || 0}
                  step="any"
                  value={time}
                  aria-label="Seek"
                  aria-valuetext={`${formatVideoTime(time)} of ${formatVideoTime(duration)}`}
                  onChange={(e) => seek(Number(e.currentTarget.value))}
                />
              </div>
              <span className="uui-video__time">-{formatVideoTime(duration - time)}</span>
            </div>
            <ActionButton
              icon={fullscreen ? Minimize01 : Maximize01}
              label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={toggleFullscreen}
            />
          </div>
        )}
      </div>
    );
  },
);
VideoPlayer.displayName = 'VideoPlayer';
