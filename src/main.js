import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const COUNT = 500;
const BEST_KEY = 'crystal_swarm_best';
const paletteSets = [
  ['#69d2e7', '#a7dbd8', '#e0e4cc', '#f38630', '#fa6900'],
  ['#fe4365', '#fc9d9a', '#f9cdad', '#c8c8a9', '#83af9b'],
  ['#ecd078', '#d95b43', '#c02942', '#542437', '#53777a'],
  ['#556270', '#4ecdc4', '#c7f464', '#ff6b6b', '#c44d58'],
  ['#774f38', '#e08e79', '#f1d4af', '#ece5ce', '#c5e0dc'],
  ['#e8ddcb', '#cdb380', '#036564', '#033649', '#031634'],
];

const messages = {
  en: {
    time: 'Balls',
    score: 'Palette',
    kicker: 'Cannon physics demo',
    title: 'Crystal Swarm',
    startCopy: 'Drag to orbit. Tap or hold to drop bouncing color spheres.',
    start: 'Begin',
    hint: 'Drag orbit · Tap drop · Hold stream',
    best: 'Best',
    rings: 'Drops',
    combo: 'Palette',
    again: 'Again',
    home: 'Home',
    complete: 'Physics ready',
    incomplete: 'Physics ready',
  },
  zh: {
    time: '球体',
    score: '色盘',
    kicker: 'Cannon 物理演示',
    title: '水晶群',
    startCopy: '拖动旋转视角，轻点或长按让彩色小球滚落反弹。',
    start: '开始',
    hint: '拖动旋转 · 轻点落球 · 长按连发',
    best: '最高',
    rings: '落球',
    combo: '色盘',
    again: '再来一次',
    home: '返回首页',
    complete: '物理就绪',
    incomplete: '物理就绪',
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
let dropBursts = 0;
let longPressTimer = 0;
let streamTimer = 0;
let pointerDownAt = 0;
let pointerStartX = 0;
let pointerStartY = 0;
let audioCtx = null;

const tempMatrix = new THREE.Matrix4();
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.setClearColor(0xf7f7f3, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f7f3);

const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
camera.position.set(0, 0, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4.2;
controls.maxDistance = 10;
controls.minPolarAngle = Math.PI * 0.18;
controls.maxPolarAngle = Math.PI * 0.82;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xaaaaaa, 1));

const spotA = new THREE.SpotLight(0xaaaaaa, 0.5, 18, Math.PI / 3, 0.5, 1);
spotA.position.set(0, 1, 2);
spotA.castShadow = true;
spotA.shadow.mapSize.set(1024, 1024);
scene.add(spotA);

const spotB = new THREE.SpotLight(0xff0000, 0.5, 18, Math.PI / 3, 0.5, 1);
spotB.position.set(0, -1, 2);
spotB.castShadow = true;
spotB.shadow.mapSize.set(1024, 1024);
scene.add(spotB);

const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15),
  new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 12 }),
);
backdrop.position.z = -0.1;
backdrop.receiveShadow = true;
scene.add(backdrop);

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
});
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.12;
world.defaultContactMaterial.restitution = 0.42;

const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const sphereMaterial = new THREE.MeshToonMaterial({ color: 0xffffff });
const spheres = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, COUNT);
spheres.castShadow = true;
spheres.receiveShadow = true;
spheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(spheres);

const bodies = [];
const scales = [];
const colors = [];
const rampMeshes = [];

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomSpread(range) {
  return (Math.random() - 0.5) * range;
}

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
}

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

function playClick() {
  tone(520, 0.045, { type: 'square', freqEnd: 390, gain: 0.024 });
}

function playStart() {
  tone(330, 0.18, { freqEnd: 660, gain: 0.045 });
}

function playDrop() {
  tone(180, 0.08, { type: 'triangle', freqEnd: 260, gain: 0.025 });
}

function playStreamTick() {
  tone(220, 0.04, { type: 'sine', gain: 0.018 });
}

function playColors() {
  [392, 523, 659].forEach((freq, i) => tone(freq, 0.08, { type: 'sine', gain: 0.028, delay: i * 0.035 }));
}

function updateHud() {
  timeLeft.textContent = String(COUNT);
  scoreValue.textContent = String(paletteIndex + 1);
  ringCount.textContent = String(dropBursts);
  maxComboEl.textContent = String(paletteIndex + 1);
}

function setSphereColor(index, hex) {
  colors[index] = hex;
  spheres.setColorAt(index, tempColor.set(hex));
}

function resetBody(index, high = false) {
  const body = bodies[index];
  body.position.set(randomSpread(2), high ? randomRange(5, 7) : randomSpread(5), randomSpread(0.08));
  body.velocity.set(randomSpread(0.4), high ? randomRange(-0.2, 0.5) : randomSpread(0.3), randomSpread(0.08));
  body.angularVelocity.set(0, 0, 0);
  body.quaternion.set(0, 0, 0, 1);
  body.wakeUp();
}

