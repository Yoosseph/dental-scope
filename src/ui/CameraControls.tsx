import { useEffect, useRef, useState, type ReactNode } from 'react';
import { actions, useApp, type OrbitMode, type ViewPreset } from '../state/store';
import { useServices } from './context';
import {
  IconMinus,
  IconOrbitFixed,
  IconOrbitFree,
  IconPlus,
  IconReset,
  IconRotate,
  IconView,
  IconViewFront,
  IconViewInferior,
  IconViewLeft,
  IconViewOcclusalLower,
  IconViewOcclusalUpper,
  IconViewRight,
  IconViewSuperior,
  IconViewThreeQuarter,
} from './icons';

export const VIEWS: { id: ViewPreset; label: string; short: string; icon: ReactNode }[] = [
  { id: 'three-quarter', label: 'Three-quarter view', short: '¾ view', icon: <IconViewThreeQuarter size={18} /> },
  { id: 'front', label: 'Front view', short: 'Front', icon: <IconViewFront size={18} /> },
  { id: 'left', label: 'Left lateral view', short: 'Left', icon: <IconViewLeft size={18} /> },
  { id: 'right', label: 'Right lateral view', short: 'Right', icon: <IconViewRight size={18} /> },
  { id: 'superior', label: 'Superior view', short: 'Top', icon: <IconViewSuperior size={18} /> },
  { id: 'inferior', label: 'Inferior view', short: 'Bottom', icon: <IconViewInferior size={18} /> },
  { id: 'occlusal-upper', label: 'Occlusal view of the upper arch', short: 'Upper arch', icon: <IconViewOcclusalUpper size={18} /> },
  { id: 'occlusal-lower', label: 'Occlusal view of the lower arch', short: 'Lower arch', icon: <IconViewOcclusalLower size={18} /> },
];

const ORBIT_MODES: { id: OrbitMode; label: string; icon: ReactNode }[] = [
  { id: 'fixed', label: 'Fixed orbit: always turn around the model centre', icon: <IconOrbitFixed /> },
  { id: 'free', label: 'Free orbit: pan and focus move the pivot', icon: <IconOrbitFree /> },
];

/** How long a label stays up after a touch tap (touch has no hover). */
const TOUCH_TIP_MS = 1600;

/** Remembers that the first-visit label peek has been shown. */
const PEEK_KEY = 'ds.railPeek';
/** How long each view's name is shown during the first-visit peek. */
const PEEK_STEP_MS = 420;

/**
 * First visit on a pointer device: once the model is ready, name each view button in turn so people
 * see what the pictograms mean. Shown once per browser; any hover on the toolbar ends it.
 * Returns the label currently being peeked (or null) and a function that ends the peek.
 */
function useFirstVisitPeek(): [string | null, () => void] {
  const ready = useApp((s) => s.ready);
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem(PEEK_KEY)) return;
      localStorage.setItem(PEEK_KEY, '1');
    } catch {
      return; // no storage: skip rather than show it on every visit
    }
    if (!matchMedia('(hover: hover) and (min-width: 1100px)').matches) return;
    const timers = VIEWS.map((_, i) => window.setTimeout(() => setStep(i), 700 + i * PEEK_STEP_MS));
    timers.push(window.setTimeout(() => setStep(-1), 700 + VIEWS.length * PEEK_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [ready]);
  return [step >= 0 ? VIEWS[step].label : null, () => setStep(-1)];
}

/**
 * Camera row of the bottom toolbar: orbit mode, the eight view presets (as pictograms, or folded
 * into a single View button on narrow screens), zoom, auto-rotate and reset.
 */
