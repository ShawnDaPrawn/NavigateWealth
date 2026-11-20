/**
 * The signing workspace, as the ESign board draws it: a sticky header with
 * the document and the signer, the pages on paper, a floating zoom pill and a
 * sticky action bar (decline, save for later, and the one primary action).
 *
 * Everything it does is the live workflow's (useSigningWorkflow): the same
 * pdf.js rendering, page by page as each comes into view; the same fields in
 * the same places; reading first, then signing; the same validation; the same
 * adopt-once signature; the same in-progress save; the same submit, decline
 * and pause calls with the same payloads; and the live words throughout.
 */
import type { SignerSessionData, SignatureData } from '../../components/esign-signer/types';
import { useSigningWorkflow } from '../../components/esign-signer/hooks/useSigningWorkflow';
import { t, type SignerLang } from '../../components/esign-signer/i18n';
import { ESignDialogs } from './ESignDialogs';
import { ESignField, ESignPriorEntry } from './ESignField';
import { ESignIcon } from './ESignIcons';

interface ESignWorkspaceProps {
  token: string;
  sessionData: SignerSessionData | null;
  lang: SignerLang;
  onComplete: () => void;
  onReject: (reason: string) => void;
  submitSignature: (
    token: string,
    signatures: SignatureData[],
  ) => Promise<{ success: boolean; error?: string }>;
}

