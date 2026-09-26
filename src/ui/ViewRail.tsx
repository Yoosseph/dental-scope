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
  const tipProps = (label: string, shortcut?: string) => ({ label, shortcut, tipShown: tipLabel === label, showTip });

  return (
    <>
      <nav className={`ds-rail ds-panel${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="Camera views">
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
  showTip: (label: string | null, ms?: number) => void;
  onClick: () => void;
  children: ReactNode;
}

/** Icon button with a text label that appears on hover, keyboard focus or touch. */
function RailButton({ label, shortcut, pressed, tipShown, showTip, onClick, children }: RailButtonProps) {
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
    >
      {children}
      <span className="ds-rail-tip" aria-hidden="true">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}
