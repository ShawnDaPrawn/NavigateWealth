/**
 * NavigatorRequestCompletionPage — the redesigned page a client opens from an
 * emailed request link (/requests/:id), the "Request Completion" board of the
 * Website Redesign canvas.
 *
 * It does what the live page (RequestCompletionPage.tsx) does: one GET of the
 * request by its id from the public route, read the same way (the request is
 * `data.request`; a request already Pending or Finalised opens on the thank-you
 * card); the template's blocks or, without blocks, its fields; the same
 * required-field check before anything is sent; and one POST of
 * `{ responses }` to the request's submit address. Every message is the live
 * page's. Like the live page it sets no SEO tags (the route is kept out of
 * search by the server's headers and robots.txt).
 *
 * Neither request carries the public anon key as a bearer token: GET
 * /requests/:id has no auth middleware (it is the capability link) and the
 * function runs with verify_jwt off — see the anon-key-bearer ratchet.
 *
 * As the board draws it: a count of the required answers given; the
 * required-field message shown above the form, with each empty required field
 * marked and the first one focused, rather than in a toast; and a failed
 * submission in the board's own toast.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { projectId } from '../../utils/supabase/info';
import { RequestCompletionBlocks, type RequestBlock } from '../sections/RequestCompletionBlocks';
import { RequestCompletionDocument } from '../sections/RequestCompletionDocument';
import { RequestCompletionFields, type TemplateField } from '../sections/RequestCompletionFields';
import {
  RequestCompletionError,
  RequestCompletionLoading,
  RequestCompletionSubmitted,
  RequestCompletionToast,
} from '../sections/RequestCompletionStates';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/request-completion.css';

interface RequestInstance {
  id: string;
  templateName: string;
  recipientEmail: string;
  status: string;
  fields: TemplateField[];
  blocks?: RequestBlock[];
}

/** The live page's words. */
const LOAD_FAILED = 'Failed to load request. It may check have been deleted or does not exist.';
const NOT_FOUND = 'Request not found';
const SUBMIT_FAILED = 'Failed to submit form. Please try again.';
const SUBMITTED = 'Form submitted successfully!';

/** How long the failure toast stays, as long as the live page's toast. */
const TOAST_MS = 4000;

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/requests`;

/** The live page's required-field check: the key and label of each required field. */
function requiredFields(request: RequestInstance): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  if (request.blocks && request.blocks.length > 0) {
    request.blocks.forEach((block) => {
      const fields = block.data.fields as
        Array<{ key?: string; label: string; required?: boolean }> | undefined;
      if (block.type === 'field_grid' && fields) {
        fields.forEach((field, idx) => {
          const key = field.key || `field_${block.id}_${idx}`;
          if (field.required) out.push({ key, label: field.label });
        });
      }
    });
  } else {
    request.fields
      .filter((f) => f.required)
      .forEach((f) => out.push({ key: f.id, label: f.label }));
  }
  return out;
}

export function NavigatorRequestCompletionPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<RequestInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRequest = async (requestId: string) => {
      try {
        const res = await fetch(`${BASE}/${requestId}`);
        if (!res.ok) throw new Error('Request not found');
        const data = await res.json();
        setRequest(data.request);
        if (data.request.status === 'Pending' || data.request.status === 'Finalised') {
          setSubmitted(true);
        }
      } catch (_err) {
        setError(LOAD_FAILED);
      } finally {
        setLoading(false);
      }
    };
    void fetchRequest(id);
  }, [id]);

  // The failure toast leaves on its own, as the live page's does.
  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  const required = useMemo(() => (request ? requiredFields(request) : []), [request]);
  const missing = useMemo(() => required.filter((f) => !responses[f.key]), [required, responses]);
  const invalidKeys = useMemo(
    () => new Set(checked ? missing.map((f) => f.key) : []),
    [checked, missing],
  );

  // After a send with required fields empty, focus the first one.
  useEffect(() => {
    if (!focusTick) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!first) return;
    const target = first.matches('input, select, textarea, button')
      ? first
      : first.querySelector<HTMLElement>('[tabindex="0"], button, input');
    target?.focus();
  }, [focusTick]);

  const onChange = useCallback((key: string, val: unknown) => {
    setResponses((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSubmit = async () => {
    if (!request || submitting) return;

    // Validate required fields
    const missingFields = requiredFields(request)
      .filter((f) => !responses[f.key])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      setChecked(true);
      setFocusTick((n) => n + 1);
      return;
    }

    setChecked(false);
    setFailed(false);
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/${request.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      if (!res.ok) throw new Error('Failed to submit');

      setSubmitted(true);
      toast.success(SUBMITTED);
    } catch (_err) {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  let body;
  if (loading) {
    body = <RequestCompletionLoading />;
  } else if (error || !request) {
    body = <RequestCompletionError message={error || NOT_FOUND} />;
  } else if (submitted) {
    body = <RequestCompletionSubmitted />;
  } else {
    const alert =
      checked && missing.length > 0
        ? `Please fill in all required fields: ${missing.map((f) => f.label).join(', ')}`
        : null;
    body = (
      <RequestCompletionDocument
        title={request.templateName}
        recipientEmail={request.recipientEmail}
        done={required.length - missing.length}
        required={required.length}
        alert={alert}
        submitting={submitting}
        onSubmit={() => void handleSubmit()}
      >
        <div ref={formRef} className="nwrc-stack">
          {request.blocks && request.blocks.length > 0 ? (
            <RequestCompletionBlocks
              blocks={request.blocks}
              responses={responses}
              invalidKeys={invalidKeys}
              onChange={onChange}
            />
          ) : (
            <RequestCompletionFields
              fields={request.fields}
              responses={responses}
              invalidKeys={invalidKeys}
              onChange={onChange}
            />
          )}
        </div>
      </RequestCompletionDocument>
    );
  }

  return (
    <div className="nw-site nwrc">
      <main className="nwrc-main">{body}</main>
      {failed ? <RequestCompletionToast message={SUBMIT_FAILED} /> : null}
    </div>
  );
}

export default NavigatorRequestCompletionPage;