export function ESignWorkspace({ lang, ...props }: ESignWorkspaceProps) {
  const workflow = useSigningWorkflow(props);

  if (!workflow) {
    return (
      <div className="nw-site nwes">
        <main className="nwes-cardpage nwes-cardpage--center" aria-label="Session Error">
          <div className="nwes-card nwes-card--sm">
            <div className="nwes-band nwes-band--danger" aria-hidden="true" />
            <div className="nwes-card-body nwes-end">
              <span className="nwes-end-badge nwes-end-badge--danger">
                <ESignIcon name="alert" size={28} />
              </span>
              <h1 className="nw-h nwes-title nwes-end-title">Session Error</h1>
              <p className="nwes-end-text">
                Session data not available. Please try refreshing the page.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const {
    zoom,
    isSubmitting,
    error,
    isFieldsLocked,
    renderedPages,
    pdfLoading,
    pdfError,
    setPdfError,
    setCanvasRef,
    setPlaceholderRef,
    sessionData,
    envelope_title,
    displayPageCount,
    requiredFields,
    completedFields,
    progress,
    allRequiredFieldsCompleted,
    phase,
    handleFieldClick,
    handlePrimaryCta,
    primaryCtaLabel,
    handleZoomIn,
    handleZoomOut,
    isReading,
    pageView,
    fieldView,
    makeInlineCommit,
    handleAttachmentChange,
    handleDownloadOriginal,
    attachmentInputRef,
    setShowRejectDialog,
    setShowPauseDialog,
  } = workflow;

  const tone = isFieldsLocked
    ? 'locked'
    : phase === 'reading'
      ? 'read'
      : allRequiredFieldsCompleted
        ? 'done'
        : 'todo';
  const counted = `${completedFields.length}/${requiredFields.length}`;

  return (
    <div className="nw-site nwes nwes--work">
      <header className="nwes-bar">
        <div className="nwes-bar-in">
          <span className="nwes-bar-icon">
            <ESignIcon name="file" size={18} />
          </span>
          <div className="nwes-bar-text">
            <h1 className="nwes-bar-title">{envelope_title}</h1>
            <p className="nwes-bar-who">
              {sessionData.signer_name} • {sessionData.signer_email}
            </p>
          </div>
          {!isReading && (
            <div className="nwes-progress nwes-hide-sm">
              <div className="nwes-progress-track">
                <div
                  className={`nwes-progress-fill${allRequiredFieldsCompleted ? ' nwes-progress-fill--done' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="nwes-progress-text">{counted} done</span>
            </div>
          )}
          <button
            type="button"
            className="nwes-ghost nwes-bar-download"
            aria-label="Download to read"
            onClick={handleDownloadOriginal}
          >
            <ESignIcon name="download" size={18} />
          </button>
        </div>
        {isReading && !pdfLoading && !pdfError && !isFieldsLocked && (
          <div className="nwes-readhint">
            <ESignIcon name="eye" size={16} />
            <span>Review the document, then tap below when ready</span>
          </div>
        )}
      </header>

      <main className="nwes-docmain" aria-label="Document">
        {error && (
          <div className="nwes-alert nwes-docnote" role="alert">
            <ESignIcon name="alert" size={17} className="nwes-alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {isFieldsLocked && (
          <div className="nwes-locknote nwes-docnote">
            <ESignIcon name="lock" size={16} className="nwes-alert-icon" />
            <span>
              <strong>Waiting for previous signers.</strong> This document requires signatures in a
              specific order. You will be notified by email when it is your turn.
            </span>
          </div>
        )}

        {pdfLoading && (
          <div className="nwes-docloading" role="status">
            <span className="nwes-spin" aria-hidden="true" />
            <span>Loading document...</span>
          </div>
        )}

        {pdfError && (
          <div className="nwes-card nwes-card--sm nwes-docfail">
            <div className="nwes-band nwes-band--danger" aria-hidden="true" />
            <div className="nwes-card-body nwes-end">
              <span className="nwes-end-badge nwes-end-badge--danger">
                <ESignIcon name="alert" size={28} />
              </span>
              <h2 className="nwes-docfail-title">Failed to load document</h2>
              <p className="nwes-end-text" role="alert">
                {pdfError}
              </p>
              <button
                type="button"
                className="nw-outline nwes-end-action"
                onClick={() => setPdfError(null)}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!pdfLoading &&
          !pdfError &&
          Array.from({ length: displayPageCount }).map((_, index) => {
            const pageNumber = index + 1;
            const { pageFields, priorEntries, dim, pageW } = pageView(pageNumber);
            return (
              <div key={pageNumber} className="nwes-pagewrap">
                <article
                  className="nwes-page"
                  aria-label={`Page ${pageNumber} of ${displayPageCount}`}
                  style={
                    pageW && dim
                      ? {
                          width: `${pageW}px`,
                          aspectRatio: `${dim.width} / ${dim.height}`,
                        }
                      : {
                          width: `${zoom}%`,
                          maxWidth: '1000px',
                          aspectRatio: '1 / 1.414',
                          minHeight: '300px',
                        }
                  }
                >
                  {sessionData.document_url && dim ? (
                    <div
                      ref={setPlaceholderRef(pageNumber)}
                      data-page-number={pageNumber}
                      className="nwes-page-paper"
                    >
                      <canvas ref={setCanvasRef(pageNumber)} />
                      {!renderedPages.has(pageNumber) && (
                        <div className="nwes-page-skel" aria-hidden="true">
                          <ESignIcon name="file" size={40} />
                        </div>
                      )}
                    </div>
                  ) : !sessionData.document_url ? (
                    <div className="nwes-page-empty">
                      <ESignIcon name="file" size={64} />
                      <p className="nwes-page-empty-title">Page {pageNumber}</p>
                      <p className="nwes-page-empty-text">Document preview not available</p>
                    </div>
                  ) : null}

                  <div className="nwes-page-fields">
                    {priorEntries.map((entry) => (
                      <ESignPriorEntry
                        key={`prior-${entry.id}`}
                        field={entry}
                        pageWidthPts={dim?.width}
                        pageHeightPts={dim?.height}
                      />
                    ))}
                    {pageFields.map((field) => {
                      const {
                        prefillLocked,
                        isCalculated,
                        effectiveSignatureValue,
                        isFilledEffective,
                        isNext,
                      } = fieldView(field);
                      return (
                        <ESignField
                          key={field.id}
                          field={field}
                          zoom={zoom}
                          pageWidthPts={dim?.width}
                          pageHeightPts={dim?.height}
                          isFilled={isFilledEffective}
                          isNextRequired={isNext}
                          inactive={isReading}
                          filledValue={effectiveSignatureValue}
                          locked={isFieldsLocked || prefillLocked || isCalculated}
                          onClick={() => handleFieldClick(field)}
                          onInlineCommit={makeInlineCommit(field)}
                        />
                      );
                    })}
                  </div>
                </article>
                <p className="nwes-page-no">
                  Page {pageNumber} of {displayPageCount}
                </p>
              </div>
            );
          })}

        <div className="nwes-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="nwes-ghost nwes-zoom-btn"
            aria-label="Zoom out"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
          >
            <ESignIcon name="minus" size={16} />
          </button>
          <span className="nwes-zoom-value">{zoom}%</span>
          <button
            type="button"
            className="nwes-ghost nwes-zoom-btn"
            aria-label="Zoom in"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
          >
            <ESignIcon name="plus" size={16} />
          </button>
        </div>
      </main>

      <footer className="nwes-actions">
        <div className="nwes-actions-in">
          <button
            type="button"
            className="nwes-ghost nwes-act nwes-act--decline"
            aria-label="Decline to sign"
            onClick={() => setShowRejectDialog(true)}
            disabled={isSubmitting}
          >
            <ESignIcon name="xCircle" size={18} />
            <span className="nwes-hide-sm">{t('common.decline', lang)}</span>
          </button>
          {!isReading && (
            <>
              <button
                type="button"
                className="nwes-ghost nwes-act"
                aria-label="Save and finish later"
                onClick={() => setShowPauseDialog(true)}
                disabled={isSubmitting}
              >
                <ESignIcon name="save" size={18} />
                <span className="nwes-hide-sm">Save &amp; finish later</span>
              </button>
              <span className="nwes-only-sm nwes-act-count">{counted}</span>
            </>
          )}
          <span className="nwes-hide-sm nwes-act-spacer" />
          <button
            type="button"
            className={`nwes-cta nwes-cta--${tone} nwes-act-main`}
            onClick={handlePrimaryCta}
            disabled={isFieldsLocked || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="nwes-spin nwes-spin--light" aria-hidden="true" />
                Submitting…
              </>
            ) : isFieldsLocked ? (
              <>
                <ESignIcon name="lock" size={16} />
                Locked
              </>
            ) : (
              <>
                <span className="nwes-act-label">{primaryCtaLabel}</span>
                <ESignIcon name="arrowRight" size={16} />
              </>
            )}
          </button>
        </div>
      </footer>

      {/* P3.5 — the attachment picker the live workflow opens from a field. */}
      <input
        ref={attachmentInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/heic,image/heif,image/webp"
        className="nw-sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleAttachmentChange}
      />

      <ESignDialogs
        sessionData={sessionData}
        envelope_title={envelope_title}
        showSignatureDialog={workflow.showSignatureDialog}
        setShowSignatureDialog={workflow.setShowSignatureDialog}
        showTextDialog={workflow.showTextDialog}
        setShowTextDialog={workflow.setShowTextDialog}
        showDateDialog={workflow.showDateDialog}
        setShowDateDialog={workflow.setShowDateDialog}
        showDropdownDialog={workflow.showDropdownDialog}
        setShowDropdownDialog={workflow.setShowDropdownDialog}
        showConsentDialog={workflow.showConsentDialog}
        setShowConsentDialog={workflow.setShowConsentDialog}
        showRejectDialog={workflow.showRejectDialog}
        setShowRejectDialog={workflow.setShowRejectDialog}
        showPauseDialog={workflow.showPauseDialog}
        setShowPauseDialog={workflow.setShowPauseDialog}
        currentField={workflow.currentField}
        setCurrentField={workflow.setCurrentField}
        adoptedSignature={workflow.adoptedSignature}
        adoptedInitials={workflow.adoptedInitials}
        textInput={workflow.textInput}
        setTextInput={workflow.setTextInput}
        dateInput={workflow.dateInput}
        setDateInput={workflow.setDateInput}
        dropdownValue={workflow.dropdownValue}
        setDropdownValue={workflow.setDropdownValue}
        rejectReason={workflow.rejectReason}
        setRejectReason={workflow.setRejectReason}
        error={error}
        setError={workflow.setError}
        consentAccepted={workflow.consentAccepted}
        setConsentAccepted={workflow.setConsentAccepted}
        isSubmitting={isSubmitting}
        completedFields={completedFields}
        requiredFields={requiredFields}
        handleSignatureSave={workflow.handleSignatureSave}
        handleTextSave={workflow.handleTextSave}
        handleDateSave={workflow.handleDateSave}
        handleDropdownSave={workflow.handleDropdownSave}
        handleRejectSubmit={workflow.handleRejectSubmit}
        handleFinalSubmit={workflow.handleFinalSubmit}
        handlePauseConfirm={workflow.handlePauseConfirm}
      />
    </div>
  );
}
