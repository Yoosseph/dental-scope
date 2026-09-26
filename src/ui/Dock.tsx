import { useEffect, useId, useRef, useState } from 'react';
import { formatTooth } from '../anatomy/notation';
import { pushCurrentPath } from '../app/router';
import { actions, DISSECT_LEVELS, getState, useApp, type ClipAxis } from '../state/store';
import { CameraControls } from './CameraControls';
import { useServices } from './context';
import { IconArrowLeft, IconExplode, IconFlip, IconLabel, IconPause, IconPlay, IconReplay, IconSection, IconWarning } from './icons';

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

/**
 * Arch dissection on one track: 0 → 1 pulls the structures apart in position (store `explode`),
 * the checkpoint at 1 is "In position", and 1 → 2 lays them out on the board (phase 2).
 * Play runs to the next stop: from anywhere before the checkpoint it stops at the checkpoint,
 * from the checkpoint it continues to "Laid out", and at the end it replays from the start.
 */
const PLAY_SECONDS_TO_CHECKPOINT = 2.2;
const PLAY_SECONDS_TO_LAYOUT = 1.2;

function ArchControls() {
  const explode = useApp((s) => s.explode);
  const phase = useApp((s) => s.explodePhase);
  const labels = useApp((s) => s.labels);
  const loading = useApp((s) => s.loading.teeth);
  const clip = useApp((s) => s.clip.enabled);
  // UI-only positions on the right half, where the store is discrete (phase 1 or 2)
  const [local, setLocal] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const stored = phase === 2 ? 2 : explode;
  const value = local ?? stored;
  const atEnd = phase === 2 && local === null;

  const stop = () => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // the global Reset button stops playback and clears the local dot position
  const resetId = useApp((s) => s.resetId);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setLocal(null);
  }, [resetId]);

  const tween = (from: number, to: number, seconds: number, apply: (v: number) => void, done: () => void) => {
    const t0 = performance.now();
    const ms = Math.max(1, seconds * 1000);
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      apply(from + (to - from) * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else done();
    };
    raf.current = requestAnimationFrame(tick);
  };

  const play = () => {
    if (playing) return stop();
    const s = getState();
    let from = s.explodePhase === 2 ? 2 : s.explode;
    if (from >= 2) {
      // replay from the start
      actions.setExplode(0);
      from = 0;
    }
    setPlaying(true);
    if (from < 1) {
      tween(from, 1, (1 - from) * PLAY_SECONDS_TO_CHECKPOINT, actions.setExplode, () => {
        actions.setExplode(1);
        setPlaying(false); // pause at the checkpoint
      });
    } else {
      actions.setExplodePhase(2);
      tween(1, 2, PLAY_SECONDS_TO_LAYOUT, setLocal, () => {
        setLocal(null);
        setPlaying(false);
      });
    }
  };

  const scrub = (v: number) => {
    stop();
    if (v <= 1) {
      setLocal(null);
      actions.setExplode(v);
      return;
    }
    setLocal(v);
    const s = getState();
    if (v >= 1.5 && s.explodePhase !== 2) actions.setExplodePhase(2);
    else if (v < 1.5 && s.explodePhase === 2) {
      actions.setExplodePhase(1);
      actions.setExplode(1);
    }
  };
  // releasing on the right half snaps to the nearer stop
  const release = () => {
    if (local === null || playing) return;
    setLocal(null);
  };

  const readout = value < 1 ? `${Math.round(value * 100)}%` : value < 1.5 ? 'In position' : 'Laid out';
  const playLabel = playing ? 'Pause' : atEnd ? 'Replay dissection' : value >= 1 ? 'Play: lay out every structure' : 'Play: pull apart to in position';

  return (
    <div className="ds-dock-main">
      <button type="button" className={`ds-play${playing ? ' is-playing' : ''}`} onClick={play} aria-label={playLabel} title={playLabel}>
        {playing ? <IconPause size={16} /> : atEnd ? <IconReplay size={16} /> : <IconPlay size={16} />}
      </button>
      <div className="ds-slider ds-slider--dissect">
        <div className="ds-slider-head">
          <span className="ds-slider-label">
            <IconExplode size={15} /> Dissect anatomy
          </span>
          <span className="ds-slider-value">{readout}</span>
        </div>
        <div className="ds-range-wrap">
          <span className={`ds-checkpoint${value >= 1 ? ' is-past' : ''}${Math.abs(value - 1) < 0.04 ? ' is-under-thumb' : ''}`} aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={value}
            onChange={(e) => scrub(Number(e.target.value))}
            onPointerUp={release}
            onKeyUp={release}
            onBlur={release}
            aria-label="Dissect anatomy"
            aria-valuetext={readout}
            className="ds-range"
            style={{ ['--fill' as string]: `${(value / 2) * 100}%` }}
          />
        </div>
        <div className="ds-slider-ends ds-slider-ends--three" aria-hidden="true">
          <span>Assembled</span>
          <span>In position</span>
          <span>Laid out</span>
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
