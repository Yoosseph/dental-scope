/** Local Vite/Chromium engineering review. Baseline poses are replayed exactly. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const phase = process.argv[2] || 'before';
const base = 'docs/screenshots/tooth-review';
mkdirSync(`${base}/${phase}`, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5174/?motion=reduce');
await page.waitForFunction(() => window.ds?.engine?.rig && window.ds.engine.entries.size > 90);
await page.evaluate(async () => { window.reviewStore = await import('/src/state/store.ts'); window.reviewStore.setState({ lang: 'en', labels: false, orbitMode: 'free' }); });
const poses = phase === 'before' ? {} : JSON.parse(readFileSync(`${base}/poses.json`));
const checks = [];
for (const fdi of process.env.REVIEW_TEETH?.split(',').map(Number) || [11,12,13,14,15,16,17,31,32,33,34,35,36,37]) {
  for (const surface of ['occlusal','facial','inner','mesial','distal']) {
    await page.evaluate(async ({ fdi, surface }) => { await window.ds.engine.studyToothSurface(fdi, surface); }, { fdi, surface });
    await page.waitForTimeout(350);
    const id = `${fdi}-${surface}`;
    if (phase === 'before') poses[id] = await page.evaluate(() => { const r = window.ds.engine.rig; return { position: r.camera.position.toArray(), target: r.controls.target.toArray(), zoom: r.camera.zoom }; });
    else await page.evaluate(p => { const e = window.ds.engine; e.rig.camera.position.fromArray(p.position); e.rig.controls.target.fromArray(p.target); e.rig.camera.zoom = p.zoom; e.rig.camera.updateProjectionMatrix(); e.rig.controls.update(); e.invalidate(); }, poses[id]);
    for (const overlays of [false, true]) {
      await page.evaluate(v => window.reviewStore.actions.setSurfaceFeatures(v), overlays);
      await page.waitForTimeout(180);
      await page.screenshot({ path: `${base}/${phase}/${id}-${overlays ? 'on' : 'off'}.png` });
      checks.push(await page.evaluate(({id, overlays}) => {
        const e = window.ds.engine;
        const visible = [...e.labels.els].filter(([,label])=>label.el.classList.contains('is-visible')).map(([id])=>id);
        // Independently test every visible feature anchor against opaque meshes.
        const invalid = e.labels.candidates.filter(c=>c.id.startsWith('surface-') && visible.includes(c.id)).filter(c=>{const p=c.anchor(),hit=e.raycastOwner(e.rig.camera.position,p);return hit && hit.distance < e.rig.camera.position.distanceTo(p)-.012;}).map(c=>c.id);
        return {id, overlays, labels: [...document.querySelectorAll('.ds-label.is-visible')].map(el=>el.textContent), invalid, geometries:e.renderer.info.memory.geometries};
      }, {id, overlays}));
    }
  }
  console.log(`${phase}: ${fdi}, five surfaces, overlays on/off`);
}
writeFileSync(`${base}/poses.json`, JSON.stringify(poses, null, 2));
if (phase !== 'before' && !process.env.REVIEW_TEETH) {
  for (const mobile of [false,true]) {
    await page.setViewportSize(mobile ? {width:390,height:844} : {width:1200,height:900});
    for (const theme of ['light','dark']) {
      await page.evaluate(theme=>window.reviewStore.actions.setTheme(theme),theme);
      for (const fdi of [13,16,34,36]) {
        await page.evaluate(async fdi=>{await ds.engine.studyToothSurface(fdi,fdi===13?'inner':'occlusal');},fdi);
        for (const on of [false,true]) {
          await page.evaluate(on=>window.reviewStore.actions.setSurfaceFeatures(on),on);
          await page.waitForTimeout(350);
          await page.screenshot({path:`${base}/${phase}/${mobile?'mobile':'desktop'}-${theme}-${fdi}-${on?'on':'off'}.png`});
        }
      }
    }
  }
  await page.setViewportSize({width:1200,height:900});
  await page.evaluate(()=>window.reviewStore.actions.setTheme('light'));
  for (const fdi of [13,16,34,36]) {
    await page.evaluate(async fdi=>{await ds.engine.studyToothSurface(fdi,'inner');window.reviewStore.actions.setDissectLevel(1);window.reviewStore.actions.setToothExplode(.65);},fdi);
    await page.waitForTimeout(500);
    await page.screenshot({path:`${base}/${phase}/layers-${fdi}.png`});
    await page.evaluate(()=>{window.reviewStore.actions.setToothExplode(0);window.reviewStore.actions.setClip({enabled:true,axis:'sagittal',offset:0});});
    await page.waitForTimeout(500);
    await page.screenshot({path:`${base}/${phase}/section-${fdi}.png`});
  }
}
await page.evaluate(async () => { await ds.engine.showStudyView('sinuses'); });
await page.waitForTimeout(500);
const sinuses = await page.evaluate(() => ({
  retiredEntries: [...ds.registry.byId.keys()].filter(id => id.startsWith('ethmoidal-air-cells')),
  retiredMeshes: [...ds.engine.entries.keys()].filter(id => id.startsWith('ethmoidal-air-cells')),
  options: [...document.querySelectorAll('.ds-study-select option')].map(el => el.textContent),
}));
await page.screenshot({path:`${base}/${phase}/sinuses.png`});
writeFileSync(`${base}/${phase}/checks.json`, JSON.stringify({ errors, checks, sinuses }, null, 2));
await browser.close();
if (errors.length || checks.some(c=>c.invalid?.length) || sinuses.retiredEntries.length || sinuses.retiredMeshes.length) throw Error(JSON.stringify({errors,sinuses,occluded:checks.filter(c=>c.invalid?.length)}));
