/**
 * Signing Workflow
 *
 * Phase-1 production redesign — the signer experience must be
 * self-evidently intuitive. No tour, no coach marks, no help text.
 *
 * Two explicit phases:
 *   1. READING  — the document is rendered with field placeholders shown
 *                 but inert. A single bottom-bar CTA: "I'm ready to sign".
 *   2. SIGNING  — fields become interactive. The bottom-bar CTA dynamically
 *                 reflects state:
 *                    "Complete N required fields"  → scrolls to next required
 *                    "Submit signed document"      → opens ECTA consent
 *
 * Other Phase-1 features in this component:
 *   • Adopt-once-apply-everywhere — when the signer adopts a signature in
 *     any field, every empty signature/initials field they own is filled.
 *   • Saved-signature reuse from the server (signature is persisted per
 *     email after first adoption).
 *   • Auto-derived initials based on signer name.
 *   • Mobile-first sticky bottom action bar with Decline / Save & Finish
 *     later / primary CTA — no buried menus.
 *   • Print / Download to read — always visible in the header.
 *   • Optional SA-ID masking + checksum in text fields when the field
 *     metadata declares format === 'sa_id'.
 *   • Local persistence (localStorage) of in-progress signatures so a
 *     paused signer can resume.
 *   • No tooltips. No popovers explaining what a field is for. The visual
 *     language alone communicates state.
 */

