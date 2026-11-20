/**
 * "Adopt your signature" / "Adopt your initials" — the pad inside the adopt
 * dialog, as the ESign board draws it: Draw, Type and Upload tabs (and Saved,
 * when this signer has adopted one before, as the live pad offers).
 *
 * The capture is the live pad's own (useSignatureCapture): the same strokes
 * and ink colours, the same typed rendering, the same upload checks and PNG
 * conversion, and the same image handed back — a PNG cropped to the ink, or
 * the uploaded or saved image. The typed signature is rendered, as live, on a
 * canvas the size of the live pad's (see esign.css), so the typed image comes
 * out the same size; the board shows the choice as style tiles, so that canvas
 * is kept out of sight.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  INK_COLORS,
  SIGNATURE_FONTS,
  useSignatureCapture,
  type SignatureMode,
} from '../../components/esign-signer/hooks/useSignatureCapture';
import { ESignIcon } from './ESignIcons';

/** The board lists the five styles in this order. */
const STYLE_ORDER = ['Elegant', 'Classic', 'Flowing', 'Formal', 'Casual'];
const STYLES = STYLE_ORDER.map((label) => SIGNATURE_FONTS.find((f) => f.label === label)!);

const TABS: { mode: SignatureMode; label: string }[] = [
  { mode: 'saved', label: 'Saved' },
  { mode: 'draw', label: 'Draw' },
  { mode: 'type', label: 'Type' },
  { mode: 'upload', label: 'Upload' },
];

interface ESignAdoptProps {
  type: 'signature' | 'initials';
  /** The dialog's title and description, from the live dialog. */
  title: string;
  description: string;
  savedSignature: string | null;
  savedInitials: string | null;
  signerName: string;
  onSave: (signatureData: string) => void;
  onCancel: () => void;
}

