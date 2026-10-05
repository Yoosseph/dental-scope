"""Audit regenerated tissue nesting and the actual per-tooth displacement map."""
import json, pickle
from pathlib import Path
import numpy as np
import trimesh
from build_assets import TEETH_FMA, load_stl, derive_third_molar, tooth_info
from morphology import CrownRelief

directory = Path('tools/pipeline/.cache/morphology-final')
raw = Path('tools/pipeline/raw/stl')
rows=[]
for file in sorted(directory.glob('tooth-*.json')):
    f=int(file.stem.split('-')[1]); data=json.loads(file.read_text())
    def mesh(key):
        d=data[f'{key}-{f}']
        return trimesh.Trimesh(np.array(d['positions']).reshape(-1,3), np.array(d['indices']).reshape(-1,3),process=False)
    shell=mesh('tooth')
    inside={}
    for key in ['dentin-coronal','pulp-chamber']:
        m=mesh(key)
        points=m.vertices[::max(1,len(m.vertices)//1500)]
        # Source apical exits are irrelevant here; only coronal solids are tested.
        contained=shell.contains(points)
        outside_distance=shell.nearest.on_surface(points[~contained])[1] if (~contained).any() else np.array([0.])
        inside[key]=float(outside_distance.max())
        if inside[key] > .015: raise ValueError(f'{f} {key}: outside shell by {inside[key]} cm')
    layers=pickle.load(open(f'tools/pipeline/.cache/build/cache/layers-v9-{f}.pkl','rb'))
    source=load_stl(raw,TEETH_FMA[f]) if TEETH_FMA[f] else derive_third_molar(load_stl(raw,TEETH_FMA[f-1]),load_stl(raw,TEETH_FMA[f-2]),f>30)
    arch,_,kind=tooth_info(f); relief=CrownRelief(source,layers.frame,arch,kind,layers.cej_height)
    local=layers.frame.to_local(source.vertices)
    pts=layers.frame.to_world(np.random.default_rng(f).uniform(local.min(0),local.max(0),(4096,3)))
    out=relief.deform(pts); eps=1e-4
    jac=np.stack([(relief.deform(pts+np.eye(3)[i]*eps)-out)/eps for i in range(3)],axis=-1)
    det=float(np.linalg.det(jac).min())
    if det <= .05: raise ValueError(f'{f}: folded deformation {det}')
    rows.append(dict(fdi=f,min_sampled_jacobian=det,outside_shell_cm=inside))
    print(f'{f}: nested crown tissues, positive deformation Jacobian {det:.3f}',flush=True)
(directory/'coherence.json').write_text(json.dumps(rows,indent=2))
