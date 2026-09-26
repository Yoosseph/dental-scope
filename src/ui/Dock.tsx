import { useId } from 'react';
import { formatTooth } from '../anatomy/notation';
import { pushCurrentPath } from '../app/router';
import { actions, DISSECT_LEVELS, useApp, type ClipAxis, type ExplodePhase } from '../state/store';
import { CameraControls } from './CameraControls';
import { useServices } from './context';
import { IconArrowLeft, IconExplode, IconFlip, IconLabel, IconSection, IconWarning } from './icons';

const PHASES: { id: ExplodePhase; label: string; title: string }[] = [
  { id: 1, label: 'In position', title: 'Structures pulled apart but kept in anatomical position' },
  { id: 2, label: 'Laid out', title: 'Every structure fully separated and laid out side by side for inspection' },
];

const AXES: { id: ClipAxis; label: string; title: string }[] = [
  { id: 'sagittal', label: 'Sagittal', title: 'Sagittal plane (left–right cut)' },
  { id: 'coronal', label: 'Coronal', title: 'Coronal plane (front–back cut)' },
  { id: 'axial', label: 'Axial', title: 'Axial plane (horizontal cut)' },
  { id: 'view', label: 'View', title: 'Plane facing the camera' },
];

export function Dock() {
  const dissectFdi = useApp((s) => s.dissectFdi);
  const mobileOpen = useApp((s) => s.mobileSheet === 'tools');
  return (
    <div className={`ds-dock${mobileOpen ? ' is-mobile-open' : ''}`}>
      <div className="ds-panel ds-toolbar" role="toolbar" aria-label={dissectFdi !== null ? 'Camera and tooth dissection tools' : 'Camera and scene tools'}>
        <CameraControls />
        {dissectFdi !== null ? <DissectControls fdi={dissectFdi} /> : <ArchControls />}
      </div>
      <SectionControls />
    </div>
  );
}

