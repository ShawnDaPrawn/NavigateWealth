/**
 * "How it works" under the verification card — the live page's three steps
 * and its privacy line, laid out as the "Verify Document" board draws them.
 */
import { VerifyDocumentIcon } from './VerifyDocumentIcons';

/** The live page's steps, word for word. */
const STEPS = [
  { step: '1', title: 'Upload', desc: 'Drop your signed PDF into the verification area' },
  {
    step: '2',
    title: 'Hash',
    desc: 'A SHA-256 fingerprint is computed locally in your browser',
  },
  {
    step: '3',
    title: 'Verify',
    desc: 'The fingerprint is matched against our signing records',
  },
] as const;

export function VerifyDocumentSteps() {
  return (
    <section className="nwvd-how" aria-labelledby="nwvd-how-title">
      <h3 id="nwvd-how-title" className="nwvd-sub nwvd-how-title">
        How it works
      </h3>
      <ol className="nwvd-steps">
        {STEPS.map((item) => (
          <li key={item.step} className="nwvd-step">
            <span className="nwvd-step-num nw-mono">{item.step}</span>
            <p className="nwvd-step-title">{item.title}</p>
            <p className="nwvd-step-desc">{item.desc}</p>
          </li>
        ))}
      </ol>
      <p className="nwvd-privacy">
        <VerifyDocumentIcon name="lock" size={15} stroke="#0D1626" className="nwvd-privacy-icon" />
        Your file never leaves your device. Only the computed hash is sent for verification.
      </p>
    </section>
  );
}
