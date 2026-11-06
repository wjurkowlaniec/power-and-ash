import * as THREE from 'three';

/**
 * One full-screen pass over the rendered scene: desaturation (reserve mode is black and
 * white except for the battery's green), the faded final palette, a soft vignette.
 */
export class Post {
  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly uniforms = {
    tScene: { value: null as THREE.Texture | null },
    uGrey: { value: 1 },       // 1 = reserve mode (grey but green), 0 = full look
    uSat: { value: 0.55 },     // saturation of the final, faded look
    uVignette: { value: 0.55 },
    uLift: { value: 0.03 },    // raised blacks, like fog in the air
  };

  constructor(private renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tScene; uniform float uGrey, uSat, uVignette, uLift;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.0);
          #include <tonemapping_fragment>
          vec3 c = gl_FragColor.rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          float green = smoothstep(0.02, 0.12, c.g - max(c.r, c.b));
          vec3 faded = mix(vec3(l), c, uSat);
          vec3 grey = mix(vec3(pow(l, 1.15) * 1.05), c, green);
          vec3 o = mix(faded, grey, uGrey);
          o = o * (1.0 - uLift) + uLift;
          vec2 d = vUv - 0.5;
          o *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
          gl_FragColor = vec4(o, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  }

  setSize(w: number, h: number) {
    const pr = this.renderer.getPixelRatio();
    this.target.setSize(Math.round(w * pr), Math.round(h * pr));
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    this.uniforms.tScene.value = this.target.texture;
    r.render(this.scene, this.cam);
  }

  dispose() { this.target.dispose(); }
}
