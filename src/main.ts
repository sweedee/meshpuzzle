import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './game';
import { DragControls } from './controls';

const BG = new THREE.Color(0x1a2028);

function gridFromUrl(): THREE.Vector3 {
  // Tweak difficulty without a rebuild, e.g. ?grid=3x2x3
  const m = new URLSearchParams(location.search).get('grid')?.match(/^(\d+)x(\d+)x(\d+)$/);
  if (!m) return new THREE.Vector3(4, 3, 3);
  const clamp = (v: string) => THREE.MathUtils.clamp(parseInt(v, 10), 1, 8);
  return new THREE.Vector3(clamp(m[1]), clamp(m[2]), clamp(m[3]));
}

const app = document.querySelector('#app') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 30, 60);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(11, 9, 14);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a4038, 1.1));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.8);
sun.position.set(6, 12, 5);
scene.add(sun);

const ground = new THREE.GridHelper(60, 60, 0x33414f, 0x242e3a);
scene.add(ground);

const game = new Game(scene, gridFromUrl());

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.copy(game.latticeCenter);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.minDistance = 6;
orbit.maxDistance = 35;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enablePan = false;

new DragControls(camera, renderer.domElement, orbit, game);

// --- HUD ---
const countEl = document.querySelector('#count') as HTMLElement;
const winEl = document.querySelector('#win') as HTMLElement;
const hintEl = document.querySelector('#hint') as HTMLElement;

game.onChange = () => {
  countEl.textContent = `${game.placed} / ${game.total}`;
};
game.onWin = () => {
  winEl.classList.remove('hidden');
};
game.onChange();

document.querySelector('#reset')!.addEventListener('click', () => {
  winEl.classList.add('hidden');
  game.reset();
});
document.querySelector('#again')!.addEventListener('click', () => {
  winEl.classList.add('hidden');
  game.reset();
});
setTimeout(() => hintEl.classList.add('faded'), 7000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  orbit.update();
  renderer.render(scene, camera);
});

// Debug/test hooks.
declare global {
  interface Window {
    __game: Game;
    __camera: THREE.PerspectiveCamera;
    __raycaster: THREE.Raycaster;
  }
}
window.__game = game;
window.__camera = camera;
window.__raycaster = new THREE.Raycaster();
