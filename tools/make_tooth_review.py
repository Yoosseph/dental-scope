"""Assemble existing screenshots into review sheets; no image synthesis."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

base = Path('docs/screenshots/tooth-review')
surfaces = ['occlusal', 'facial', 'inner', 'mesial', 'distal']
for phase in ['before', 'after', 'revised']:
    for arch, teeth in [('upper',range(11,18)), ('lower',range(31,38))]:
        for overlay in ['off','on']:
            sheet = Image.new('RGB',(1600,7*250),(244,242,236))
            draw=ImageDraw.Draw(sheet)
            for row,fdi in enumerate(teeth):
                for col,surface in enumerate(surfaces):
                    path=base/phase/f'{fdi}-{surface}-{overlay}.png'
                    im=Image.open(path).convert('RGB').crop((335,65,865,610))
                    im.thumbnail((310,225))
                    sheet.paste(im,(col*320+(320-im.width)//2,row*250+23))
                    draw.text((col*320+8,row*250+5),f'{fdi} {surface} | {phase} overlays {overlay}',fill=(30,30,30))
            sheet.save(base/f'{phase}-{arch}-{overlay}.jpg',quality=90)
html='''<!doctype html><meta charset="utf-8"><title>Dental Scope tooth review</title>
<style>body{font:16px system-ui;background:#f4f2ec;margin:24px;color:#242321}select{font:inherit} .pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%}label{margin-right:20px}h2{font-size:18px}</style>
<h1>Dental Scope — matching camera comparison</h1><p>Draft schematic anatomy. Original source proportions and roots retained; relief is not measured anatomy. Select a tooth and surface. Before/after replay the saved position, target and zoom. Additional mobile, theme, section and layer screenshots are in the revised folder.</p>
<label>Compare against <select id="reference"><option value="before">Original</option><option value="after" selected>Previous pass</option></select></label><label>Tooth <select id="tooth">'''
html+=''.join(f'<option>{f}</option>' for f in [11,12,13,14,15,16,17,31,32,33,34,35,36,37])
html+='</select></label><label>Surface <select id="surface">'+''.join(f'<option>{s}</option>' for s in surfaces)+'</select></label>'
html+='''<label>Overlays <select id="overlay"><option>off</option><option>on</option></select></label><div class="pair"><section><h2>Reference</h2><img id="before"></section><section><h2>Revised</h2><img id="after"></section></div>
<script>function show(){for(const p of ['before','after'])document.getElementById(p).src=(p==='after'?'revised':reference.value)+'/'+tooth.value+'-'+surface.value+'-'+overlay.value+'.png'}document.querySelectorAll('select').forEach(e=>e.onchange=show);tooth.value='16';show()</script>'''
(base/'index.html').write_text(html,encoding='utf-8')
