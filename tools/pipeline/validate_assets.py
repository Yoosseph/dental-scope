#!/usr/bin/env python3
"""Check the uncompressed GLBs and manifest before publishing compressed assets."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import trimesh
from scipy.spatial import cKDTree


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("build", type=Path, help="Directory produced by build_assets.py")
    args = parser.parse_args()
    manifest = json.loads((args.build / "manifest.json").read_text())
    expected = defaultdict(set)
    for key, info in manifest["meshes"].items():
        expected[info["file"]].add(key)

    errors: list[str] = []
    nonmanifold: list[str] = []
    total_faces = 0
    shells: dict[int, trimesh.Trimesh] = {}
    gums: dict[str, trimesh.Trimesh] = {}
    for file, keys in expected.items():
        scene = trimesh.load(args.build / file, force="scene")
        actual = set(scene.geometry)
        for key in sorted(keys - actual):
            errors.append(f"{file}: missing {key}")
        for key in sorted(actual - keys):
            errors.append(f"{file}: unexpected {key}")
        for key in sorted(keys & actual):
            mesh = scene.geometry[key]
            info = manifest["meshes"][key]
            total_faces += len(mesh.faces)
            if not len(mesh.faces) or not np.isfinite(mesh.vertices).all():
                errors.append(f"{key}: empty or non-finite geometry")
            if abs(len(mesh.faces) - info["triangles"]) > 0:
                errors.append(f"{key}: triangle count differs from manifest")
            if not np.allclose(mesh.bounds, info["bounds"], atol=0.001):
                errors.append(f"{key}: bounds differ from manifest")
            if info["stage"] == 4 and not mesh.is_watertight:
                nonmanifold.append(key)
            if key.startswith("tooth-") and key[6:].isdigit():
                shells[int(key[6:])] = mesh
            if key in ("gingiva-upper", "gingiva-lower"):
                gums[key] = mesh

    for fdi, tooth in manifest["teeth"].items():
        asset = tooth.get("asset")
        if not asset or not (args.build / asset).is_file():
            errors.append(f"tooth {fdi}: missing internal asset")
        for layer in tooth.get("layers", []):
            if f"{layer}-{fdi}" not in manifest["meshes"]:
                errors.append(f"tooth {fdi}: missing layer {layer}")
        if "cervical-line" not in tooth.get("landmarks", {}) or "axis" not in tooth.get("frame", {}):
            errors.append(f"tooth {fdi}: missing shell shading landmark or frame")

    # Every permanent tooth should meet its neighbours at a plausible contact.
    # Mesh coordinates are centimetres; 0.05 cm is a 0.5 mm upper gap limit.
    neighbors = [(11, 21), (31, 41)]
    neighbors += [(q * 10 + n, q * 10 + n + 1) for q in (1, 2, 3, 4) for n in range(1, 8)]
    for a, b in neighbors:
        if a not in shells or b not in shells:
            errors.append(f"missing tooth shell for contact {a}/{b}")
            continue
        gap = cKDTree(shells[a].vertices).query(shells[b].vertices)[0].min()
        if gap > 0.05:
            errors.append(f"tooth contact {a}/{b}: {gap * 10:.2f} mm gap")

    # Root proximity alone can hide a large gap between the visible crowns.
    # The derived lower wisdom teeth must meet their neighbours at the bite.
    for fdi in (38, 48):
        pair = []
        for number in (fdi - 1, fdi):
            info = manifest["teeth"][str(number)]
            tooth = shells[number]
            height = (tooth.vertices - info["landmarks"]["cervical-line"]) @ np.array(info["frame"]["axis"])
            pair.append(tooth.vertices[height > 0.15])
        gap = cKDTree(pair[0]).query(pair[1])[0].min()
        if gap > 0.06:
            errors.append(f"tooth crown contact {fdi - 1}/{fdi}: {gap * 10:.2f} mm gap")
        if abs(shells[fdi].bounds[1, 1] - shells[fdi - 1].bounds[1, 1]) > 0.02:
            errors.append(f"tooth {fdi}: cusp height out of line with neighbouring molar")

    # The gingiva must be a single closed body, fitted around both tooth rows.
    # Sampling tooth vertices catches regressions where a source gum is used
    # without carving sockets; the 0.08 mm clearance keeps samples away from
    # numerical ambiguity right on the surface.
    for arch, quadrants in (("gingiva-upper", (1, 2)), ("gingiva-lower", (3, 4))):
        gum = gums.get(arch)
        if gum is None:
            errors.append(f"missing {arch}")
            continue
        if not gum.is_watertight or len(gum.split()) != 1:
            errors.append(f"{arch}: expected one watertight body")
        for quadrant in quadrants:
            for number in range(1, 9):
                fdi = quadrant * 10 + number
                tooth = shells.get(fdi)
                if tooth is not None and gum.contains(tooth.vertices[::40]).any():
                    errors.append(f"{arch}: tooth {fdi} intersects gingiva")

    # All four wisdom teeth are shown fully erupted. A socket can be closed
    # over by the source's retromolar gum without intersecting the tooth, so
    # check crown visibility as well as solid intersection. Coordinates are cm.
    for fdi in (18, 28, 38, 48):
        tooth = shells.get(fdi)
        gum = gums.get("gingiva-upper" if fdi < 30 else "gingiva-lower")
        if tooth is None or gum is None:
            continue  # Missing geometry is reported above.
        info = manifest["teeth"][str(fdi)]
        axis = np.array(info["frame"]["axis"])
        axis /= np.linalg.norm(axis)
        cervical = np.array(info["landmarks"]["cervical-line"])
        height = (tooth.vertices - cervical) @ axis
        crown = tooth.vertices[height > max(0.15, height.max() * 0.5)][::5]
        if not len(crown):
            errors.append(f"tooth {fdi}: missing erupted crown")
            continue
        if fdi in (38, 48):
            # The assembled renderer clips roots at -0.12 cm from the CEJ.
            # A crown can be fully visible yet float over an empty socket:
            # require a close gum wall around that cut, not just no collisions.
            neck = tooth.vertices[(height > -0.13) & (height < -0.07)]
            outward = neck - cervical
            outward -= np.outer(outward @ axis, axis)
            outward /= np.linalg.norm(outward, axis=1)[:, None]
            hits, rays, _ = gum.ray.intersects_location(neck, outward, multiple_hits=False)
            supported = np.zeros(len(neck), dtype=bool)
            supported[rays] = np.linalg.norm(hits - neck[rays], axis=1) < 0.05
            # Allow the small proximal contact shared with the neighbouring
            # tooth's socket, where a ray can cross that socket instead.
            if not len(neck) or supported.mean() < 0.95:
                errors.append(f"tooth {fdi}: gum does not support the rendered neck")
        buccal = np.array(info["frame"]["buccal"])
        for view, direction in (("occlusal", axis), ("buccal", buccal)):
            direction = direction / np.linalg.norm(direction)
            # Only outward-facing surface samples represent the visible
            # crown; a ray through the tooth's back can meet its own collar.
            visible = (height > max(0.15, height.max() * 0.5)) & (tooth.vertex_normals @ direction > 0.15)
            points = tooth.vertices[visible][::3]
            point_heights = height[visible][::3]
            blocked = gum.ray.intersects_any(points + direction * 0.002, np.tile(direction, (len(points), 1)))
            # A small proximal papilla may overlap the lower side of a
            # crown; it must never cover the cusps or the occlusal surface.
            tolerance = 0.05 if view == "buccal" else 0.0
            if not len(points) or blocked.mean() > tolerance or blocked[point_heights > height.max() * 0.75].any():
                errors.append(f"tooth {fdi}: gingiva covers {blocked.mean():.0%} of sampled crown ({view})")

    # Arch dissection: at every point of the slider the visible part of each tooth must stay
    # clear of the gum. While a tooth slides out, the engine cuts away the part still below the
    # gum collar (uRootCut = collar - e * extract along the axis from the cervical line), so only
    # the part above that plane is checked. Fully separated, upper and lower teeth must not overlap.
    plan = manifest.get("explode")
    if not plan:
        errors.append("manifest: missing explode plan")
    else:
        for arch, jaw, sign in (("gingiva-upper", "upper", -1), ("gingiva-lower", "lower", 1)):
            gum = gums.get(arch)
            if gum is None:
                continue
            for e in (0.2, 0.4, 0.6, 0.8, 1.0):
                for fdi, tooth in shells.items():
                    if (fdi < 30) != (jaw == "upper"):
                        continue
                    info = manifest["teeth"][str(fdi)]
                    axis = np.array(info["frame"]["axis"])
                    cervical = np.array(info["landmarks"]["cervical-line"])
                    v = tooth.vertices[::10]
                    v = v[(v - cervical) @ axis >= info["collar"] - e * info["extract"]]
                    pts = v + e * info["extract"] * axis  # tooth relative to gum
                    if gum.contains(pts).any():
                        errors.append(f"dissection {e:.0%}: tooth {fdi} passes through {arch}")
        def placed(fdi, tooth):
            info = manifest["teeth"][str(fdi)]
            jaw_y = plan["jaw"] - plan["upper"]["gingiva"] if fdi < 30 else -plan["jaw"] + plan["lower"]["gingiva"]
            return tooth.vertices + np.array([0, jaw_y, 0]) + info["extract"] * np.array(info["frame"]["axis"])

        up = np.vstack([placed(f, s) for f, s in shells.items() if f < 30])
        lo = np.vstack([placed(f, s) for f, s in shells.items() if f > 30])
        gap = cKDTree(up).query(lo)[0].min()
        if gap < 0.2:
            errors.append(f"dissection: upper and lower teeth only {gap * 10:.1f} mm apart")

    # Nerves and vessels carry their jaw weight (vertex colour) for the dissection stretch.
    nv = trimesh.load(args.build / "neurovascular.glb", force="scene")
    for key, mesh in nv.geometry.items():
        if mesh.visual.kind != "vertex":
            errors.append(f"{key}: missing jaw-weight vertex colours")
    # The inferior alveolar nerve runs inside the mandible between its foramina.
    mand = trimesh.load(args.build / "core.glb", force="scene").geometry
    mandible = trimesh.util.concatenate([mand[k] for k in ("mandible-body", "mandibular-alveolar-process")])
    for side in ("right", "left"):
        trunk = np.array(manifest["paths"][f"inferior-alveolar-nerve-{side}"][0])
        near = cKDTree(mandible.vertices).query(trunk)[0]
        if np.median(near) > 0.6:
            errors.append(f"inferior-alveolar-nerve-{side}: trunk lies {np.median(near) * 10:.1f} mm from the mandible")

    # Neck vessels end at the angle of the mandible (issue #26): nothing hangs below the mandible.
    core = trimesh.load(args.build / "core.glb", force="scene").geometry
    floor_y = mandible.bounds[0][1]
    for key, mesh in nv.geometry.items():
        if mesh.bounds[0][1] < floor_y - 0.05:
            errors.append(f"{key}: reaches {(floor_y - mesh.bounds[0][1]) * 10:.1f} mm below the mandible")
    if any(k.startswith("external-jugular-vein") for k in manifest["meshes"]):
        errors.append("external jugular vein is no longer part of the model")

    # Maxillary sinus (issue #25): a closed body inside its maxilla, clear of the teeth and of the
    # nerves that run in its walls, with a plausible volume.
    sinus_nerves = ("posterior-superior-alveolar-nerve", "middle-superior-alveolar-nerve",
                    "anterior-superior-alveolar-nerve", "infraorbital-nerve")
    for side in ("right", "left"):
        sinus = core.get(f"maxillary-sinus-{side}")
        if sinus is None:
            errors.append(f"missing maxillary-sinus-{side}")
            continue
        if not sinus.is_watertight or len(sinus.split()) != 1:
            errors.append(f"maxillary-sinus-{side}: expected one watertight body")
        volume = abs(sinus.volume)  # cm³ (app units are cm)
        if not 3 <= volume <= 25:
            errors.append(f"maxillary-sinus-{side}: implausible volume {volume:.1f} cm³")
        maxilla = trimesh.util.concatenate([core[f"maxilla-{side}"], core[f"maxillary-alveolar-process-{side}"]])
        outside = ~maxilla.contains(sinus.vertices[::7])
        if outside.mean() > 0.02:
            errors.append(f"maxillary-sinus-{side}: {outside.mean():.0%} of it lies outside the maxilla")
        for fdi, tooth in shells.items():
            if fdi // 10 == (1 if side == "right" else 2) and sinus.contains(tooth.vertices[::5]).any():
                errors.append(f"maxillary-sinus-{side}: tooth {fdi} reaches into the sinus")
        for n in sinus_nerves:
            pts = np.vstack([np.array(p) for p in manifest["paths"][f"{n}-{side}"]])
            if sinus.contains(pts).any():
                errors.append(f"maxillary-sinus-{side}: {n} runs through the sinus")
        print(f"maxillary-sinus-{side}: {volume:.1f} cm³, apex → floor (mm) {manifest.get('sinus', {}).get(side, {}).get('apexGap')}")

    print(f"Validated {len(expected)} GLBs, {len(manifest['meshes'])} meshes, {total_faces:,} triangles")
    print(f"Internal surfaces with nonmanifold edges: {len(nonmanifold)}")
    if nonmanifold:
        print("  " + ", ".join(nonmanifold[:20]) + (" …" if len(nonmanifold) > 20 else ""))
    if errors:
        raise SystemExit("Asset errors:\n" + "\n".join(errors))


if __name__ == "__main__":
    main()