function ArchControls() {
  const explode = useApp((s) => s.explode);
  const phase = useApp((s) => s.explodePhase);
  const labels = useApp((s) => s.labels);
  const loading = useApp((s) => s.loading.teeth);
  const clip = useApp((s) => s.clip.enabled);
  return (
    <div className="ds-dock-main">
      <div className="ds-dock-stack">
        <Slider label="Dissect anatomy" icon={<IconExplode size={15} />} value={explode} onChange={actions.setExplode} left="Assembled" right="Separated" />
        <div className="ds-segmented ds-segmented--fill ds-phase-switch" role="group" aria-label="Dissection phase">
          {PHASES.map((st) => (
            <button key={st.id} type="button" className={phase === st.id ? 'is-active' : ''} aria-pressed={phase === st.id} onClick={() => actions.setExplodePhase(st.id)} title={st.title}>
              <span className="ds-phase-num" aria-hidden="true">
                {st.id}
              </span>
              {st.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ds-dock-tools">
        <ToolToggle active={clip} onClick={() => actions.setClip({ enabled: !clip })} icon={<IconSection />} label="Section" title="Cross-section (C)" />
        <LabelsToggle active={labels} />
      </div>
      {clip && loading !== undefined && loading < 1 && <div className="ds-dock-note">Loading internal tooth anatomy… {Math.round(loading * 100)}%</div>}
    </div>
  );
}

function DissectControls({ fdi }: { fdi: number }) {
  const { registry, engine } = useServices();
  const level = useApp((s) => s.dissectLevel);
  const tex = useApp((s) => s.toothExplode);
  const numbering = useApp((s) => s.numbering);
  const labels = useApp((s) => s.labels);
  const clip = useApp((s) => s.clip.enabled);
  const ctx = useApp((s) => s.isolateContext);
  const tooth = registry.get(`tooth-${fdi}`)!;
  const exit = () => {
    actions.exitDissect();
    actions.select(`tooth-${fdi}`);
    engine.focus(`tooth-${fdi}`);
    pushCurrentPath(registry);
  };
  return (
    <div className="ds-dock-main ds-dissect">
      <div className="ds-dissect-head">
        <button type="button" className="ds-icon-btn ds-icon-btn--ghost" onClick={exit} aria-label="Back to full mouth" title="Back to full mouth (Esc)">
          <IconArrowLeft />
        </button>
        <div>
          <div className="ds-label-sm">Inside the tooth</div>
          <div className="ds-dissect-title">
            <span className="ds-chip ds-chip--mono">{formatTooth(fdi, numbering)}</span> {tooth.name}
          </div>
        </div>
      </div>
      <div className="ds-steps" role="radiogroup" aria-label="Dissection level">
        {DISSECT_LEVELS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className={`ds-step${level === l.id ? ' is-active' : ''}${level > l.id ? ' is-past' : ''}`} onClick={() => actions.setDissectLevel(l.id)} title={l.hint}>
            <span className="ds-step-dot" aria-hidden="true" />
            <span className="ds-step-label">{l.label}</span>
          </button>
        ))}
      </div>
      <p className="ds-step-hint">{DISSECT_LEVELS[level].hint}</p>
      <Slider label="Separate layers" icon={<IconExplode size={15} />} value={tex} onChange={actions.setToothExplode} left="Together" right="Apart" />
      <div className="ds-dock-tools">
        <ToolToggle active={clip} onClick={() => actions.setClip({ enabled: !clip, axis: 'sagittal', offset: 0 })} icon={<IconSection />} label="Section" title="Cross-section (C)" />
        <LabelsToggle active={labels} />
        <ToolToggle active={ctx} onClick={() => actions.setIsolateContext(!ctx)} icon={<IconExplode />} label="Context" title="Show surrounding anatomy" />
      </div>
    </div>
  );
}

const TOOTH_AXIS_LABEL: Record<ClipAxis, [string, string]> = {
  sagittal: ['Mesiodistal', 'Mesiodistal plane of the tooth'],
  coronal: ['Buccolingual', 'Buccolingual plane of the tooth'],
  axial: ['Horizontal', 'Horizontal cross-section of the tooth'],
  view: ['View', 'Plane facing the camera'],
};

function SectionControls() {
  const clip = useApp((s) => s.clip);
  const inTooth = useApp((s) => s.dissectFdi !== null);
  if (!clip.enabled) return null;
  return (
    <div className="ds-panel ds-section-panel" role="group" aria-label="Cross-section">
      <div className="ds-segmented ds-segmented--fill" role="radiogroup" aria-label="Section plane">
        {AXES.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={clip.axis === a.id} className={clip.axis === a.id ? 'is-active' : ''} onClick={() => actions.setClip({ axis: a.id, offset: 0 })} title={inTooth ? TOOTH_AXIS_LABEL[a.id][1] : a.title}>
            {inTooth ? TOOTH_AXIS_LABEL[a.id][0] : a.label}
          </button>
        ))}
      </div>
      <div className="ds-section-row">
        <input
          type="range"
          min={-1}
          max={1}
          step={0.005}
          value={clip.offset}
          onChange={(e) => actions.setClip({ offset: Number(e.target.value) })}
          aria-label="Section position"
          className="ds-range"
        />
        <button type="button" className="ds-icon-btn" onClick={() => actions.setClip({ flip: !clip.flip })} aria-label="Flip section side" title="Flip side">
          <IconFlip />
        </button>
      </div>
    </div>
  );
}

function Slider({ label, icon, value, onChange, left, right }: { label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void; left: string; right: string }) {
  return (
    <div className="ds-slider">
      <div className="ds-slider-head">
        <span className="ds-slider-label">
          {icon} {label}
        </span>
        <span className="ds-slider-value">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={`${Math.round(value * 100)} percent`} className="ds-range" />
      <div className="ds-slider-ends" aria-hidden="true">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function LabelsToggle({ active }: { active: boolean }) {
  const warnId = useId();
  return (
    <span className="ds-tool-wrap">
      <ToolToggle active={active} onClick={() => actions.toggleLabels()} icon={<IconLabel />} label="Labels" describedBy={warnId} />
      {/* styled tooltip instead of a native title, so the performance note is visible on hover and keyboard focus */}
      <span className="ds-tool-warn" role="tooltip" id={warnId}>
        <IconWarning size={13} />
        May cause lag on slower devices
        <kbd>L</kbd>
      </span>
    </span>
  );
}

function ToolToggle({
  active,
  onClick,
  icon,
  label,
  title,
  describedBy,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
  describedBy?: string;
}) {
  return (
    <button type="button" className={`ds-tool${active ? ' is-active' : ''}`} onClick={onClick} aria-pressed={active} title={title} aria-describedby={describedBy}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
