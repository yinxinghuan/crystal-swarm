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
const GAME_DURATION = 45;
const TARGET_COUNT = 3;
const TARGET_RADIUS = 28;
const TARGET_RADIUS_SQ = TARGET_RADIUS * TARGET_RADIUS;
const TARGET_THRESHOLD = 80;
const TARGET_HOLD_SECONDS = 1.2;
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
    time: 'Time',
    score: 'Score',
    kicker: 'Subsurface swarm',
    title: 'Crystal Swarm',
    startCopy: 'Drag the light and gather the swarm into the glowing rings before time runs out.',
    start: 'Begin',
    hint: 'Gather rings · Double tap color',
    best: 'Best',
    rings: 'Lit',
    combo: 'Combo',
    again: 'Again',
    home: 'Home',
    complete: 'Light complete',
    incomplete: 'Time up',
  },
  zh: {
    time: '时间',
    score: '得分',
    kicker: '次表面散射群游',
    title: '水晶群',
    startCopy: '拖动光源，把晶体群收束进发光光圈，在时间结束前点亮更多目标。',
    start: '开始',
    hint: '收束光圈 · 双击换色',
    best: '最高',
    rings: '点亮',
    combo: '连击',
    again: '再来一次',
    home: '返回首页',
    complete: '引光完成',
    incomplete: '时间到',
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
let score = 0;
let litCount = 0;
let combo = 0;
let maxCombo = 0;
let remaining = GAME_DURATION;
let previousFrameTime = performance.now();
let comboTimer = 0;
let audioCtx = null;

const target = new THREE.Vector3(0, 0, 0);
const targetGoal = new THREE.Vector3(0, 0, 0);
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dummy = new THREE.Object3D();
const temp = new THREE.Vector3();
const color = new THREE.Color();
const targetColors = [0x7cf6ff, 0xff74d4, 0xfff4a8];

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
const hotLight = new THREE.PointLight(0xffffff, 1.4, 105, 2);
scene.add(new THREE.AmbientLight(0xffffff, 1.05));
const blueFill = new THREE.DirectionalLight(0x7cf6ff, 1.4);
blueFill.position.set(-1.6, 0.8, 2.2);
scene.add(blueFill);
const pinkFill = new THREE.DirectionalLight(0xff74d4, 1.2);
pinkFill.position.set(1.4, -1.1, 2.4);
scene.add(pinkFill);

function createRadialTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.18, inner);
  gradient.addColorStop(0.52, outer);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const lightCore = new THREE.Group();
const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createRadialTexture('rgba(255,255,255,0.72)', 'rgba(255,128,210,0.34)'),
  transparent: true,
  opacity: 0.54,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}));
coreSprite.scale.set(11, 11, 1);
const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createRadialTexture('rgba(124,246,255,0.32)', 'rgba(255,116,212,0.13)'),
  transparent: true,
  opacity: 0.36,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}));
haloSprite.scale.set(36, 36, 1);
lightCore.add(haloSprite, coreSprite, hotLight);
lightCore.visible = false;
scene.add(lightCore);

const targetGroups = Array.from({ length: TARGET_COUNT }, (_, i) => {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(TARGET_RADIUS, 0.9, 8, 96),
    new THREE.MeshBasicMaterial({
      color: targetColors[i],
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(TARGET_RADIUS * 0.76, 64),
    new THREE.MeshBasicMaterial({
      color: targetColors[i],
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(fill, ring);
  group.visible = false;
  scene.add(group);
  return { group, ring, fill, progress: 0, count: 0 };
});

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

function playCapture() {
  tone(520, 0.16, { type: 'triangle', freqEnd: 880, gain: 0.05 });
  if (combo > 2) tone(1174, 0.08, { type: 'sine', gain: 0.025, delay: 0.04 });
}

function playEnd() {
  tone(220, 0.2, { type: 'sine', freqEnd: 440, gain: 0.04 });
}

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
  targetGroups.forEach((targetItem) => {
    targetItem.group.visible = nextPhase === 'playing';
  });
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
}

function randomColors() {
  paletteIndex = (paletteIndex + 1) % colorPairs.length;
  updateColors();
  playColor();
}

function updateHud() {
  timeLeft.textContent = String(Math.max(0, Math.ceil(remaining)));
  scoreValue.textContent = String(score);
}

function showCombo(text) {
  comboBadge.textContent = text;
  comboBadge.classList.add('is-visible');
  window.clearTimeout(comboTimer);
  comboTimer = window.setTimeout(() => comboBadge.classList.remove('is-visible'), 720);
}

function placeTarget(index) {
  const targetItem = targetGroups[index];
  let x = 0;
  let y = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    x = THREE.MathUtils.randFloatSpread(156);
    y = THREE.MathUtils.randFloatSpread(156);
    const tooClose = targetGroups.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const dx = other.group.position.x - x;
      const dy = other.group.position.y - y;
      return dx * dx + dy * dy < 42 * 42;
    });
    if (!tooClose) break;
  }
  targetItem.group.position.set(x, y, 0);
  targetItem.progress = 0;
  targetItem.count = 0;
  targetItem.ring.scale.setScalar(1);
  targetItem.fill.scale.setScalar(1);
}

