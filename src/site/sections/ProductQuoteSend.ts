/**
 * ProductQuoteSend — what the redesigned wizards share besides their frame:
 * the props the page gives each one, and useQuoteSend, the live wizards'
 * handleSubmit. It sends the request and reports the outcome as the live
 * wizards do (the same console lines, the same success toast, the draft
 * cleared), except that a failed send is kept for the form to show, where it
 * stays until the next try, rather than raised in a passing toast.
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { QuoteContactDetails, QuoteServiceId } from '../../components/pages/quote/types';
import { SEND_FAILED, SEND_UNREACHABLE, submitProductQuote } from './ProductQuoteModel';

/** What every service's wizard is given by the page. */
export interface WizardProps {
  contact: QuoteContactDetails;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

interface SendOptions extends WizardProps {
  service: QuoteServiceId;
  productName: string;
  /** The live wizard's console label, e.g. "Risk" in "Risk quote submission error:". */
  logName: string;
  successMessage: string;
  clearDraft: () => void;
}

/** The live wizards' handleSubmit, with the failure kept for the form to show. */
export function useQuoteSend({
  contact,
  parentSubmissionId,
  onSuccess,
  service,
  productName,
  logName,
  successMessage,
  clearDraft,
}: SendOptions) {
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState('');

  const send = useCallback(
    async (buildProductDetails: () => unknown) => {
      setSubmitting(true);
      setFailure('');
      try {
        const { ok, result } = await submitProductQuote({
          contact,
          productName,
          service,
          parentSubmissionId,
          productDetails: buildProductDetails(),
        });
        if (!ok) {
          console.error(`${logName} quote submission error:`, result);
          setFailure(result.error || SEND_FAILED);
          return;
        }
        clearDraft();
        toast.success(successMessage);
        onSuccess();
      } catch (error) {
        console.error(`${logName} quote network error:`, error);
        setFailure(SEND_UNREACHABLE);
      } finally {
        setSubmitting(false);
      }
    },
    [
      contact,
      productName,
      service,
      parentSubmissionId,
      logName,
      clearDraft,
      successMessage,
      onSuccess,
    ],
  );

  return { submitting, failure, send };
}

/** The hint the board shows for a step whose required answers are missing. */
export const COMPLETE_FIELDS = 'Complete the required fields to continue';