export function CameraControls() {
  const { engine } = useServices();
  const view = useApp((s) => s.view);
  const auto = useApp((s) => s.autoRotate);
  const orbit = useApp((s) => s.orbitMode);
  // label shown for touch, hover or focus: drives the touch tip and the peek
  const [tipLabel, setTipLabel] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const showTip = (label: string | null, ms?: number) => {
    clearTimeout(timer.current);
    setTipLabel(label);
    if (label && ms) timer.current = window.setTimeout(() => setTipLabel(null), ms);
  };
  const [peekLabel, endPeek] = useFirstVisitPeek();
  const shown = peekLabel ?? tipLabel;
  const tip = (label: string, shortcut?: string) => ({ label, shortcut, tipShown: shown === label, showTip });

  return (
    <div className="ds-camera" role="group" aria-label="Camera" onPointerEnter={endPeek}>
      <div className="ds-tb-group" role="group" aria-label="Orbit mode">
        {ORBIT_MODES.map((m) => (
          <ToolbarButton key={m.id} {...tip(m.label)} pressed={orbit === m.id} onClick={() => actions.setOrbitMode(m.id)}>
            {m.icon}
          </ToolbarButton>
        ))}
      </div>
      <span className="ds-tb-sep" aria-hidden="true" />
      <div className="ds-tb-group ds-views" role="group" aria-label="Camera views">
        {VIEWS.map((v) => (
          <ToolbarButton key={v.id} {...tip(v.label)} pressed={view === v.id} onClick={() => engine.setView(v.id)}>
            {v.icon}
          </ToolbarButton>
        ))}
      </div>
      <ViewPicker />
      <span className="ds-tb-sep" aria-hidden="true" />
      <div className="ds-tb-group" role="group" aria-label="Zoom and rotation">
        <ToolbarButton {...tip('Zoom in', '+')} onClick={() => engine.zoom(0.75)}>
          <IconPlus />
        </ToolbarButton>
        <ToolbarButton {...tip('Zoom out', '−')} onClick={() => engine.zoom(1.33)}>
          <IconMinus />
        </ToolbarButton>
        <ToolbarButton {...tip('Auto-rotate')} pressed={auto} onClick={() => actions.setAutoRotate(!auto)}>
          <IconRotate />
        </ToolbarButton>
        <ToolbarButton {...tip('Reset view', 'R')} onClick={() => engine.resetCamera()}>
          <IconReset />
        </ToolbarButton>
      </div>
    </div>
  );
}

/**
 * The view presets folded into one button, for narrow screens: opens a small grid of the pictograms
 * with their names. Hidden by CSS where the full row of view buttons fits.
 */
function ViewPicker() {
  const { engine } = useServices();
  const view = useApp((s) => s.view);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = VIEWS.find((v) => v.id === view);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('.ds-view-picker-btn')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    // move focus into the grid, on the current view
    root.current?.querySelector<HTMLButtonElement>('.ds-view-grid [aria-pressed="true"], .ds-view-grid button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="ds-view-picker" ref={root}>
      <button type="button" className={`ds-tb-btn ds-view-picker-btn${open ? ' is-open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true" aria-label={`Camera view${current ? `: ${current.label}` : ''}`}>
        {current?.icon ?? <IconView size={18} />}
        <span className="ds-view-picker-text">View</span>
      </button>
      {open && (
        <div className="ds-panel ds-view-grid" role="group" aria-label="Camera views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={view === v.id ? 'is-active' : ''}
              aria-pressed={view === v.id}
              aria-label={v.label}
              onClick={() => {
                engine.setView(v.id);
                setOpen(false);
              }}
            >
              {v.icon}
              <span aria-hidden="true">{v.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  /** keyboard shortcut shown in the label */
  shortcut?: string;
  /** toggle/selection state (omit for plain actions) */
  pressed?: boolean;
  tipShown: boolean;
  showTip: (label: string | null, ms?: number) => void;
  onClick: () => void;
  children: ReactNode;
}

/** Icon button whose name appears just above it on hover, keyboard focus or a touch tap. */
function ToolbarButton({ label, shortcut, pressed, tipShown, showTip, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`ds-tb-btn${pressed ? ' is-active' : ''}${tipShown ? ' is-tip-shown' : ''}`}
      onClick={onClick}
      onPointerDown={(e) => e.pointerType === 'touch' && showTip(label, TOUCH_TIP_MS)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && showTip(label)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && showTip(null)}
      onFocus={() => showTip(label)}
      onBlur={() => showTip(null)}
      aria-label={label}
      aria-pressed={pressed}
    >
      {children}
      <span className="ds-tb-tip" aria-hidden="true">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}