import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { FileText, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { FieldHighlight } from './FieldHighlight';
import { PriorEntry } from './PriorEntry';
import { SigningWorkflowDialogs } from './SigningWorkflowDialogs';
import { SigningZoomControls } from './SigningZoomControls';
import { SigningHeader } from './steps/SigningHeader';
import { BottomActionBar } from './steps/BottomActionBar';
import { useSigningWorkflow, type SigningWorkflowProps } from './hooks/useSigningWorkflow';

export function SigningWorkflow(props: SigningWorkflowProps) {
  const workflow = useSigningWorkflow(props);

  // ── Early-return if session missing ────────────────────────────────────
  if (!workflow) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="p-8 text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Session Error</h3>
          <p className="text-gray-500 mt-2">
            Session data not available. Please try refreshing the page.
          </p>
        </Card>
      </div>
    );
  }

  const {
    zoom,
    isSubmitting,
    error,
    setError,
    showRejectDialog,
    setShowRejectDialog,
    rejectReason,
    setRejectReason,
    showSignatureDialog,
    setShowSignatureDialog,
    showTextDialog,
    setShowTextDialog,
    showDateDialog,
    setShowDateDialog,
    showConsentDialog,
    setShowConsentDialog,
    showDropdownDialog,
    setShowDropdownDialog,
    showPauseDialog,
    setShowPauseDialog,
    currentField,
    setCurrentField,
    signatures,
    textInput,
    setTextInput,
    dateInput,
    setDateInput,
    dropdownValue,
    setDropdownValue,
    consentAccepted,
    setConsentAccepted,
    adoptedSignature,
    adoptedInitials,
    scrollContainerRef,
    attachmentInputRef,
    renderedPages,
    pdfLoading,
    pdfError,
    setPdfError,
    setCanvasRef,
    setPlaceholderRef,
    sessionData,
    envelope_title,
    isFieldsLocked,
    displayPageCount,
    requiredFields,
    completedFields,
    progress,
    allRequiredFieldsCompleted,
    phase,
    handleFieldClick,
    handleSignatureSave,
    handleTextSave,
    handleDateSave,
    handleDropdownSave,
    handlePrimaryCta,
    primaryCtaLabel,
    primaryCtaTone,
    handleFinalSubmit,
    handleRejectSubmit,
    handlePauseConfirm,
    handleZoomIn,
    handleZoomOut,
    isReading,
    pageView,
    fieldView,
    makeInlineCommit,
    handleAttachmentChange,
    handleDownloadOriginal,
  } = workflow;

  return (
    <div className="flex flex-col h-screen bg-gray-100/50">
      <SigningHeader
        envelopeTitle={envelope_title}
        signerName={sessionData.signer_name}
        signerEmail={sessionData.signer_email}
        isReading={isReading}
        completedCount={completedFields.length}
        requiredCount={requiredFields.length}
        progress={progress}
        onDownloadOriginal={handleDownloadOriginal}
      />

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-32 md:pb-32 bg-gray-100/50 scroll-smooth relative"
        >
          {error && (
            <div className="max-w-3xl mx-auto mb-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Locked state banner */}
          {isFieldsLocked && (
            <div className="max-w-3xl mx-auto mb-6">
              <Alert className="bg-amber-50 border-amber-300 text-amber-900">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <span className="font-medium">Waiting for previous signers.</span> This document
                  requires signatures in a specific order. You will be notified by email when it is
                  your turn.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex flex-col items-center gap-8 min-h-full">
            <SigningZoomControls zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

            {/* Document */}
            {pdfLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="ml-2 text-gray-500">Loading document...</span>
              </div>
            )}

            {pdfError && (
              <div className="max-w-md mx-auto">
                <Card className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Failed to load document</h3>
                  <p className="text-sm text-gray-500 mt-2">{pdfError}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setPdfError(null)}>
                    Try Again
                  </Button>
                </Card>
              </div>
            )}

            {!pdfLoading &&
              !pdfError &&
              Array.from({ length: displayPageCount }).map((_, index) => {
                const pageNumber = index + 1;

                const { pageFields, priorEntries, dim, pageW } = pageView(pageNumber);

                return (
                  <div
                    key={pageNumber}
                    className="relative bg-white shadow-md transition-all duration-200 ease-in-out rounded-sm"
                    style={
                      pageW && dim
                        ? {
                            width: `${pageW}px`,
                            maxWidth: '100%',
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
                    <div className="absolute -left-12 top-0 text-xs text-gray-400 font-medium hidden xl:block">
                      Page {pageNumber}
                    </div>

                    {sessionData.document_url && dim ? (
                      <div
                        ref={setPlaceholderRef(pageNumber)}
                        data-page-number={pageNumber}
                        className="absolute inset-0 overflow-hidden bg-white z-0"
                      >
                        <canvas
                          ref={setCanvasRef(pageNumber)}
                          className="absolute top-0 left-0"
                          style={{ width: '100%', height: '100%' }}
                        />
                        {/* P7.6 — skeleton placeholder shown until the page
                          canvas has been rendered by the observer tick. */}
                        {!renderedPages.has(pageNumber) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/60 animate-pulse pointer-events-none">
                            <FileText className="h-10 w-10 text-gray-300" strokeWidth={1} />
                          </div>
                        )}
                        <div className="absolute inset-0 z-[1]" />
                      </div>
                    ) : !sessionData.document_url ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-100 pointer-events-none border border-gray-100 z-0">
                        <FileText className="h-32 w-32 mb-4" strokeWidth={1} />
                        <p className="text-lg font-medium text-gray-300">Page {pageNumber}</p>
                        <p className="text-sm text-gray-300">Document preview not available</p>
                      </div>
                    ) : null}

                    {/* Fields overlay */}
                    <div className="absolute inset-0 z-10 pointer-events-none">
                      {/* What earlier signers completed — read-only. */}
                      {priorEntries.map((entry) => (
                        <PriorEntry
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
                          <div
                            id={`field-${field.id}`}
                            key={field.id}
                            className="absolute inset-0 pointer-events-none"
                          >
                            <FieldHighlight
                              field={field}
                              zoom={zoom}
                              pageWidthPts={dim?.width}
                              pageHeightPts={dim?.height}
                              isFilled={isFilledEffective}
                              isNextRequired={isNext}
                              inactive={isReading}
                              filledValue={effectiveSignatureValue}
                              // Locked prefill becomes a real lock at render time
                              // — FieldHighlight already supports `locked`.
                              // P4.6 — calculated fields are always locked.
                              locked={isFieldsLocked || prefillLocked || isCalculated}
                              onClick={() => handleFieldClick(field)}
                              // P2.5 1.9 — accept inline commits for plain
                              // text & date fields. SA-ID and other masked
                              // formats still go through the modal (handled
                              // inside FieldHighlight via metadata.format).
                              onInlineCommit={makeInlineCommit(field)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <BottomActionBar
        isReading={isReading}
        isFieldsLocked={isFieldsLocked}
        isSubmitting={isSubmitting}
        allRequiredFieldsCompleted={allRequiredFieldsCompleted}
        phase={phase}
        progress={progress}
        completedCount={completedFields.length}
        requiredCount={requiredFields.length}
        primaryCtaLabel={primaryCtaLabel}
        primaryCtaTone={primaryCtaTone}
        onPrimaryCta={handlePrimaryCta}
        onDecline={() => setShowRejectDialog(true)}
        onPause={() => setShowPauseDialog(true)}
      />

      {/* ==================== READING-MODE OVERLAY HINT ==================== */}
      {/*
        When the document is loaded and we're still in reading mode, show
        a subtle floating banner near the bottom-CTA so first-time signers
        immediately know that the next step is theirs to take. NOT a tour
        — just a one-shot informational banner that disappears when they
        cross into signing.
      */}
      <AnimatePresence>
        {isReading && !pdfLoading && !pdfError && !isFieldsLocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="bg-gray-900/85 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              <span>Review the document, then tap below when ready</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================== P3.5 — ATTACHMENT UPLOAD ====================== */}
      {/* Hidden file input that handleFieldClick triggers programmatically.
          Kept off-screen (not display:none) so iOS Safari treats the click
          as a user gesture and actually opens the file picker. */}
      <input
        ref={attachmentInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/heic,image/heif,image/webp"
        className="sr-only"
        onChange={handleAttachmentChange}
      />

      <SigningWorkflowDialogs
        sessionData={sessionData}
        envelope_title={envelope_title}
        showSignatureDialog={showSignatureDialog}
        setShowSignatureDialog={setShowSignatureDialog}
        showTextDialog={showTextDialog}
        setShowTextDialog={setShowTextDialog}
        showDateDialog={showDateDialog}
        setShowDateDialog={setShowDateDialog}
        showDropdownDialog={showDropdownDialog}
        setShowDropdownDialog={setShowDropdownDialog}
        showConsentDialog={showConsentDialog}
        setShowConsentDialog={setShowConsentDialog}
        showRejectDialog={showRejectDialog}
        setShowRejectDialog={setShowRejectDialog}
        showPauseDialog={showPauseDialog}
        setShowPauseDialog={setShowPauseDialog}
        currentField={currentField}
        setCurrentField={setCurrentField}
        signatures={signatures}
        adoptedSignature={adoptedSignature}
        adoptedInitials={adoptedInitials}
        textInput={textInput}
        setTextInput={setTextInput}
        dateInput={dateInput}
        setDateInput={setDateInput}
        dropdownValue={dropdownValue}
        setDropdownValue={setDropdownValue}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        error={error}
        setError={setError}
        consentAccepted={consentAccepted}
        setConsentAccepted={setConsentAccepted}
        isSubmitting={isSubmitting}
        completedFields={completedFields}
        requiredFields={requiredFields}
        handleSignatureSave={handleSignatureSave}
        handleTextSave={handleTextSave}
        handleDateSave={handleDateSave}
        handleDropdownSave={handleDropdownSave}
        handleRejectSubmit={handleRejectSubmit}
        handleFinalSubmit={handleFinalSubmit}
        handlePauseConfirm={handlePauseConfirm}
      />
    </div>
  );
}