function resetTargets() {
  for (let i = 0; i < TARGET_COUNT; i += 1) placeTarget(i);
}

function resetGameState() {
  score = 0;
  litCount = 0;
  combo = 0;
  maxCombo = 0;
  remaining = GAME_DURATION;
  previousFrameTime = performance.now();
  pointerActive = false;
  comboBadge.classList.remove('is-visible');
  resetTargets();
  updateHud();
}

function endGame() {
  if (phase !== 'playing') return;
  pointerActive = false;
  setPhase('end');
  playEnd();
  const best = Math.max(Number(localStorage.getItem(BEST_KEY) || 0), score);
  localStorage.setItem(BEST_KEY, String(best));
  finalScore.textContent = String(score);
  bestScore.textContent = String(best);
  ringCount.textContent = String(litCount);
  maxComboEl.textContent = String(maxCombo);
  resultLabel.textContent = t(score > 0 ? 'complete' : 'incomplete');
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
  resetGameState();
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

function updateTargets(dt, counts) {
  for (let i = 0; i < TARGET_COUNT; i += 1) {
    const targetItem = targetGroups[i];
    targetItem.count = counts[i];
    if (counts[i] >= TARGET_THRESHOLD) {
      targetItem.progress = Math.min(TARGET_HOLD_SECONDS, targetItem.progress + dt);
    } else {
      targetItem.progress = Math.max(0, targetItem.progress - dt * 0.55);
    }

    const fillAmount = targetItem.progress / TARGET_HOLD_SECONDS;
    targetItem.ring.material.opacity = 0.28 + fillAmount * 0.52;
    targetItem.fill.material.opacity = 0.045 + fillAmount * 0.16;
    targetItem.ring.scale.setScalar(1 + fillAmount * 0.13);
    targetItem.fill.scale.setScalar(1 + fillAmount * 0.08);

    if (targetItem.progress >= TARGET_HOLD_SECONDS) {
      score += 100 + combo * 25;
      litCount += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      showCombo(`x${combo}`);
      playCapture();
      placeTarget(i);
      updateHud();
    }
  }
}

function animate(dt) {
  target.lerp(targetGoal, pointerActive ? 0.16 : 0.035);
  light.position.copy(target);
  light.intensity = THREE.MathUtils.lerp(light.intensity, pointerActive ? 12.5 : 8.2, 0.12);
  light.distance = THREE.MathUtils.lerp(light.distance, pointerActive ? 620 : 540, 0.08);
  hotLight.intensity = THREE.MathUtils.lerp(hotLight.intensity, pointerActive ? 3.4 : 0.8, 0.14);
  lightCore.visible = phase === 'playing';
  lightCore.position.copy(target);
  const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
  const activeScale = pointerActive ? 1.05 : 0.72;
  coreSprite.scale.setScalar(11 * activeScale * pulse);
  haloSprite.scale.setScalar(36 * activeScale * pulse);

  const captureCounts = [0, 0, 0];
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

    for (let targetIndex = 0; targetIndex < TARGET_COUNT; targetIndex += 1) {
      const targetPosition = targetGroups[targetIndex].group.position;
      const dx = item.position.x - targetPosition.x;
      const dy = item.position.y - targetPosition.y;
      if (dx * dx + dy * dy <= TARGET_RADIUS_SQ) captureCounts[targetIndex] += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  glowGeometry.attributes.position.needsUpdate = true;

  if (phase === 'playing') {
    remaining -= dt;
    updateTargets(dt, captureCounts);
    updateHud();
    if (remaining <= 0) endGame();
  }
}

function render() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - previousFrameTime) / 1000);
  previousFrameTime = now;
  animate(dt);
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

timeLeft.textContent = String(GAME_DURATION);
finalScore.textContent = '0';
bestScore.textContent = localStorage.getItem(BEST_KEY) || '0';
ringCount.textContent = '0';
maxComboEl.textContent = '0';
resultLabel.textContent = t('complete');
updateColors();
updateHud();
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
