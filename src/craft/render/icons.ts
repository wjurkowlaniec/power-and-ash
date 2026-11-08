import * as THREE from 'three';
import { Models } from '../../render/assets';
import { ITEMS, ItemId } from '../data';
import { itemModel } from './craftModels';

/**
 * Inventory icons rendered from the same 3D models as the world, once at load: a small
 * offscreen renderer, a three-quarter view, soft light, transparent background.
 */
export function renderIcons(models: Models, size = 96): Record<ItemId, string> {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf0ece4, 0x4a463f, 1.6));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe6ef, 0.8); rim.position.set(-4, 2, -3); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const out = {} as Record<ItemId, string>;
  for (const id of Object.keys(ITEMS) as ItemId[]) {
    const o = itemModel(id, models);
    scene.add(o);
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3()).length() || 1;
    const dir = new THREE.Vector3(1, 0.85, 1.25).normalize();
    cam.position.copy(c).addScaledVector(dir, s * 1.75);
    cam.lookAt(c);
    r.render(scene, cam);
    out[id] = r.domElement.toDataURL('image/png');
    scene.remove(o);
  }
  r.dispose();
  return out;
}
