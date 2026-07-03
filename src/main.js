import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const COUNT = 2000;
const BEST_KEY = 'crystal_swarm_best';
const colorPairs = [
  ['#dd3e1b', '#0b509c'],
  ['#ff5aa5', '#40e0ff'],
  ['#fff4a8', '#7b4dff'],
  ['#ff7a18', '#2af598'],
  ['#f953c6', '#22c1c3'],
  ['#fdfbfb', '#eb3b5a'],
];

const messages = {
  en: {
    time: 'Bodies',
    score: 'Palette',
    kicker: 'Subsurface swarm',
    title: 'Crystal Swarm',
    startCopy: 'Hold and drag to pull a glowing dodecahedron field through the light.',
    start: 'Begin',
    hint: 'Hold to attract · Drag to steer · Tap color',
    best: 'Best',
    rings: 'Bodies',
    combo: 'Palette',
    again: 'Again',
    home: 'Home',
    complete: 'Material study',
    incomplete: 'Material study',
  },
  zh: {
    time: '晶体',
    score: '色盘',
    kicker: '次表面散射群游',
    title: '水晶群',
    startCopy: '按住并拖动，让发光十二面体群穿过光源。',
    start: '开始',
    hint: '按住吸引 · 拖动引导 · 轻点换色',
    best: '最高',
    rings: '晶体',
    combo: '色盘',
    again: '再来一次',
    home: '返回首页',
    complete: '材质试验',
    incomplete: '材质试验',
  },
};

function detectLocale() {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const locale = detectLocale();
const t = (key) => messages[locale][key] || messages.en[key] || key;

document.querySelectorAll('[data-i18n]').forEach((el) => {
  el.textContent = t(el.dataset.i18n);
});

const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const endScreen = document.getElementById('endScreen');
const startButton = document.getElementById('startButton');
const againButton = document.getElementById('againButton');
const homeButton = document.getElementById('homeButton');
const timeLeft = document.getElementById('timeLeft');
const scoreValue = document.getElementById('scoreValue');
const finalScore = document.getElementById('finalScore');
const bestScore = document.getElementById('bestScore');
const ringCount = document.getElementById('ringCount');
const maxComboEl = document.getElementById('maxCombo');
const resultLabel = document.getElementById('resultLabel');
const comboBadge = document.getElementById('comboBadge');
const hint = document.getElementById('hint');

let phase = 'start';
let paletteIndex = 0;
let pointerActive = false;
let lastTap = 0;
let audioCtx = null;

const target = new THREE.Vector3(0, 0, 0);
const targetGoal = new THREE.Vector3(0, 0, 0);
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dummy = new THREE.Object3D();
const temp = new THREE.Vector3();
const color = new THREE.Color();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.setClearColor(0x060414, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060414);
scene.fog = new THREE.FogExp2(0x060414, 0.0026);

const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 220);

const controls = new OrbitControls(camera, gameScreen);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 110;
controls.maxDistance = 310;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.22;

const light = new THREE.PointLight(0xffc0c0, 9, 620, 1.05);
light.position.copy(target);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 1.05));
const blueFill = new THREE.DirectionalLight(0x7cf6ff, 1.4);
blueFill.position.set(-1.6, 0.8, 2.2);
scene.add(blueFill);
const pinkFill = new THREE.DirectionalLight(0xff74d4, 1.2);
pinkFill.position.set(1.4, -1.1, 2.4);
scene.add(pinkFill);

const geometry = new THREE.DodecahedronGeometry(5, 0);
const material = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.28,
  metalness: 0.02,
  transmission: 0.12,
  thickness: 5,
  transparent: true,
  opacity: 0.92,
  emissive: 0x170912,
  emissiveIntensity: 0.22,
});
const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(mesh);

const glowGeometry = new THREE.BufferGeometry();
const glowPositions = new Float32Array(COUNT * 3);
const glowColors = new Float32Array(COUNT * 3);
glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));
const glow = new THREE.Points(
  glowGeometry,
  new THREE.PointsMaterial({
    size: 2.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.66,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
scene.add(glow);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(stage.clientWidth, stage.clientHeight), 1.05, 0.68, 0.08));
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);
composer.addPass(new OutputPass());

