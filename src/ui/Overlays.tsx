import { useEffect, useRef } from 'react';
import { actions, useApp } from '../state/store';
import { IconClose } from './icons';

const STAGE_LABEL: Record<string, string> = {
  core: 'Jaws & dentition',
  context: 'Skull & muscles',
  neurovascular: 'Nerves & vessels',
};

export function LoadingCard() {
  const ready = useApp((s) => s.ready);
  const loading = useApp((s) => s.loading);
  const error = useApp((s) => s.error);
  if (error) {
    return (
      <div className="ds-loading ds-panel" role="alert">
        <strong>Something went wrong</strong>
        <p>{error}</p>
      </div>
    );
  }
  const stages = Object.keys(STAGE_LABEL);
  const pending = stages.filter((s) => (loading[s] ?? 0) < 1);
  if (ready && pending.length === 0) return null;
  const done = stages.reduce((a, s) => a + (loading[s] ?? 0), 0) / stages.length;
  return (
    <div className={`ds-loading ds-panel${ready ? ' is-compact' : ''}`} role="status" aria-live="polite">
      <div className="ds-loading-head">
        <span className="ds-spinner" aria-hidden="true" />
        <span>{ready ? `Loading ${STAGE_LABEL[pending[0]]?.toLowerCase()}…` : 'Preparing dental anatomy'}</span>
      </div>
      {!ready && (
        <>
          <div className="ds-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(0.04, done)})` }} />
          </div>
          <ul className="ds-loading-stages">
            {stages.map((s) => (
              <li key={s} className={(loading[s] ?? 0) >= 1 ? 'is-done' : ''}>
                {STAGE_LABEL[s]}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="ds-footer">
      <p className="ds-hints" aria-hidden="true">
        Drag to orbit · Scroll to zoom · Right-drag to pan · Click to inspect · Double-click to focus
      </p>
      <p className="ds-disclaimer">
        Educational anatomical reference. Not intended for diagnosis or treatment.{' '}
        <button type="button" className="ds-link-btn" onClick={() => actions.openAbout(true)}>
          Sources &amp; credits
        </button>
      </p>
    </footer>
  );
}

export function AboutDialog() {
  const open = useApp((s) => s.aboutOpen);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="ds-about ds-panel" onClose={() => actions.openAbout(false)} aria-labelledby="ds-about-title">
      <button type="button" className="ds-icon-btn ds-icon-btn--ghost ds-about-close" onClick={() => actions.openAbout(false)} aria-label="Close">
        <IconClose />
      </button>
      <h2 id="ds-about-title">About Dental Scope</h2>
      <p>
        Dental Scope is an open-source, interactive 3D explorer of dental anatomy — from the whole mouth down to the pulp and root canals of a single tooth.
      </p>
      <h3>Educational use only</h3>
      <p>Dental Scope is an educational reference. It is not a diagnostic tool and must not be used for diagnosis, treatment planning or clinical decisions.</p>
      <h3>How the anatomy is made</h3>
      <ul>
        <li>
          <strong>Source</strong> — jaws, teeth, gingiva, skull and muscles come from <em>BodyParts3D</em>, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan.
        </li>
        <li>
          <strong>Derived</strong> — third molars, alveolar bone, condyles and joint fossae are derived from those meshes.
        </li>
        <li>
          <strong>Modeled</strong> — enamel, dentin, cementum, periodontal ligament, pulp and canals are modeled inside each real tooth shape using typical proportions.
        </li>
        <li>
          <strong>Schematic</strong> — nerves, vessels and joint discs are placed from anatomical landmarks to show relationships, not measured paths.
        </li>
      </ul>
      <p>Every structure shows which of these applies. Text marked “draft” is pending expert review.</p>
      <h3>Keyboard</h3>
      <dl className="ds-keys">
        <dt>/</dt>
        <dd>Search</dd>
        <dt>Esc</dt>
        <dd>Clear selection / leave tooth</dd>
        <dt>F</dt>
        <dd>Focus selection</dd>
        <dt>I · H · G</dt>
        <dd>Isolate · hide · ghost selection</dd>
        <dt>D</dt>
        <dd>Explore inside the selected tooth</dd>
        <dt>[ · ]</dt>
        <dd>Dissection level</dd>
        <dt>E · C · L</dt>
        <dd>Explode · section · labels</dd>
        <dt>Arrows · + −</dt>
        <dd>Orbit · zoom</dd>
        <dt>R</dt>
        <dd>Reset camera</dd>
      </dl>
      <p className="ds-about-foot">
        Code MIT · Models CC BY-SA 2.1 JP · Text CC BY-SA 4.0 ·{' '}
        <a href="https://github.com/Yoosseph/dental-scope" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </p>
    </dialog>
  );
}
