import { useEffect, useRef, useState, type ReactNode } from 'react';
import { actions, useApp, type OrbitMode, type ViewPreset } from '../state/store';
import { useServices } from './context';
import { IconMinus, IconOrbitFixed, IconOrbitFree, IconPlus, IconReset, IconRotate } from './icons';

const VIEWS: { id: ViewPreset; short: string; label: string }[] = [
  { id: 'three-quarter', short: '¾', label: 'Three-quarter view' },
  { id: 'front', short: 'F', label: 'Front view' },
  { id: 'left', short: 'L', label: 'Left lateral view' },
  { id: 'right', short: 'R', label: 'Right lateral view' },
  { id: 'superior', short: 'S', label: 'Superior view' },
  { id: 'inferior', short: 'I', label: 'Inferior view' },
  { id: 'occlusal-upper', short: 'OU', label: 'Occlusal view of the upper arch' },
  { id: 'occlusal-lower', short: 'OL', label: 'Occlusal view of the lower arch' },
];

const ORBIT_MODES: { id: OrbitMode; label: string; icon: ReactNode }[] = [
  { id: 'fixed', label: 'Fixed orbit: always turn around the model centre', icon: <IconOrbitFixed /> },
  { id: 'free', label: 'Free orbit: pan and focus move the pivot', icon: <IconOrbitFree /> },
];

/** How long a label stays up after a touch tap (touch has no hover). */
const TOUCH_TIP_MS = 1600;

/** Remembers that the first-visit label peek has been shown. */
const PEEK_KEY = 'ds.railPeek';

/**
 * First visit on a pointer device: once the model is ready, slide every rail label out for a
 * moment so people see what the buttons do. Shown once per browser; any hover on the rail ends it.
 */
function useFirstVisitPeek(): [boolean, () => void] {
  const ready = useApp((s) => s.ready);
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem(PEEK_KEY)) return;
      localStorage.setItem(PEEK_KEY, '1');
    } catch {
      return; // no storage: skip rather than show it on every visit
    }
    if (!matchMedia('(hover: hover) and (min-width: 768px)').matches) return;
    const on = window.setTimeout(() => setPeek(true), 700);
    const off = window.setTimeout(() => setPeek(false), 3600);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [ready]);
  return [peek, () => setPeek(false)];
}

export function ViewRail() {
  const { engine } = useServices();
  const view = useApp((s) => s.view);
  const auto = useApp((s) => s.autoRotate);
  const orbit = useApp((s) => s.orbitMode);
  const mobileOpen = useApp((s) => s.mobileSheet === 'tools');
  // label currently shown for touch, hover or focus; drives the tip on touch and the mobile caption
  const [tipLabel, setTipLabel] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const showTip = (label: string | null, ms?: number) => {
    clearTimeout(timer.current);
    setTipLabel(label);
    if (label && ms) timer.current = window.setTimeout(() => setTipLabel(null), ms);
  };
  const [peek, endPeek] = useFirstVisitPeek();
  // position in the rail, staggers the first-visit peek
  let order = 0;
  const tipProps = (label: string, shortcut?: string) => ({ label, shortcut, tipShown: tipLabel === label, showTip, order: order++ });

  return (
    <>
      <nav className={`ds-rail ds-panel${mobileOpen ? ' is-mobile-open' : ''}${peek ? ' is-peek' : ''}`} aria-label="Camera views" onPointerEnter={endPeek}>
        <div className="ds-rail-group" role="group" aria-label="Orbit mode">
          {ORBIT_MODES.map((m) => (
            <RailButton key={m.id} {...tipProps(m.label)} pressed={orbit === m.id} onClick={() => actions.setOrbitMode(m.id)}>
              {m.icon}
            </RailButton>
          ))}
        </div>
        <span className="ds-rail-sep" aria-hidden="true" />
        {VIEWS.map((v) => (
          <RailButton key={v.id} {...tipProps(v.label)} pressed={view === v.id} onClick={() => engine.setView(v.id)}>
            {v.short}
          </RailButton>
        ))}
        <span className="ds-rail-sep" aria-hidden="true" />
        <RailButton {...tipProps('Zoom in', '+')} onClick={() => engine.zoom(0.75)}>
          <IconPlus />
        </RailButton>
        <RailButton {...tipProps('Zoom out', '−')} onClick={() => engine.zoom(1.33)}>
          <IconMinus />
        </RailButton>
        <RailButton {...tipProps('Auto-rotate')} pressed={auto} onClick={() => actions.setAutoRotate(!auto)}>
          <IconRotate />
        </RailButton>
        <RailButton {...tipProps('Reset view', 'R')} onClick={() => engine.resetCamera()}>
          <IconReset />
        </RailButton>
      </nav>
      {mobileOpen && tipLabel && (
        <div className="ds-rail-caption" aria-hidden="true">
          {tipLabel}
        </div>
      )}
    </>
  );
}

interface RailButtonProps {
  label: string;
  /** keyboard shortcut shown in the label */
  shortcut?: string;
  /** toggle/selection state (omit for plain actions) */
  pressed?: boolean;
  tipShown: boolean;
  /** position in the rail (staggers the first-visit peek) */
  order: number;
  showTip: (label: string | null, ms?: number) => void;
  onClick: () => void;
  children: ReactNode;
}

/** Icon button with a text label that appears on hover, keyboard focus or touch. */
function RailButton({ label, shortcut, pressed, tipShown, order, showTip, onClick, children }: RailButtonProps) {
  return (
    <button
      type="button"
      className={`ds-rail-btn${pressed ? ' is-active' : ''}${tipShown ? ' is-tip-shown' : ''}`}
      onClick={onClick}
      onPointerDown={(e) => e.pointerType === 'touch' && showTip(label, TOUCH_TIP_MS)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && showTip(label)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && showTip(null)}
      onFocus={() => showTip(label)}
      onBlur={() => showTip(null)}
      aria-label={label}
      aria-pressed={pressed}
      style={{ '--i': order } as React.CSSProperties}
    >
      {children}
      <span className="ds-rail-tip" aria-hidden="true">
        <span className="ds-rail-tip-text">
          {label}
          {shortcut && <kbd>{shortcut}</kbd>}
        </span>
      </span>
    </button>
  );
}