const instances = Array.from({ length: COUNT }, () => ({
  position: new THREE.Vector3(THREE.MathUtils.randFloatSpread(230), THREE.MathUtils.randFloatSpread(230), THREE.MathUtils.randFloatSpread(230)),
  velocity: new THREE.Vector3(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2)),
  scale: THREE.MathUtils.randFloat(0.2, 1),
  attraction: 0.0025 + Math.random() * 0.01,
  vlimit: 0.3 + Math.random() * 0.2,
}));

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtor();
  }
  return audioCtx;
}

function resumeAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

function tone(freq, duration, options = {}) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime + (options.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (options.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.freqEnd), now + duration);
    gain.gain.setValueAtTime(options.gain ?? 0.04, now);
    gain.gain.exponentialRampToValueAtTime(options.gainEnd ?? 0.001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playStart() {
  tone(330, 0.18, { freqEnd: 660, gain: 0.045 });
}

function playColor() {
  [392, 523, 784].forEach((freq, i) => tone(freq, 0.09, { type: 'sine', gain: 0.026, delay: i * 0.04 }));
}

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
}

function lerpHexPair(pair, amount) {
  const a = new THREE.Color(pair[0]);
  const b = new THREE.Color(pair[1]);
  return a.lerp(b, amount);
}

function updateColors() {
  const pair = colorPairs[paletteIndex];
  for (let i = 0; i < COUNT; i += 1) {
    const mixed = lerpHexPair(pair, Math.random());
    mesh.setColorAt(i, mixed);
    glowColors[i * 3] = mixed.r;
    glowColors[i * 3 + 1] = mixed.g;
    glowColors[i * 3 + 2] = mixed.b;
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  glowGeometry.attributes.color.needsUpdate = true;
  scoreValue.textContent = String(paletteIndex + 1);
  maxComboEl.textContent = String(paletteIndex + 1);
}

function randomColors() {
  paletteIndex = (paletteIndex + 1) % colorPairs.length;
  updateColors();
  playColor();
}

function projectPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(plane, targetGoal);
}

function startGame() {
  resumeAudio();
  playStart();
  setPhase('playing');
  hint.classList.remove('is-hidden');
}

function onPointerDown(event) {
  if (phase !== 'playing') return;
  pointerActive = true;
  controls.autoRotate = false;
  projectPointer(event);
  hint.classList.add('is-hidden');
  const now = performance.now();
  if (now - lastTap < 280) randomColors();
  lastTap = now;
}

function onPointerMove(event) {
  if (phase !== 'playing' || !pointerActive) return;
  projectPointer(event);
}

function onPointerUp() {
  pointerActive = false;
}

function animate() {
  target.lerp(targetGoal, pointerActive ? 0.16 : 0.035);
  light.position.copy(target);

  for (let i = 0; i < COUNT; i += 1) {
    const item = instances[i];
    temp.copy(target).sub(item.position).normalize().multiplyScalar(item.attraction * (pointerActive ? 2.8 : 1));
    item.velocity.add(temp).clampScalar(-item.vlimit, item.vlimit);
    item.position.add(item.velocity);

    dummy.position.copy(item.position);
    dummy.scale.setScalar(item.scale);
    dummy.lookAt(temp.copy(item.position).add(item.velocity));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    glowPositions[i * 3] = item.position.x;
    glowPositions[i * 3 + 1] = item.position.y;
    glowPositions[i * 3 + 2] = item.position.z;
  }
  mesh.instanceMatrix.needsUpdate = true;
  glowGeometry.attributes.position.needsUpdate = true;
}

function render() {
  animate();
  controls.update();
  composer.render();
  requestAnimationFrame(render);
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  fxaa.material.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

timeLeft.textContent = String(COUNT);
finalScore.textContent = String(COUNT);
bestScore.textContent = localStorage.getItem(BEST_KEY) || '0';
ringCount.textContent = String(COUNT);
resultLabel.textContent = t('complete');
updateColors();
setPhase('start');
resize();
requestAnimationFrame(render);

startButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});
againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  randomColors();
  startGame();
});
homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  setPhase('start');
});
gameScreen.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (phase === 'start') startGame();
    else pointerActive = true;
  }
  if (event.code === 'KeyC') randomColors();
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') pointerActive = false;
});
