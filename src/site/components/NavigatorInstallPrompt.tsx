/**
 * NavigatorInstallPrompt — the "Get the Navigate Wealth app" banner, its
 * progress toast and the "Add to Home Screen" sheet, drawn as the "Install
 * prompt" board draws them.
 *
 * Presentation only. Whether it shows, what Install does, the dismissal and
 * install flags and the toast timing all stay in InstallAppPrompt.tsx, which
 * runs the same logic for the legacy design and lazy-loads this file only when
 * the prompt is about to show in the Navigator one.
 *
 * Beyond the board:
 * - the sheet is a Radix dialog: focus is trapped while it is open, Escape and
 *   a click on the backdrop close it, and focus goes back to the banner. Radix
 *   portals it to <body>, so the portal carries its own `.nw-site` wrapper for
 *   the scoped styles, as the other Navigator dialogs do;
 * - the toast sits in a polite live region that is in the page whenever the
 *   banner is, so the first message is announced too;
 * - on iOS Safari the button reads "How to" with the Share icon, as the live
 *   prompt's does (the board only draws the desktop "Install").
 */
import * as Dialog from '@radix-ui/react-dialog';
import '../styles/navigator.css';
import '../styles/install-prompt.css';

export interface InstallNotice {
  id: number;
  kind: 'loading' | 'success';
  text: string;
}

interface NavigatorInstallPromptProps {
  bannerVisible: boolean;
  iosSafari: boolean;
  notice: InstallNotice | null;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  onInstall: () => void;
  onDismiss: () => void;
}

const SVG = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function DownloadIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...SVG}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...SVG}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...SVG}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SpinnerIcon({ stroke = 'currentColor' }: { stroke?: string }) {
  return (
    <svg className="nwip-spin" width={16} height={16} viewBox="0 0 24 24" {...SVG} stroke={stroke}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...SVG} stroke="#15803D">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function NavigatorInstallPrompt({
  bannerVisible,
  iosSafari,
  notice,
  sheetOpen,
  onSheetOpenChange,
  onInstall,
  onDismiss,
}: NavigatorInstallPromptProps) {
  const preparing = notice?.kind === 'loading';

  return (
    <div className="nw-site nwip">
      {bannerVisible ? (
        <div className="nwip-bar">
          <div className="nwip-card" role="region" aria-label="Install the Navigate Wealth app">
            <span className="nwip-mark" aria-hidden="true">
              <DownloadIcon size={24} />
            </span>
            <div className="nwip-copy">
              <p className="nwip-title nw-h">Get the Navigate Wealth app</p>
              <p className="nwip-desc">Install the client portal for quick, full-screen access.</p>
            </div>
            <button type="button" className="nw-btn nwip-install" onClick={onInstall}>
              {preparing ? <SpinnerIcon /> : iosSafari ? <ShareIcon /> : <DownloadIcon size={16} />}
              {iosSafari ? 'How to' : 'Install'}
            </button>
            <button
              type="button"
              className="nwip-x"
              aria-label="Dismiss install prompt"
              onClick={onDismiss}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : null}

      <div className="nwip-live" role="status" aria-live="polite">
        {notice ? (
          <div className="nwip-toast" key={notice.id}>
            {notice.kind === 'loading' ? <SpinnerIcon stroke="#0D1626" /> : <CheckIcon />}
            {notice.text}
          </div>
        ) : null}
      </div>

      <Dialog.Root open={sheetOpen} onOpenChange={onSheetOpenChange}>
        <Dialog.Portal>
          <div className="nw-site nwip">
            <Dialog.Overlay className="nwip-overlay">
              <Dialog.Content className="nwip-sheet">
                <div className="nwip-sheet-inner">
                  <div className="nwip-handle" aria-hidden="true" />
                  <div className="nwip-sheet-head">
                    <div>
                      <Dialog.Title className="nwip-sheet-title">
                        <svg width={21} height={21} viewBox="0 0 24 24" {...SVG} stroke="#0D1626">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                        Add to Home Screen
                      </Dialog.Title>
                      <Dialog.Description className="nwip-sheet-desc">
                        Install Navigate Wealth on your device to open the client portal like a
                        regular app.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className="nwip-x" aria-label="Close">
                      <CloseIcon />
                    </Dialog.Close>
                  </div>
                  <ol className="nwip-steps">
                    <li className="nwip-step">
                      <span className="nwip-step-n nw-mono">01</span>
                      <span className="nwip-step-ic">
                        <ShareIcon />
                      </span>
                      <p className="nwip-step-t">
                        Tap the <strong>Share</strong> button in your browser&apos;s toolbar.
                      </p>
                    </li>
                    <li className="nwip-step">
                      <span className="nwip-step-n nw-mono">02</span>
                      <span className="nwip-step-ic">
                        <PlusIcon />
                      </span>
                      <p className="nwip-step-t">
                        Scroll down and choose <strong>Add to Home Screen</strong>.
                      </p>
                    </li>
                  </ol>
                </div>
              </Dialog.Content>
            </Dialog.Overlay>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
