import { actions, useApp, type ViewPreset } from '../state/store';
import { useServices } from './context';
import { IconMinus, IconPlus, IconReset, IconRotate } from './icons';

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

export function ViewRail() {
  const { engine } = useServices();
  const view = useApp((s) => s.view);
  const auto = useApp((s) => s.autoRotate);
  const mobileOpen = useApp((s) => s.mobileSheet === 'tools');
  return (
    <nav className={`ds-rail ds-panel${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="Camera views">
      {VIEWS.map((v) => (
        <button key={v.id} type="button" className={`ds-rail-btn${view === v.id ? ' is-active' : ''}`} onClick={() => engine.setView(v.id)} aria-label={v.label} aria-pressed={view === v.id} title={v.label}>
          {v.short}
        </button>
      ))}
      <span className="ds-rail-sep" aria-hidden="true" />
      <button type="button" className="ds-rail-btn" onClick={() => engine.zoom(0.75)} aria-label="Zoom in" title="Zoom in (+)">
        <IconPlus />
      </button>
      <button type="button" className="ds-rail-btn" onClick={() => engine.zoom(1.33)} aria-label="Zoom out" title="Zoom out (−)">
        <IconMinus />
      </button>
      <button type="button" className={`ds-rail-btn${auto ? ' is-active' : ''}`} onClick={() => actions.setAutoRotate(!auto)} aria-pressed={auto} aria-label="Auto-rotate" title="Auto-rotate">
        <IconRotate />
      </button>
      <button type="button" className="ds-rail-btn" onClick={() => engine.resetCamera()} aria-label="Reset camera" title="Reset camera (R)">
        <IconReset />
      </button>
    </nav>
  );
}
