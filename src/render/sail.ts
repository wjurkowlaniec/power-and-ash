import * as THREE from 'three';
import { sailTexture } from './sailTexture';

/**
 * Mainsail on a boom. The cloth is a subdivided triangle bent in the vertex shader:
 * a billow that fills with the wind and a travelling flutter that grows towards the
 * free edge. When the wind drops the sail luffs (less billow, more flapping).
 * The boom swings to keep the sail at a sensible angle to the wind.
 */
export class Sail {
  readonly group = new THREE.Group(); // pivot at the mast, at boom height
  private uniforms = {
    uTime: { value: 0 },
    uBillow: { value: 0.6 },
    uFlutter: { value: 0.1 },
    uSide: { value: 1 },
  };
  /** 1 = solid, lower = screen-door see-through (when the sail hides Wolt). */
  private fade = { value: 1 };
  readonly cloth: THREE.Mesh;
  private angle = 0;
  private angVel = 0;
  private side = 1;
  private phase = 0;

  constructor(readonly foot = 5, readonly height = 8.4, map: THREE.Texture = sailTexture()) {
    const nu = 22, nv = 34;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * (1 - v);
        pos.push(u * foot, v * height, 0);
        uv.push(u, v);
      }
    }
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 1, alphaTest: 0.5, flatShading: true });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
    for (const m of [mat, depth]) m.onBeforeCompile = sh => this.inject(sh, m === mat);

    const cloth = new THREE.Mesh(geo, mat);
    this.cloth = cloth;
    cloth.customDepthMaterial = depth;
    cloth.castShadow = true; cloth.receiveShadow = true;
    this.group.add(cloth);

    const steel = new THREE.MeshStandardMaterial({ color: 0x50565b, metalness: 0.5, roughness: 0.6 });
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, foot + 0.3, 6), steel);
    boom.rotation.z = Math.PI / 2; boom.position.set(foot / 2, 0, 0); boom.castShadow = true;
    this.group.add(boom);
  }

  private inject(sh: THREE.WebGLProgramParametersWithUniforms, color: boolean) {
    Object.assign(sh.uniforms, this.uniforms);
    if (color) {
      // dithered see-through: keeps the opaque pipeline (and the shadow) intact
      sh.uniforms.uFade = this.fade;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uFade;`)
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          if (uFade < 0.999) {
            vec2 q = floor(mod(gl_FragCoord.xy, 4.0));
            float b = mod(q.x * 2.0 + q.y * 3.0 + floor(q.y / 2.0) * 5.0, 4.0) / 4.0
                    + mod(q.x + q.y * 2.0, 2.0) / 8.0;
            if (b >= uFade) discard;
          }`);
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uBillow, uFlutter, uSide;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float u = uv.x, v = uv.y;
          float chord = max(1.0 - v, 0.001);
          float s = clamp(u / chord, 0.0, 1.0);       // 0 at the mast, 1 at the leech
          float bulge = sin(3.14159 * pow(s, 0.8)) * chord; // deepest near the middle of the chord
          float edge = pow(s, 1.6);
          float wave = sin(s * 6.0 * chord + v * 2.5 - uTime * 3.0)
                     + 0.5 * sin(s * 11.0 + v * 7.0 - uTime * 5.1);
          transformed.z += uSide * (bulge * uBillow + edge * wave * uFlutter);
          transformed.x -= bulge * uBillow * 0.12;    // the foot draws in as it fills
        }`);
  }

  /**
   * windLocal: wind direction in the yacht's local frame (radians, 0 = bow / +x);
   * strength: m/s including gusts.
   */
  /** Ease the see-through amount towards `want` (1 solid … 0.25 mostly open). */
  setFade(want: number, dt: number) {
    this.fade.value += (want - this.fade.value) * Math.min(1, dt * 6);
  }

  /** `sheet` (rad), when given, stops the boom that far off the centre line (the land yacht in /demo-craft/). */
  update(dt: number, t: number, windLocal: number, strength: number, sheet?: number) {
    // boom points downwind but stays aft (its rest direction is -x): clamp to ±75°
    const wx = Math.cos(windLocal), wz = Math.sin(windLocal);
    let target = Math.atan2(-wz, -wx); // angle from -x towards the wind vector
    target = THREE.MathUtils.clamp(-target, -1.3, 1.3);
    if (sheet !== undefined) target = THREE.MathUtils.clamp(target, -sheet, sheet);
    // a damped spring: the boom swings and settles when the wind shifts
    const k = 3 + strength * 0.4;
    this.angVel += ((target - this.angle) * k - this.angVel * 2.2) * dt;
    this.angle += this.angVel * dt;
    // rotation.y = π points the boom along -x
    this.group.rotation.y = Math.PI + this.angle;

    // which side the cloth bellies out to: downwind side of the sail plane
    const th = Math.PI + this.angle;
    const n = Math.sign(wx * Math.sin(th) + wz * Math.cos(th)) || 1;
    this.side += (n - this.side) * Math.min(1, dt * 2);

    const f = THREE.MathUtils.clamp(strength / 12, 0, 1.4);
    const u = this.uniforms;
    this.phase += dt * (0.6 + f * 1.8); // flutter speeds up with the wind, without phase jumps
    u.uTime.value = this.phase + t * 0;
    u.uBillow.value = 0.15 + 0.75 * Math.min(1, f);
    u.uFlutter.value = 0.22 * (1 - Math.min(1, f)) + 0.05 + 0.06 * Math.max(0, f - 0.8);
    u.uSide.value = this.side;
  }
}
