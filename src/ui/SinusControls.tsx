import { useApp } from '../state/store';
import { useServices } from './context';
import { STUDY_TEXT } from '../i18n/study';
import { nameOf } from '../i18n';
export function SinusControls() {
  const study = useApp(s => s.studyView), lang = useApp(s => s.lang);
  const { registry, engine } = useServices();
  if (study !== 'sinuses') return null;
  const text = STUDY_TEXT[lang];
  const groups = ['maxillary-sinus', 'frontal-sinus', 'sphenoidal-sinus', 'ethmoidal-air-cells'];
  return <section className="ds-study-controls" aria-label={text.sinuses}>
    <p className="ds-layer-hint">{text.sinusHint}</p>
    <div className="ds-chip-row">{groups.map(id => <button type="button" key={id} className="ds-chip ds-chip--button" onClick={() => void engine.selectFromUI(id, { focus: true })}>{nameOf(registry.require(id), lang)}</button>)}</div>
    <select className="ds-study-select" aria-label={text.sinusView} value="" onChange={e => { if (e.target.value) void engine.selectFromUI(e.target.value, { focus: true }); }}>
      <option value="">{text.sinusView}</option>{groups.flatMap(id => ['right', 'left'].map(side => <option key={`${id}-${side}`} value={`${id}-${side}`}>{nameOf(registry.require(`${id}-${side}`), lang)}</option>))}
    </select>
  </section>;
}
