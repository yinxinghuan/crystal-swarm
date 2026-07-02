import './styles.css';
import * as THREE from 'three';

const ROUND_MS = 45000;
const COUNT = 900;
const BEST_KEY = 'crystal_swarm_best';
const TARGETS = [
  new THREE.Vector3(-1.35, -0.9, 0),
  new THREE.Vector3(1.2, 0.05, 0),
  new THREE.Vector3(0, 1.05, 0),
];

const messages = {
  en: {
    time: 'Time',
    score: 'Score',
    kicker: 'Touch gravity into light',
    title: 'Crystal Swarm',
    startCopy: 'Pull the glass swarm into all three rings before the prism fades.',
    start: 'Begin',
    hint: 'Hold to gather',
    best: 'Best',
    rings: 'Rings',
    combo: 'Combo',
    again: 'Again',
    home: 'Home',
    complete: 'Prism complete',
    incomplete: 'Prism faded',
    flow: 'Flow',
    prism: 'Prism',
  },
  zh: {
    time: '时间',
    score: '分数',
    kicker: '把引力点成光',
    title: '水晶群',
    startCopy: '按住屏幕，把玻璃水晶群拉进三个能量环，在棱镜熄灭前完成充能。',
    start: '开始',
    hint: '按住聚拢',
    best: '最高',
    rings: '能量环',
    combo: '连击',
    again: '再来一次',
    home: '返回首页',
    complete: '棱镜完成',
    incomplete: '棱镜熄灭',
    flow: '流光',
    prism: '棱镜',
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
let score = 0;
let best = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
let roundStart = 0;
let maxCombo = 1;
let litCount = 0;
let pointerDown = false;
let keyboardGravity = false;
let attraction = 0;
let comboHideTimer = 0;
let lastDensityScore = 0;

let audioCtx = null;

const pointer = new THREE.Vector2(0, 0);
const gravityPoint = new THREE.Vector3(0, 0, 0);
const targetGravityPoint = new THREE.Vector3(0, 0, 0);
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const tempVector = new THREE.Vector3();
const tempColor = new THREE.Color();
const dummy = new THREE.Object3D();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05030f, 1);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030f);
scene.fog = new THREE.FogExp2(0x05030f, 0.16);

const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
camera.position.set(0, 0, 5.4);

const ambient = new THREE.AmbientLight(0x7ca7ff, 0.34);
scene.add(ambient);
const lightA = new THREE.PointLight(0x7cf6ff, 1.05, 8);
lightA.position.set(-1.8, -1.2, 2.8);
scene.add(lightA);
const lightB = new THREE.PointLight(0xff74d4, 0.95, 8);
lightB.position.set(1.8, 1.2, 2.2);
scene.add(lightB);
const lightC = new THREE.PointLight(0xfff4a8, 0.55, 8);
lightC.position.set(0, 0, 3);
scene.add(lightC);

const crystalGeometry = new THREE.OctahedronGeometry(1, 0);
const crystalMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0.2,
  roughness: 0.18,
  transmission: 0.08,
  thickness: 0.35,
  transparent: true,
  opacity: 0.86,
  emissive: 0x213a55,
  emissiveIntensity: 0.26,
});
const crystals = new THREE.InstancedMesh(crystalGeometry, crystalMaterial, COUNT);
crystals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(crystals);

