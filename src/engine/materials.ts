/**
 * Tissue materials with a small shader extension:
 *  - uHi / uHiColor: selection & hover highlight (colour blend + fresnel rim)
 *  - uCap: flat colour for back faces, so cross-sections read as solid cut surfaces
 */
import * as THREE from 'three';
import type { CategoryId } from '../anatomy/types';
import type { AppState } from '../state/store';

export interface TissueStyle {
  color: string;
  roughness: number;
  metalness?: number;
  clearcoat?: number;
  sheen?: number;
  /** cut-surface colour (defaults to a slightly darker base) */
  cap?: string;
  emissive?: string;
}

const STYLES: Record<string, TissueStyle> = {
  shell: { color: '#ece5d3', roughness: 0.38, clearcoat: 0.35, cap: '#d8c79c' },
  enamel: { color: '#f2eee4', roughness: 0.28, clearcoat: 0.5, cap: '#eae4d5' },
  'dentin-coronal': { color: '#e3c285', roughness: 0.6, cap: '#d9b56f' },
  'dentin-radicular': { color: '#dcb978', roughness: 0.62, cap: '#d1ab63' },
  cementum: { color: '#c7a071', roughness: 0.75, cap: '#b58f61' },
  'pulp-chamber': { color: '#c9454d', roughness: 0.5, cap: '#b3343d', emissive: '#3a0c0f' },
  canal: { color: '#b83842', roughness: 0.5, cap: '#a42d36', emissive: '#300a0d' },
  pdl: { color: '#d4847d', roughness: 0.6, cap: '#c26f68' },
  gingiva: { color: '#d88a8c', roughness: 0.5, sheen: 0.4, cap: '#c77074' },
  bone: { color: '#e8e0cc', roughness: 0.82, cap: '#ddd0b2' },
  alveolar: { color: '#e4dac2', roughness: 0.85, cap: '#dacdb0' },
  condyle: { color: '#e4dac3', roughness: 0.75, cap: '#d0c2a1' },
  disc: { color: '#86b2c4', roughness: 0.45, cap: '#6d9aae' },
  skull: { color: '#e6dfcd', roughness: 0.85, cap: '#d6caac' },
  muscle: { color: '#b45a50', roughness: 0.6, sheen: 0.3, cap: '#9b463d' },
  nerve: { color: '#e2b93b', roughness: 0.45, cap: '#c99f25', emissive: '#2a1f00' },
  artery: { color: '#cc4038', roughness: 0.4, cap: '#b0322b', emissive: '#240505' },
  vein: { color: '#4a6cae', roughness: 0.45, cap: '#3a5a98', emissive: '#050a1a' },
};

export function styleKeyFor(meshKey: string, cats: CategoryId[]): string {
  if (/^tooth-\d\d$/.test(meshKey)) return 'shell';
  const m = /^(enamel|dentin-coronal|dentin-radicular|cementum|pulp-chamber|pdl)-\d\d$/.exec(meshKey);
  if (m) return m[1];
  if (/^canal-/.test(meshKey)) return 'canal';
  if (meshKey.startsWith('gingiva')) return 'gingiva';
  if (meshKey.includes('alveolar-process')) return 'alveolar';
  if (meshKey.includes('condyle')) return 'condyle';
  if (meshKey.startsWith('articular-disc')) return 'disc';
  if (cats.includes('nerves')) return 'nerve';
  if (cats.includes('arteries')) return 'artery';
  if (cats.includes('veins')) return 'vein';
  if (cats.includes('muscles')) return 'muscle';
  if (cats.includes('skull')) return 'skull';
  return 'bone';
}

export function styleFor(key: string): TissueStyle {
  return STYLES[key] ?? STYLES.bone;
}

export type SceneTheme = AppState['theme'];

/**
 * Renderer settings per UI theme. On the pale light-theme stage, ivory teeth and
 * bone wash out together; slightly lower exposure brings back surface shading.
 */
