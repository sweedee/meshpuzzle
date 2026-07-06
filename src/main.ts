import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { App } from './app';
import { SoundFX } from './audio';
import { DragControls } from './controls';
import { Effects } from './effects';
import { getSave } from './save';
import { updateTweens } from './tween';
import { UI } from './ui';

function gridFromUrl(): THREE.Vector3 | undefined {
  // Debug: override the level's grid without a rebuild, e.g. ?grid=3x2x3
  const m = new URLSearchParams(location.search).get('grid')?.match(/^(\d+)x(\d+)x(\d+)$/);
  if (!m) return undefined;
  const clamp = (v: string) => THREE.MathUtils.clamp(parseInt(v, 10), 1, 8);
  return new THREE.Vector3(clamp(m[1]), clamp(m[2]), clamp(m[3]));
}

const appEl = document.querySelector('#app') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2028);
scene.fog = new THREE.Fog(0x1a2028, 30, 60);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(11, 9, 14);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a4038, 1.1));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.8);
sun.position.set(6, 12, 5);
scene.add(sun);

const ground = new THREE.GridHelper(60, 60, 0x33414f, 0x242e3a);
scene.add(ground);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.minDistance = 6;
orbit.maxDistance = 35;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enablePan = false;

const drag = new DragControls(camera, renderer.domElement, orbit);
const effects = new Effects(scene);
const audio = new SoundFX(getSave().settings);
const ui = new UI();
const app = new App(
  { scene, camera, orbit, drag, effects, audio, sun, gridOverride: gridFromUrl() },
  ui
);
app.showMenu();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastFrame = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  updateTweens(now);
  effects.update(dt);
  orbit.update();
  app.tick(now);
  renderer.render(scene, camera);
});

// Debug/test hooks.
declare global {
  interface Window {
    __app: App;
    __camera: THREE.PerspectiveCamera;
    __raycaster: THREE.Raycaster;
    __renderer: THREE.WebGLRenderer;
  }
}
window.__app = app;
window.__camera = camera;
window.__raycaster = new THREE.Raycaster();
window.__renderer = renderer;