export function ESignAdopt({
  type,
  title,
  description,
  savedSignature,
  savedInitials,
  signerName,
  onSave,
  onCancel,
}: ESignAdoptProps) {
  const [uploadError, setUploadError] = useState('');
  const {
    drawCanvasRef,
    typeCanvasRef,
    fileInputRef,
    savedAsset,
    hasSavedAsset,
    hasContent,
    signatureMode,
    setSignatureMode,
    changeMode,
    typedText,
    setTypedText,
    setHasContent,
    selectedFont,
    setSelectedFont,
    inkColor,
    setInkColor,
    uploadedImage,
    startDrawing,
    draw,
    stopDrawing,
    handleFileUpload,
    clearUpload,
    handleSave,
    canSave,
    clearAll,
    typeLabel,
  } = useSignatureCapture({
    onSave,
    type,
    savedSignature,
    savedInitials,
    signerName,
    reportUploadError: setUploadError,
  });
  const noun = type;
  const tabs = TABS.filter((tab) => tab.mode !== 'saved' || hasSavedAsset);

  return (
    <>
      <div className="nwes-adopt-top">
        <Dialog.Title className="nw-h nwes-dlg-title">{title}</Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc nwes-dlg-desc--loose">
          {description}
        </Dialog.Description>
        <div
          role="tablist"
          aria-label="Signature method"
          className="nwes-tabs"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => {
            const on = signatureMode === tab.mode;
            return (
              <button
                key={tab.mode}
                type="button"
                role="tab"
                id={`es-tab-${tab.mode}`}
                aria-selected={on}
                aria-controls="es-tabpanel"
                tabIndex={on ? 0 : -1}
                className={`nwes-tab${on ? ' nwes-tab--on' : ''}`}
                // As the live tabs: a change of tab only when it is a change.
                onClick={() => {
                  if (on) return;
                  setUploadError('');
                  changeMode(tab.mode);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                  event.preventDefault();
                  const at = tabs.findIndex((t) => t.mode === signatureMode);
                  const next =
                    tabs[(at + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
                  setUploadError('');
                  changeMode(next.mode);
                  document.getElementById(`es-tab-${next.mode}`)?.focus();
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="nwes-adopt-body"
        role="tabpanel"
        id="es-tabpanel"
        aria-labelledby={`es-tab-${signatureMode}`}
      >
        {signatureMode === 'saved' && savedAsset && (
          <div className="nwes-saved">
            <div className="nwes-saved-head">
              <span>Your saved {typeLabel.toLowerCase()}</span>
              <button
                type="button"
                className="nwes-ghost nwes-small"
                onClick={() => setSignatureMode('draw')}
              >
                Create new
              </button>
            </div>
            <img src={savedAsset} alt={`Saved ${typeLabel.toLowerCase()}`} />
            <p className="nwes-saved-hint">
              Tap &quot;Adopt {noun}&quot; to use this for the document.
            </p>
          </div>
        )}

        {signatureMode === 'draw' && (
          <div>
            <div className="nwes-pad">
              <canvas
                ref={drawCanvasRef}
                aria-label="Signature pad"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="nwes-pad-line" aria-hidden="true" />
              <span className="nwes-pad-cap">Sign above this line</span>
              {!hasContent && (
                <span className="nwes-pad-hint" aria-hidden="true">
                  Draw with your finger or mouse
                </span>
              )}
            </div>
            <div className="nwes-pad-tools">
              <div className="nwes-inks">
                <span className="nwes-inks-label">Ink:</span>
                {INK_COLORS.map((color) => {
                  const on = inkColor === color.value;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      className={`nwes-swatch${on ? ' nwes-swatch--on' : ''}`}
                      aria-label={`Use ${color.label} ink`}
                      aria-pressed={on}
                      onClick={() => setInkColor(color.value)}
                    >
                      <span style={{ background: color.value }} />
                    </button>
                  );
                })}
              </div>
              <button type="button" className="nwes-ghost nwes-small" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>
        )}

        {signatureMode === 'type' && (
          <div className="nwes-typed">
            <label htmlFor="es-typed" className="nwes-typed-label">
              Type your {type}
            </label>
            <input
              id="es-typed"
              className="nwes-input"
              type="text"
              value={typedText}
              onChange={(e) => {
                setTypedText(e.target.value);
                setHasContent(e.target.value.trim().length > 0);
              }}
              placeholder={type === 'initials' ? 'e.g. JD' : 'e.g. John Doe'}
              maxLength={type === 'initials' ? 5 : 60}
              autoFocus
            />
            <span className="nwes-typed-label nwes-typed-label--strong" id="es-style-label">
              Choose a style
            </span>
            <div className="nwes-styles" role="group" aria-labelledby="es-style-label">
              {STYLES.map((font) => {
                const on = selectedFont.name === font.name;
                return (
                  <button
                    key={font.name}
                    type="button"
                    className={`nwes-style${on ? ' nwes-style--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setSelectedFont(font)}
                  >
                    <span className="nwes-style-sample" style={{ fontFamily: font.cssFamily }}>
                      {typedText || (type === 'initials' ? 'JD' : 'Name')}
                    </span>
                    <span className="nwes-style-name">{font.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="nwes-typecanvas" aria-hidden="true">
              <canvas ref={typeCanvasRef} />
            </div>
          </div>
        )}

        {signatureMode === 'upload' && (
          <div>
            {!uploadedImage ? (
              <label className="nwes-drop">
                <ESignIcon name="upload" size={26} stroke="#0D1626" />
                <span className="nwes-drop-title">Upload a signature image</span>
                <span className="nwes-drop-text">
                  PNG or JPG, max 2MB. Transparent backgrounds work best.
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    setUploadError('');
                    handleFileUpload(e);
                  }}
                />
              </label>
            ) : (
              <div className="nwes-uploaded">
                <img src={uploadedImage} alt="Uploaded signature" />
                <button
                  type="button"
                  className="nwes-ghost nwes-small nwes-danger-text"
                  onClick={clearUpload}
                >
                  Remove
                </button>
              </div>
            )}
            {uploadError && (
              <p className="nwes-upload-error" role="alert">
                {uploadError}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="nwes-dlg-actions nwes-adopt-actions">
        <button type="button" className="nw-outline nwes-dlg-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="nw-btn nwes-dlg-btn nwes-dlg-btn--main"
          onClick={handleSave}
          disabled={!canSave()}
        >
          Adopt {noun}
        </button>
      </div>
    </>
  );
}