export const THEME_LIGHTING: Record<SceneTheme, { exposure: number; environment: number }> = {
  light: { exposure: 0.95, environment: 0.5 },
  dark: { exposure: 1.05, environment: 0.55 },
};

/** Light theme only: shade bone a touch so the teeth read against the jaws. */
const LIGHT_THEME_SHADE: Record<string, number> = { bone: 0.91, alveolar: 0.91, condyle: 0.91, skull: 0.93 };

export function themedColor(styleKey: string, theme: SceneTheme, which: 'color' | 'cap' = 'color'): THREE.Color {
  const st = styleFor(styleKey);
  const c = new THREE.Color(which === 'cap' ? (st.cap ?? st.color) : st.color);
  return theme === 'light' ? c.multiplyScalar(LIGHT_THEME_SHADE[styleKey] ?? 1) : c;
}

export interface FxUniforms {
  uHi: { value: number };
  uHiColor: { value: THREE.Color };
  uCap: { value: THREE.Color };
  uOpacityFx: { value: number };
}

export type TissueMaterial = THREE.MeshPhysicalMaterial & { userData: { fx: FxUniforms; styleKey: string } };

export const HIGHLIGHT = new THREE.Color('#1fb5c9');
export const HOVER = new THREE.Color('#7fd8e3');

export function createTissueMaterial(styleKey: string): TissueMaterial {
  const st = styleFor(styleKey);
  const mat = new THREE.MeshPhysicalMaterial({
    color: st.color,
    roughness: st.roughness,
    metalness: st.metalness ?? 0,
    clearcoat: st.clearcoat ?? 0,
    clearcoatRoughness: 0.35,
    sheen: st.sheen ?? 0,
    sheenColor: new THREE.Color(st.color).multiplyScalar(1.1),
    emissive: st.emissive ?? '#000000',
    side: THREE.DoubleSide,
  }) as TissueMaterial;
  const fx: FxUniforms = {
    uHi: { value: 0 },
    uHiColor: { value: HIGHLIGHT.clone() },
    uCap: { value: new THREE.Color(st.cap ?? st.color) },
    uOpacityFx: { value: 1 },
  };
  mat.userData = { fx, styleKey };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fx);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uHi;\nuniform vec3 uHiColor;\nuniform vec3 uCap;\nuniform float uOpacityFx;\nvoid main() {`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          vec3 vdir = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(abs(dot(normalize(vNormal), vdir)), 0.0, 1.0), 2.2);
          vec3 hi = linearToOutputTexel(vec4(uHiColor, 1.0)).rgb;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hi, uHi * (0.16 + 0.7 * fres));
          if (!gl_FrontFacing) {
            // cut surface: flat tissue colour (converted to output space), lightly shaded by depth
            vec3 cap = linearToOutputTexel(vec4(uCap, 1.0)).rgb;
            cap = mix(cap, hi, uHi * 0.35);
            gl_FragColor = vec4(cap, gl_FragColor.a);
          }
          gl_FragColor.a *= uOpacityFx;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'ds-tissue';
  return mat;
}

/** Surface and cut-surface colours for the given theme. */
export function applyThemeToMaterial(mat: TissueMaterial, theme: SceneTheme) {
  const key = mat.userData.styleKey;
  mat.color.copy(themedColor(key, theme));
  mat.userData.fx.uCap.value.copy(themedColor(key, theme, 'cap'));
}

/** Apply opacity with sensible transparency settings. */
export function setMaterialOpacity(mat: TissueMaterial, opacity: number) {
  const transparent = opacity < 0.999;
  if (mat.transparent !== transparent) {
    mat.transparent = transparent;
    mat.depthWrite = !transparent;
    // ghosts are single-sided so they don't show cut caps / inner faces
    mat.side = transparent ? THREE.FrontSide : THREE.DoubleSide;
    mat.needsUpdate = true;
  }
  mat.opacity = opacity;
}
