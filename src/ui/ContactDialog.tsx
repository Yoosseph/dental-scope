import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CONTACT_KINDS, CONTACT_LIMITS, ISSUES_URL, sendContact, type ContactKind, type ContactResult } from '../app/contact';
import { useT } from '../i18n';
import { CONTACT_TEXT } from '../i18n/contact';
import { actions, getState, useApp } from '../state/store';
import { IconClose, IconExternal } from './icons';

type Status = 'idle' | 'sending' | ContactResult;

/** "Feedback" dialog: a short form emailed to the maintainer via /api/contact. */
export function ContactDialog() {
  const open = useApp((s) => s.contactOpen);
  const lang = useApp((s) => s.lang);
  const text = CONTACT_TEXT[lang];
  const m = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ContactKind>('issue');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  const close = () => {
    actions.openContact(false);
    // keep a typed draft; start fresh after a successful send
    if (status === 'sent') { setMessage(''); setStatus('idle'); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    const result = await sendContact({
      kind, name, email, message, website, lang,
      page: window.location.href,
      selection: getState().selectedId ?? '',
    });
    setStatus(result);
  };

  const notice = status === 'invalid' ? text.invalid : status === 'rate_limited' ? text.rateLimited : status === 'failed' ? text.failed : status === 'unavailable' ? text.unavailable : null;
  const githubLink = (
    <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
      {text.github} <IconExternal size={11} />
    </a>
  );

  return (
    <dialog ref={ref} className="ds-about ds-contact ds-panel" aria-labelledby="ds-contact-title"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <button type="button" className="ds-icon-btn ds-icon-btn--ghost ds-about-close" onClick={close} aria-label={m.close}>
        <IconClose />
      </button>
      <h2 id="ds-contact-title">{text.title}</h2>
      {status === 'sent' ? (
        <div className="ds-contact-done">
          <p role="status">{text.sent}</p>
          <button type="button" className="ds-primary" onClick={() => { setMessage(''); setStatus('idle'); }}>{text.sendAnother}</button>
        </div>
      ) : (
        <form className="ds-contact-form" onSubmit={(e) => void submit(e)}>
          <p>{text.intro}</p>
          <fieldset className="ds-contact-kinds">
            <legend>{text.kind}</legend>
            {CONTACT_KINDS.map((k) => (
              <label key={k}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                {text.kinds[k]}
              </label>
            ))}
          </fieldset>
          <label className="ds-contact-field">
            <span>{text.name}</span>
            <input type="text" name="name" autoComplete="name" maxLength={CONTACT_LIMITS.name} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ds-contact-field">
            <span>{text.email}</span>
            <input type="email" name="email" autoComplete="email" maxLength={CONTACT_LIMITS.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="ds-contact-field">
            <span>{text.message}</span>
            <textarea name="message" required rows={6} minLength={CONTACT_LIMITS.minMessage} maxLength={CONTACT_LIMITS.message}
              aria-describedby="ds-contact-hint" value={message} onChange={(e) => setMessage(e.target.value)} />
            <small id="ds-contact-hint">{text.messageHint}</small>
          </label>
          {/* honeypot: off-screen and skipped by assistive tech; people leave it empty */}
          <div className="ds-contact-hp" aria-hidden="true">
            <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>
          <p className="ds-contact-note">{text.context} {text.privacy}</p>
          {notice && <p className="ds-contact-error" role="alert">{notice}</p>}
          <div className="ds-contact-actions">
            <button type="submit" className="ds-primary" disabled={status === 'sending'}>{status === 'sending' ? text.sending : text.send}</button>
            {githubLink}
          </div>
        </form>
      )}
    </dialog>
  );
}
