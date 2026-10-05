"""Export new schematic sinus groups without rebuilding unrelated anatomy."""
import json
from pathlib import Path
import numpy as np
from build_assets import load_stl, TEETH_FMA, derive_third_molar, Space
from sinus import build_paranasal_teaching_spaces

teeth = {f: load_stl(Path('tools/pipeline/raw/stl'), fma) for f, fma in TEETH_FMA.items() if fma}
for q in (1, 2, 3, 4):
    teeth[q * 10 + 8] = derive_third_molar(teeth[q * 10 + 7], teeth[q * 10 + 6], q > 2)
vertices = np.concatenate([m.vertices for m in teeth.values()])
lo, hi = vertices.min(0), vertices.max(0)
space = Space((lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
data = {}
for key, mesh in build_paranasal_teaching_spaces().items():
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
    app = space.mesh(mesh)
    data[key] = dict(positions=app.vertices.ravel().tolist(), normals=app.vertex_normals.ravel().tolist(), indices=app.faces.ravel().tolist(), bounds=app.bounds.round(4).tolist(), triangles=len(app.faces))
out = Path('tools/pipeline/.cache/paranasal.json'); out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data))
print('Six sinus groups exported; ethmoidal groups contain eight separate teaching cells each.')
