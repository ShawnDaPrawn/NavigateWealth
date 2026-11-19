/**
 * PressBoilerplate — the paragraph journalists may quote about the firm, and a
 * button that copies it.
 *
 * The page builds the text from companyFacts.ts, so every fact in it is one a
 * reader can check. If the browser refuses the clipboard (an insecure context,
 * a denied permission), the text is selected instead, ready to copy by hand,
 * and the button does not claim to have copied it.
 */
import { useRef, useState } from 'react';
import { PressIcon } from './PressIcons';
import '../styles/sections.css';
import '../styles/press.css';

interface PressBoilerplateProps {
  index: string;
  title: string;
  note: string;
  text: string;
}

export function PressBoilerplate({ index, title, note, text }: PressBoilerplateProps) {
  const [copied, setCopied] = useState(false);
  const quoteRef = useRef<HTMLQuoteElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const node = quoteRef.current;
      const selection = window.getSelection();
      if (!node || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  return (
    <section className="nwpr2-boiler" aria-labelledby="nwpr2-boiler-title">
      <div className="nw-wrap">
        <div className="nwpr2-boiler-card">
          <div>
            <p className="nw-kicker nw-mono">{`${index} — Boilerplate`}</p>
            <h2 id="nwpr2-boiler-title" className="nwpr2-boiler-title">
              {title}
            </h2>
            <p className="nwpr2-boiler-note">{note}</p>
            <button type="button" className="nw-outline nwpr2-copy" onClick={copy}>
              <PressIcon name="copy" size={16} />
              {copied ? 'Copied' : 'Copy boilerplate'}
            </button>
            <span className="nw-sr-only" role="status">
              {copied ? 'Boilerplate copied to the clipboard' : ''}
            </span>
          </div>
          <blockquote ref={quoteRef} className="nwpr2-quote">
            {text}
          </blockquote>
        </div>
      </div>
    </section>
  );
}