const glowGeometry = new THREE.BufferGeometry();
const glowPositions = new Float32Array(COUNT * 3);
const glowColors = new Float32Array(COUNT * 3);
const glowSizes = new Float32Array(COUNT);
glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));
glowGeometry.setAttribute('size', new THREE.BufferAttribute(glowSizes, 1));
const glowMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float pixelRatio;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = min(72.0 * pixelRatio, size * pixelRatio * (42.0 / -mvPosition.z));
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor, a * 0.055);
    }
  `,
});
const glowPoints = new THREE.Points(glowGeometry, glowMaterial);
scene.add(glowPoints);

const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.38, 2),
  new THREE.MeshPhysicalMaterial({
    color: 0xe9ffff,
    emissive: 0x7cf6ff,
    emissiveIntensity: 1.4,
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.82,
  }),
);
scene.add(core);

const rings = TARGETS.map((target, index) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.014, 12, 96),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.position.copy(target);
  ring.userData = { charge: 0, lit: false, count: 0, index };
  scene.add(ring);
  return ring;
});

const haloRings = TARGETS.map((target) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.64, 0.006, 8, 96),
    new THREE.MeshBasicMaterial({
      color: 0x7cf6ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.position.copy(target);
  scene.add(ring);
  return ring;
});

const palette = [0x7cf6ff, 0xb692ff, 0xff74d4, 0xfff4a8].map((c) => new THREE.Color(c));
const swarm = Array.from({ length: COUNT }, (_, i) => {
  const angle = Math.random() * Math.PI * 2;
  const radius = 1.1 + Math.random() * 1.7;
  const z = -0.5 + Math.random() * 1;
  const targetIndex = i % TARGETS.length;
  const color = palette[Math.floor(Math.random() * palette.length)].clone();
  const size = 0.045 + Math.random() * 0.095;
  tempVector.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  crystals.setColorAt(i, color);
  glowColors[i * 3] = color.r;
  glowColors[i * 3 + 1] = color.g;
  glowColors[i * 3 + 2] = color.b;
  glowSizes[i] = 2.8 + Math.random() * 3.2;
  return {
    position: tempVector.clone(),
    velocity: new THREE.Vector3((Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.008),
    phase: Math.random() * Math.PI * 2,
    orbit: 0.8 + Math.random() * 1.6,
    size,
    spin: new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random() * 2),
    targetIndex,
  };
});
if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;

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
  tone(330, 0.18, { freqEnd: 660, gain: 0.05 });
  tone(880, 0.12, { type: 'triangle', gain: 0.035, delay: 0.12 });
}

function playPull() {
  tone(110, 0.16, { freqEnd: 180, gain: 0.035 });
}

function playRing() {
  [523, 659, 988].forEach((freq, i) => tone(freq, 0.11, { type: 'sine', gain: 0.045, delay: i * 0.045 }));
}

function playComplete() {
  [392, 523, 784, 1046].forEach((freq, i) => tone(freq, 0.18, { type: 'triangle', gain: 0.05, delay: i * 0.06 }));
}

function playFail() {
  tone(180, 0.28, { type: 'sawtooth', freqEnd: 90, gain: 0.035 });
}

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
}

function startGame() {
  resumeAudio();
  playStart();
  score = 0;
  maxCombo = 1;
  litCount = 0;
  attraction = 0;
  pointerDown = false;
  keyboardGravity = false;
  roundStart = performance.now();
  lastDensityScore = roundStart;
  scoreValue.textContent = '0';
  timeLeft.textContent = '45';
  hint.classList.remove('is-hidden');
  rings.forEach((ring) => {
    ring.userData.charge = 0;
    ring.userData.lit = false;
    ring.userData.count = 0;
    ring.material.opacity = 0.42;
    ring.material.color.set(0xffffff);
  });
  setPhase('playing');
}

function endGame(completed) {
  if (phase !== 'playing') return;
  if (completed) playComplete();
  else playFail();
  best = Math.max(best, score);
  localStorage.setItem(BEST_KEY, String(best));
  finalScore.textContent = String(score);
  bestScore.textContent = String(best);
  ringCount.textContent = `${litCount}/3`;
  maxComboEl.textContent = String(maxCombo);
  resultLabel.textContent = completed ? t('complete') : t('incomplete');
  setPhase('end');
}

function projectPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(plane, targetGravityPoint);
}

function updatePointerFromCenter() {
  targetGravityPoint.set(0, 0, 0);
}

function handlePointerDown(event) {
  if (phase !== 'playing') return;
  event.preventDefault();
  resumeAudio();
  playPull();
  pointerDown = true;
  hint.classList.add('is-hidden');
  projectPointer(event);
}

function handlePointerMove(event) {
  if (phase !== 'playing' || !pointerDown) return;
  projectPointer(event);
}

function handlePointerUp() {
  pointerDown = false;
}

function showCombo(value) {
  window.clearTimeout(comboHideTimer);
  const word = value >= 3 ? t('prism') : t('flow');
  comboBadge.textContent = `x${value} ${word}`;
  comboBadge.classList.add('is-visible');
  comboHideTimer = window.setTimeout(() => comboBadge.classList.remove('is-visible'), 700);
}

function addScore(points) {
  score += points;
  scoreValue.textContent = String(score);
}

function updateGame(now) {
  if (phase !== 'playing') return;
  const remaining = Math.max(0, ROUND_MS - (now - roundStart));
  timeLeft.textContent = String(Math.ceil(remaining / 1000));
  if (remaining <= 0) endGame(false);
}

function updateSwarm(now, dt) {
  const activeGravity = phase === 'playing' && (pointerDown || keyboardGravity);
  if (keyboardGravity) updatePointerFromCenter();
  attraction += ((activeGravity ? 1 : 0) - attraction) * Math.min(1, dt / 0.55);
  gravityPoint.lerp(targetGravityPoint, 0.22);

  const time = now * 0.001;
  const maxSpeed = THREE.MathUtils.lerp(0.018, 0.038, attraction);
  const counts = [0, 0, 0];

  for (let i = 0; i < COUNT; i += 1) {
    const c = swarm[i];
    const p = c.position;
    const v = c.velocity;

    tempVector.set(
      Math.cos(time * 0.43 + c.phase) * c.orbit,
      Math.sin(time * 0.37 + c.phase * 1.3) * c.orbit * 0.72,
      Math.sin(time * 0.31 + c.phase) * 0.46,
    );
    tempVector.sub(p).multiplyScalar(0.0009);
    v.add(tempVector);

    if (attraction > 0.01) {
      tempVector.copy(gravityPoint).sub(p);
      const dist = Math.max(0.22, tempVector.length());
      v.add(tempVector.normalize().multiplyScalar((0.0045 / dist) * attraction));
    }

    const radial = p.length();
    if (radial > 2.95) {
      tempVector.copy(p).normalize().multiplyScalar(-0.0035);
      v.add(tempVector);
    }

    v.multiplyScalar(0.986);
    v.clampLength(0, maxSpeed);
    p.addScaledVector(v, dt * 60);

    TARGETS.forEach((target, targetIndex) => {
      if (p.distanceTo(target) < 0.62) counts[targetIndex] += 1;
    });

    const scalePulse = 1 + Math.sin(time * 2 + c.phase) * 0.08;
    dummy.position.copy(p);
    dummy.rotation.set(c.spin.x + time * 0.4, c.spin.y + time * 0.55, c.spin.z + time * 0.28);
    dummy.scale.setScalar(c.size * scalePulse);
    dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);

    glowPositions[i * 3] = p.x;
    glowPositions[i * 3 + 1] = p.y;
    glowPositions[i * 3 + 2] = p.z;
  }

  crystals.instanceMatrix.needsUpdate = true;
  glowGeometry.attributes.position.needsUpdate = true;
  updateRings(now, counts);
}

function updateRings(now, counts) {
  if (phase === 'playing' && now - lastDensityScore > 250) {
    lastDensityScore = now;
    const densityPoints = counts.reduce((sum, count, index) => {
      if (rings[index].userData.lit) return sum;
      return sum + Math.min(8, Math.floor(count / 9));
    }, 0);
    if (densityPoints > 0) addScore(densityPoints);
  }

  rings.forEach((ring, index) => {
    const data = ring.userData;
    data.count = counts[index];
    if (!data.lit) {
      if (phase === 'playing' && data.count >= 58) data.charge += 1 / 60;
      else data.charge = Math.max(0, data.charge - 0.018);
      if (data.charge >= 1.05) {
        data.lit = true;
        litCount += 1;
        maxCombo = Math.max(maxCombo, litCount);
        addScore(300 + litCount * 60);
        playRing();
        if (litCount >= 2) showCombo(litCount);
        if (litCount === 3) {
          addScore(900);
          window.setTimeout(() => endGame(true), 240);
        }
      }
    }
    const charge = data.lit ? 1 : Math.min(1, data.charge / 1.05);
    ring.material.opacity = 0.34 + charge * 0.62;
    ring.material.color.copy(tempColor.set(data.lit ? 0xfff4a8 : 0x7cf6ff).lerp(new THREE.Color(0xff74d4), charge * 0.35));
    ring.scale.setScalar(1 + Math.sin(now * 0.006 + index) * 0.025 + charge * 0.16);
    ring.rotation.z += 0.006 + charge * 0.012;
    haloRings[index].material.opacity = 0.12 + charge * 0.25;
    haloRings[index].scale.setScalar(1 + charge * 0.22);
  });
}

function render(now) {
  const dt = Math.min(0.033, (now - (render.last || now)) / 1000 || 0.016);
  render.last = now;
  updateGame(now);
  updateSwarm(now, dt);
  const tnow = now * 0.001;
  camera.position.x = Math.sin(tnow * 0.16) * 0.18;
  camera.position.y = Math.cos(tnow * 0.13) * 0.1;
  camera.lookAt(0, 0, 0);
  core.position.lerp(gravityPoint, 0.18);
  core.scale.setScalar(1 + attraction * 0.38 + Math.sin(tnow * 2.4) * 0.04);
  core.rotation.x += 0.006;
  core.rotation.y += 0.01;
  lightA.position.x = Math.sin(tnow * 0.7) * 2.2;
  lightA.position.y = Math.cos(tnow * 0.5) * 1.6;
  lightB.position.x = Math.cos(tnow * 0.6) * 2.0;
  lightB.position.y = Math.sin(tnow * 0.75) * 1.8;
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  glowMaterial.uniforms.pixelRatio.value = renderer.getPixelRatio();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

startButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});
againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  playClick();
  startGame();
});
homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  playClick();
  setPhase('start');
});
gameScreen.addEventListener('pointerdown', handlePointerDown, { passive: false });
window.addEventListener('pointermove', handlePointerMove, { passive: true });
window.addEventListener('pointerup', handlePointerUp);
window.addEventListener('pointercancel', handlePointerUp);
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return;
  if (phase === 'start' || phase === 'end') {
    event.preventDefault();
    startGame();
  } else if (phase === 'playing') {
    event.preventDefault();
    keyboardGravity = true;
    hint.classList.add('is-hidden');
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') keyboardGravity = false;
});

setPhase('start');
resize();
requestAnimationFrame(render);