function initSpheres() {
  const palette = paletteSets[paletteIndex];
  for (let i = 0; i < COUNT; i += 1) {
    const scale = randomRange(0.2, 1);
    scales[i] = scale;
    setSphereColor(i, palette[Math.floor(Math.random() * palette.length)]);

    const shape = new CANNON.Sphere(0.1 * scale);
    const body = new CANNON.Body({
      mass: scale * 0.01,
      shape,
      linearDamping: 0.08,
      angularDamping: 0.15,
      position: new CANNON.Vec3(randomSpread(2), randomSpread(5), 0),
    });
    bodies[i] = body;
    world.addBody(body);

    tempObject.scale.setScalar(scale);
    tempObject.position.copy(body.position);
    tempObject.updateMatrix();
    spheres.setMatrixAt(i, tempObject.matrix);
  }
  if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
  spheres.instanceMatrix.needsUpdate = true;
}

function addRamp(index) {
  const even = index % 2 === 0;
  const x = (even ? 1 : -1) * 1;
  const y = (index - 3.5) * 1.5;
  const z = 0;
  const rz = (even ? 1 : -1) * Math.PI / 6;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.05, 0.2),
    new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 18 }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.z = rz;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  rampMeshes.push(mesh);

  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1.5, 0.025, 0.1)) });
  body.position.set(x, y, z);
  body.quaternion.setFromEuler(0, 0, rz);
  world.addBody(body);
}

function spray(count = 18) {
  resumeAudio();
  playDrop();
  dropBursts += 1;
  for (let i = 0; i < count; i += 1) {
    resetBody((dropBursts * count + i) % COUNT, true);
  }
  updateHud();
}

function randomColors() {
  paletteIndex = (paletteIndex + 1) % paletteSets.length;
  const palette = paletteSets[paletteIndex];
  for (let i = 0; i < COUNT; i += 1) {
    setSphereColor(i, palette[Math.floor(Math.random() * palette.length)]);
  }
  spheres.instanceColor.needsUpdate = true;
  playColors();
  updateHud();
}

function startGame() {
  resumeAudio();
  playStart();
  setPhase('playing');
  hint.classList.remove('is-hidden');
  spray(26);
}

function returnHome() {
  playClick();
  setPhase('start');
}

function pointerDistance(event) {
  return Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
}

function onPointerDown(event) {
  if (phase !== 'playing') return;
  pointerDownAt = performance.now();
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  window.clearTimeout(longPressTimer);
  window.clearInterval(streamTimer);
  longPressTimer = window.setTimeout(() => {
    if (phase !== 'playing') return;
    hint.classList.add('is-hidden');
    spray(10);
    playStreamTick();
    streamTimer = window.setInterval(() => {
      spray(10);
      playStreamTick();
    }, 120);
  }, 420);
}

function onPointerUp(event) {
  if (phase !== 'playing') return;
  window.clearTimeout(longPressTimer);
  window.clearInterval(streamTimer);
  const elapsed = performance.now() - pointerDownAt;
  if (elapsed < 420 && pointerDistance(event) < 10) {
    hint.classList.add('is-hidden');
    spray(18);
  }
}

function onPointerCancel() {
  window.clearTimeout(longPressTimer);
  window.clearInterval(streamTimer);
}

function syncMeshes() {
  for (let i = 0; i < COUNT; i += 1) {
    const body = bodies[i];
    if (body.position.y < -7) resetBody(i, true);
    tempObject.position.copy(body.position);
    tempObject.quaternion.copy(body.quaternion);
    tempObject.scale.setScalar(scales[i]);
    tempObject.updateMatrix();
    spheres.setMatrixAt(i, tempObject.matrix);
  }
  spheres.instanceMatrix.needsUpdate = true;
}

function frame(now) {
  const dt = Math.min(0.033, (now - (frame.last || now)) / 1000 || 1 / 60);
  frame.last = now;
  world.step(1 / 60, dt, 3);
  syncMeshes();
  rampMeshes.forEach((ramp, i) => {
    ramp.material.color.setHSL(((paletteIndex * 0.13) + i * 0.04) % 1, 0.36, 0.64);
  });
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

for (let i = 0; i < 6; i += 1) addRamp(i + 1);
initSpheres();
updateHud();

startButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});
againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  spray(32);
});
homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  returnHome();
});
gameScreen.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerCancel, { passive: true });
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (phase === 'start') startGame();
    else spray(24);
  }
  if (event.code === 'KeyC') randomColors();
});
renderer.domElement.addEventListener('dblclick', randomColors);

resultLabel.textContent = t('complete');
finalScore.textContent = String(COUNT);
bestScore.textContent = localStorage.getItem(BEST_KEY) || '0';
setPhase('start');
resize();
requestAnimationFrame(frame);
