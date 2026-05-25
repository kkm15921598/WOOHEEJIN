import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  type Mode,
  getTodayCount,
  getMonthCount,
  addPops,
  checkMilestone,
  milestonePraise,
  pickResultPraise,
  stressPraise,
  currentMonthLabel,
  levelUpPraise,
  IMMERSION_START_MS,
  IMMERSION_BONUS_MS,
} from "./modes";
import { COLS, ROWS } from "./patterns";
import { buildShareCard, shareOrDownload } from "./share";

// ---------- DOM ----------
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const todayCountEl = document.getElementById("todayCount")!;
const monthCountEl = document.getElementById("monthCount")!;
const monthLabelEl = document.getElementById("monthLabel")!;
const hero = document.getElementById("hero")!;
const btnMeditation = document.getElementById("btnMeditation")!;
const btnImmersion = document.getElementById("btnImmersion")!;
const btnStress = document.getElementById("btnStress")!;
const stressInputEl = document.getElementById("stressInput")!;
const stressTextField = document.getElementById("stressText") as HTMLInputElement;
const btnStressGo = document.getElementById("btnStressGo")!;
const btnStressBack = document.getElementById("btnStressBack")!;
const stressLabelEl = document.getElementById("stressLabel") as HTMLElement;
const comboEl = document.getElementById("combo")!;
const comboValueEl = document.getElementById("comboValue")!;
const praiseToastEl = document.getElementById("praiseToast")!;
const praiseTextEl = document.getElementById("praiseText")!;
const clearToastEl = document.getElementById("clearToast")!;
const clearTextEl = document.getElementById("clearText")!;
const immersionHud = document.getElementById("immersionHud") as HTMLElement;
const immersionTimerEl = document.getElementById("immersionTimer")!;
const immersionBonusEl = document.getElementById("immersionBonus")!;
const immersionLevelNumEl = document.getElementById("immersionLevelNum")!;
const immersionRemainingEl = document.getElementById("immersionRemaining")!;
const hudBrand = document.getElementById("hudBrand") as HTMLElement;
const btnStop = document.getElementById("btnStop") as HTMLElement;
const gameInfoHud = document.getElementById("gameInfoHud") as HTMLElement;
const levelNumEl = document.getElementById("levelNum")!;
const remainingCountEl = document.getElementById("remainingCount")!;
const monthInfo = document.getElementById("monthInfo") as HTMLElement;
const monthInfoText = document.getElementById("monthInfoText")!;
const resultEl = document.getElementById("result")!;
const resultTitle = document.getElementById("resultTitle")!;
const resultStressWord = document.getElementById("resultStressWord") as HTMLElement;
const resultCountWrap = document.getElementById("resultCountWrap") as HTMLElement;
const resultCount = document.getElementById("resultCount")!;
const resultPraise = document.getElementById("resultPraise")!;
const resultSummary = document.getElementById("resultSummary")!;
const btnReplay = document.getElementById("btnReplay")!;
const btnShare = document.getElementById("btnShare")!;
const btnOther = document.getElementById("btnOther")!;
const btnHome = document.getElementById("btnHome")!;
const btnResetLevel = document.getElementById("btnResetLevel") as HTMLElement;

// ---------- 1. 씬 셋업 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

// 카메라를 그리드에 맞춰서 모든 버블이 화면 안에 보이게 (히어로 화면용)
function fitCamera() {
  const gridW = (COLS - 1) * GAP + GAP;
  const gridH = (ROWS - 1) * GAP;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const zForH = (gridH / 2 + 1.5) / Math.tan(vFov / 2);
  const zForW = (gridW / 2 + 1.5) / Math.tan(hFov / 2);
  camera.position.z = Math.max(zForH, zForW);
}

// 현재 버블 배치에 딱 맞게 카메라 줌
function fitCameraToContent(padding = 1.0) {
  if (bubbles.length === 0) { fitCamera(); return; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of bubbles) {
    const r = b.mesh.scale.x * 0.55;
    minX = Math.min(minX, b.basePos.x - r);
    maxX = Math.max(maxX, b.basePos.x + r);
    minY = Math.min(minY, b.basePos.y - r);
    maxY = Math.max(maxY, b.basePos.y + r);
  }
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const zForH = (contentH / 2 + padding) / Math.tan(vFov / 2);
  const zForW = (contentW / 2 + padding) / Math.tan(hFov / 2);
  camera.position.z = Math.max(zForH, zForW, 3);
  camera.position.x = (minX + maxX) / 2;
  camera.position.y = (minY + maxY) / 2;
}

function getVisibleBounds() {
  const vFov = (camera.fov * Math.PI) / 180;
  const halfH = Math.tan(vFov / 2) * camera.position.z;
  const halfW = halfH * camera.aspect;
  return { halfW, halfH };
}

scene.add(new THREE.AmbientLight(0xa8c0ff, 0.35));
const keyLight = new THREE.DirectionalLight(0xe0d4ff, 0.9);
keyLight.position.set(5, 8, 5);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8ad5e8, 1.1);
rimLight.position.set(-5, -3, -5);
scene.add(rimLight);
const auraLight = new THREE.PointLight(0xc6a8ff, 1.4, 30);
auraLight.position.set(0, 0, 6);
scene.add(auraLight);

// ---------- 게임 상태 ----------
let mode: Mode = "meditation";
let level = 1;
let sessionCount = 0;
let gridClears = 0;
let gridStartTime = 0;
let sessionStartTime = 0;
let comboCount = 0;
let lastPopTime = 0;
const COMBO_WINDOW = 600;
let comboHideTimer: number | null = null;
let immersionRemaining = 0;
let immersionLastTick = 0;
let playing = false;
let stressName = "";

// ---------- 2. 버블 그리드 ----------
type Bubble = {
  mesh: THREE.Mesh;
  popped: boolean;
  basePos: THREE.Vector3;
  color: number;
  emissive: number;
  floatPhase: number;
  rare: boolean;
};

const bubbles: Bubble[] = [];
const GAP = 1.45;
const bubbleGeo = new THREE.SphereGeometry(0.55, 32, 32);

const MYSTIC_PALETTE = [
  { color: 0x7DD3FC, emissive: 0x1E3A8A },
  { color: 0xC084FC, emissive: 0x4C1D95 },
  { color: 0xF472B6, emissive: 0x9D174D },
  { color: 0x6EE7B7, emissive: 0x065F46 },
  { color: 0xFCD34D, emissive: 0xB45309 },
  { color: 0xA78BFA, emissive: 0x5B21B6 },
  { color: 0xFB7185, emissive: 0xBE123C },
  { color: 0x67E8F9, emissive: 0x0E7490 },
  { color: 0xFDA4AF, emissive: 0xBE185D },
  { color: 0xC4B5FD, emissive: 0x4338CA },
  { color: 0x86EFAC, emissive: 0x166534 },
  { color: 0xFBBF24, emissive: 0x92400E },
];
const RARE_PALETTE = { color: 0xFFE066, emissive: 0xC97B00 };

function makeBubbleMaterial(isRare: boolean) {
  const palette = isRare ? RARE_PALETTE : MYSTIC_PALETTE[Math.floor(Math.random() * MYSTIC_PALETTE.length)];
  const mat = new THREE.MeshPhysicalMaterial({
    color: palette.color, emissive: palette.emissive,
    emissiveIntensity: isRare ? 0.9 : 0.35,
    metalness: isRare ? 0.4 : 0, roughness: isRare ? 0.05 : 0.08,
    transmission: isRare ? 0.3 : 0.55, thickness: 1.2, ior: 1.5,
    iridescence: isRare ? 1.0 : 0.7, iridescenceIOR: 1.45,
    iridescenceThicknessRange: [200, 600],
    clearcoat: 1.0, clearcoatRoughness: 0.04,
    sheen: 1.0, sheenRoughness: 0.25,
    sheenColor: new THREE.Color(palette.color),
    transparent: true, opacity: 0.92,
    envMapIntensity: isRare ? 1.6 : 1.0,
  });
  return { mat, palette };
}

// ---------- 레벨 시스템 ----------
// 레벨별 cols×rows 꽉 찬 격자 (빈 자리 없이 딱 맞게)
const LEVEL_GRIDS: { cols: number; rows: number }[] = [
  { cols: 2, rows: 2 },   // Lv.1:  4개
  { cols: 3, rows: 2 },   // Lv.2:  6개
  { cols: 3, rows: 3 },   // Lv.3:  9개
  { cols: 4, rows: 3 },   // Lv.4: 12개
  { cols: 4, rows: 4 },   // Lv.5: 16개
  { cols: 5, rows: 4 },   // Lv.6: 20개
  { cols: 5, rows: 5 },   // Lv.7: 25개
  { cols: 5, rows: 6 },   // Lv.8: 30개
  { cols: 6, rows: 7 },   // Lv.9: 42개
  { cols: 6, rows: 9 },   // Lv.10: 54개
];

function levelGrid() {
  return LEVEL_GRIDS[Math.min(level - 1, LEVEL_GRIDS.length - 1)];
}
function levelScale(): number {
  return Math.max(0.45, 1.4 - (level - 1) * 0.1);
}
function updateLevelHud() {
  levelNumEl.textContent = String(level);
  immersionLevelNumEl.textContent = String(level);
}

function clearBubbles() {
  for (const b of bubbles) scene.remove(b.mesh);
  bubbles.length = 0;
}

// ---- 명상: 격자 (수직수평, 가만히, 꽉 참) ----
function buildMeditationGrid() {
  clearBubbles();
  const { cols, rows } = levelGrid();
  const ls = levelScale();
  const gap = GAP;
  const offsetX = -((cols - 1) * gap) / 2;
  const offsetY = -((rows - 1) * gap) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isRare = Math.random() < 0.06;
      const { mat, palette } = makeBubbleMaterial(isRare);
      const mesh = new THREE.Mesh(bubbleGeo, mat);
      mesh.position.set(offsetX + c * gap, offsetY + r * gap, 0);
      mesh.scale.setScalar(((isRare ? 1.1 : 0.95) + Math.random() * 0.08) * ls);
      scene.add(mesh);
      bubbles.push({
        mesh, popped: false, basePos: mesh.position.clone(),
        color: palette.color, emissive: palette.emissive,
        floatPhase: Math.random() * Math.PI * 2, rare: isRare,
      });
    }
  }
  gridStartTime = performance.now();
  updateRemaining();
  fitCameraToContent(0.6);
}

// ---- 몰입: 자유 배치 (랜덤, 움직임, 꽉 찬 개수) ----
function buildImmersionGrid() {
  clearBubbles();
  const { cols, rows } = levelGrid();
  const count = cols * rows;
  const ls = levelScale();
  const spread = 1.5 + Math.sqrt(count) * 0.7;
  for (let i = 0; i < count; i++) {
    const isRare = Math.random() < 0.08;
    const { mat, palette } = makeBubbleMaterial(isRare);
    const mesh = new THREE.Mesh(bubbleGeo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * 1.5,
    );
    mesh.scale.setScalar(((isRare ? 1.1 : 0.9) + Math.random() * 0.15) * ls);
    scene.add(mesh);
    bubbles.push({
      mesh, popped: false, basePos: mesh.position.clone(),
      color: palette.color, emissive: palette.emissive,
      floatPhase: Math.random() * Math.PI * 2, rare: isRare,
    });
  }
  gridStartTime = performance.now();
  updateRemaining();
  fitCameraToContent(1.2);
}

// ---- 스트레스: 글자별 큰 버블 + HTML 오버레이 글자 ----
const STRESS_COLORS = [
  "#E8364F", "#6C3CE9", "#E86A10", "#0EA38E", "#D63384", "#4338CA",
];

const stressLabels: HTMLElement[] = [];

function clearStressLabels() {
  stressLabels.forEach((el) => el.remove());
  stressLabels.length = 0;
}

function buildStressBubbles(text: string) {
  clearBubbles();
  clearStressLabels();
  const chars = [...text];
  const count = chars.length;

  // 5자 이하: 1줄, 6자 이상: 2줄
  let charRows: string[][];
  let bubbleSize: number;

  if (count <= 5) {
    charRows = [chars];
    bubbleSize = Math.max(1.5, 2.8 - count * 0.2);
  } else {
    const row1Len = Math.ceil(count / 2);
    charRows = [chars.slice(0, row1Len), chars.slice(row1Len)];
    bubbleSize = Math.max(1.2, 2.4 - count * 0.12);
  }

  const spacing = bubbleSize * 1.5;
  const rowGap = bubbleSize * 2.2;
  let globalIdx = 0;

  charRows.forEach((rowChars, rowIdx) => {
    const startX = -(rowChars.length - 1) * spacing / 2;
    const y = (charRows.length - 1) * rowGap / 2 - rowIdx * rowGap;

    rowChars.forEach((char, colIdx) => {
      const hexColor = STRESS_COLORS[globalIdx % STRESS_COLORS.length];
      const color = new THREE.Color(hexColor);
      const { mat } = makeBubbleMaterial(false);
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = 0.25;
      mat.transmission = 0.15;
      mat.opacity = 0.95;
      const mesh = new THREE.Mesh(bubbleGeo, mat);
      mesh.position.set(startX + colIdx * spacing, y, 0);
      mesh.scale.setScalar(bubbleSize);
      scene.add(mesh);
      bubbles.push({
        mesh, popped: false, basePos: mesh.position.clone(),
        color: color.getHex(), emissive: color.getHex(),
        floatPhase: Math.random() * Math.PI * 2, rare: false,
      });

      const label = document.createElement("div");
      label.className = "stress-char";
      label.textContent = char;
      label.style.color = "#fff";
      label.dataset.index = String(globalIdx);
      document.getElementById("app")!.appendChild(label);
      stressLabels.push(label);
      globalIdx++;
    });
  });
  gridStartTime = performance.now();
  updateRemaining();
  fitCameraToContent(0.8);
}

function updateStressLabelPositions() {
  for (let i = 0; i < stressLabels.length; i++) {
    const b = bubbles[i];
    if (!b || b.popped) {
      stressLabels[i].style.display = "none";
      continue;
    }
    const pos = b.mesh.position.clone().project(camera);
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    stressLabels[i].style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    stressLabels[i].style.display = "";
  }
}

// 히어로용 데코 버블 (대중소 랜덤 배치)
const decoBubbles: THREE.Mesh[] = [];
function buildDecoBubbles() {
  for (const m of decoBubbles) scene.remove(m);
  decoBubbles.length = 0;
  const count = 20;
  for (let i = 0; i < count; i++) {
    const isRare = Math.random() < 0.08;
    const { mat } = makeBubbleMaterial(isRare);
    mat.opacity = 0.45;
    const mesh = new THREE.Mesh(bubbleGeo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 2,
    );
    const sizes = [0.4, 0.6, 0.8, 1.0, 1.2];
    mesh.scale.setScalar(sizes[Math.floor(Math.random() * sizes.length)]);
    mesh.userData.floatPhase = Math.random() * Math.PI * 2;
    scene.add(mesh);
    decoBubbles.push(mesh);
  }
}

function clearDecoBubbles() {
  for (const m of decoBubbles) scene.remove(m);
  decoBubbles.length = 0;
}

// ---------- 3. 도파민 폭발 시스템 ----------
type Shard = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; spin: THREE.Vector3; startScale: number };
const shards: Shard[] = [];
const shardGeos = [
  new THREE.IcosahedronGeometry(0.08, 0), new THREE.TetrahedronGeometry(0.1, 0),
  new THREE.SphereGeometry(0.07, 8, 8), new THREE.OctahedronGeometry(0.09, 0),
];
type Flash = { mesh: THREE.Mesh; life: number; maxScale: number; decay: number };
const flashes: Flash[] = [];
const ringGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 32);

function spawnExplosion(pos: THREE.Vector3, color: number, emissive: number, isRare: boolean) {
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pos); ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  flashes.push({ mesh: ring, life: 1, maxScale: isRare ? 6.5 : 4.5, decay: 0.1 });
  if (isRare) {
    const r2m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const r2 = new THREE.Mesh(ringGeo, r2m);
    r2.position.copy(pos); r2.rotation.x = Math.PI / 2;
    scene.add(r2);
    flashes.push({ mesh: r2, life: 1, maxScale: 9, decay: 0.08 });
  }
  const count = isRare ? 30 : 16;
  const boost = isRare ? 1.4 : 1.0;
  for (let i = 0; i < count; i++) {
    const geo = shardGeos[i % shardGeos.length];
    const c = (Math.random() < (isRare ? 0.5 : 0.3)) ? 0xffffff : (Math.random() < 0.5 ? color : emissive);
    const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    const ss = (0.6 + Math.random() * 0.8) * (isRare ? 1.2 : 1);
    m.scale.setScalar(ss); scene.add(m);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta) + 0.2, Math.cos(phi) * 0.4);
    shards.push({ mesh: m, velocity: dir.multiplyScalar((0.1 + Math.random() * 0.12) * boost), life: 1,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.3), startScale: ss });
  }
  triggerScreenFlash(isRare ? 0xffd66b : color);
}

const flashOverlay = document.createElement("div");
flashOverlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity 280ms cubic-bezier(0.32,0.72,0,1);mix-blend-mode:screen;";
document.body.appendChild(flashOverlay);
function triggerScreenFlash(color: number) {
  const hex = "#" + color.toString(16).padStart(6, "0");
  flashOverlay.style.background = `radial-gradient(circle at center, ${hex}66 0%, transparent 60%)`;
  flashOverlay.style.opacity = "1";
  requestAnimationFrame(() => { flashOverlay.style.opacity = "0"; });
}

function spawnMegaExplosion(pos: THREE.Vector3, color: number, emissive: number) {
  for (let r = 0; r < 3; r++) {
    const c = r === 0 ? color : (r === 1 ? 0xFFD700 : 0xffffff);
    const ringMat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    scene.add(ring);
    flashes.push({ mesh: ring, life: 1, maxScale: 8 + r * 4, decay: 0.06 });
  }
  for (let i = 0; i < 40; i++) {
    const geo = shardGeos[i % shardGeos.length];
    const c = Math.random() < 0.3 ? 0xffffff : (Math.random() < 0.3 ? 0xFFD700 : (Math.random() < 0.5 ? color : emissive));
    const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    const ss = 0.8 + Math.random() * 1.2;
    m.scale.setScalar(ss);
    scene.add(m);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta) + 0.3, Math.cos(phi) * 0.5);
    shards.push({ mesh: m, velocity: dir.multiplyScalar(0.15 + Math.random() * 0.2), life: 1,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.4), startScale: ss });
  }
  triggerScreenFlash(0xFFD700);
  setTimeout(() => triggerScreenFlash(0xFF5A8A), 80);
}

function spawnMasterCelebration() {
  const center = new THREE.Vector3(camera.position.x, camera.position.y, 0);
  const offsets = [
    new THREE.Vector3(-2, 1, 0), new THREE.Vector3(2, 1, 0),
    new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(-1, 2, 0),
    new THREE.Vector3(1, -2, 0),
  ];
  for (const off of offsets) {
    const pos = center.clone().add(off);
    spawnMegaExplosion(pos, 0xFFD700, 0xFF5A8A);
  }
  shakeScreen(16, 800);
  triggerScreenFlash(0xFFD700);
  setTimeout(() => triggerScreenFlash(0xFF5A8A), 150);
  setTimeout(() => triggerScreenFlash(0x5A6FFF), 300);
  hapticMega();
}

function shakeScreen(intensity = 10, duration = 400) {
  const start = performance.now();
  function shake() {
    const elapsed = performance.now() - start;
    if (elapsed > duration) { canvas.style.transform = ""; return; }
    const progress = 1 - elapsed / duration;
    const x = (Math.random() - 0.5) * 2 * intensity * progress;
    const y = (Math.random() - 0.5) * 2 * intensity * progress;
    canvas.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(shake);
  }
  shake();
}

function popBass(color: number) {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ctx = audioCtx;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = "sine"; o1.frequency.value = 80;
  o1.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
  o1.connect(g1).connect(ctx.destination);
  g1.gain.value = 0; g1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  o1.start(); o1.stop(ctx.currentTime + 0.6);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = "square"; o2.frequency.value = 200;
  o2.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3);
  o2.connect(g2).connect(ctx.destination);
  g2.gain.value = 0; g2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.005);
  g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  o2.start(); o2.stop(ctx.currentTime + 0.4);
  pop(color);
}

function hapticMega() { if (navigator.vibrate) navigator.vibrate([20, 30, 20, 30, 40]); }

// ---------- 4. 사운드 ----------
let audioCtx: AudioContext | null = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  const buf = audioCtx.createBuffer(1, 1, 22050);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start(0);
}
document.addEventListener("touchstart", ensureAudio, { once: true });
document.addEventListener("pointerdown", ensureAudio, { once: true });
function pop(color: number) {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ctx = audioCtx;
  const r = ((color >> 16) & 0xff) / 255, g = ((color >> 8) & 0xff) / 255, b = (color & 0xff) / 255;
  const base = 320 + (r * 0.3 + g * 0.5 + b * 0.2) * 380;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = "sine"; o1.connect(g1).connect(ctx.destination);
  o1.frequency.value = base; o1.frequency.exponentialRampToValueAtTime(base * 0.45, ctx.currentTime + 0.18);
  g1.gain.value = 0; g1.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.005);
  g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
  o1.start(); o1.stop(ctx.currentTime + 0.25);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = "triangle"; o2.connect(g2).connect(ctx.destination);
  o2.frequency.value = base * 1.5; g2.gain.value = 0;
  g2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
  o2.start(); o2.stop(ctx.currentTime + 0.3);
}
function hapticPop() { if (navigator.vibrate) navigator.vibrate([8, 20, 12]); }

// ---------- 5. 인터랙션 ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function bumpCombo() {
  const now = performance.now();
  comboCount = (now - lastPopTime < COMBO_WINDOW) ? Math.min(comboCount + 1, 99) : 1;
  lastPopTime = now;
  if (comboCount >= 2) {
    comboValueEl.textContent = String(comboCount);
    comboEl.setAttribute("data-show", "true");
    comboEl.setAttribute("data-pulse", "true");
    requestAnimationFrame(() => comboEl.setAttribute("data-pulse", "false"));
  }
  if (comboHideTimer) window.clearTimeout(comboHideTimer);
  comboHideTimer = window.setTimeout(() => { comboEl.setAttribute("data-show", "false"); comboCount = 0; }, COMBO_WINDOW + 200);
}

function updateRemaining() {
  const left = bubbles.filter((b) => !b.popped).length;
  remainingCountEl.textContent = String(left);
  immersionRemainingEl.textContent = String(left);
}

function showToast(el: HTMLElement, textEl: HTMLElement, msg: string, ms = 1400) {
  textEl.textContent = msg;
  el.setAttribute("data-show", "true");
  setTimeout(() => el.setAttribute("data-show", "false"), ms);
}

function refreshCounters() {
  todayCountEl.textContent = getTodayCount().toLocaleString();
  monthCountEl.textContent = getMonthCount().toLocaleString();
  monthLabelEl.textContent = currentMonthLabel();
}

function tryPopAt(clientX: number, clientY: number) {
  if (!playing || resultEl.getAttribute("data-show") === "true") return;
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const meshes = bubbles.filter((b) => !b.popped).map((b) => b.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return;
  const hitMesh = hits[0].object as THREE.Mesh;
  const bubble = bubbles.find((b) => b.mesh === hitMesh);
  if (!bubble || bubble.popped) return;
  bubble.popped = true;
  const isStressPop = mode === "stress";
  const allPopped = bubbles.every(b => b.popped);

  if (isStressPop) {
    spawnMegaExplosion(bubble.mesh.position, bubble.color, bubble.emissive);
    popBass(bubble.color);
    hapticMega();
    shakeScreen(allPopped ? 14 : 8, allPopped ? 500 : 300);
    const idx = bubbles.indexOf(bubble);
    if (idx >= 0 && stressLabels[idx]) {
      stressLabels[idx].classList.add("is-final-pop");
    }
  } else {
    spawnExplosion(bubble.mesh.position, bubble.color, bubble.emissive, bubble.rare);
    pop(bubble.color);
    hapticPop();
  }
  bumpCombo();
  sessionCount += 1;
  addPops(1);
  refreshCounters();
  updateRemaining();

  const ms = checkMilestone();
  if (ms) showToast(praiseToastEl, praiseTextEl, milestonePraise(ms), 2200);

  const mat = bubble.mesh.material as THREE.MeshPhysicalMaterial;
  const fadeStart = performance.now();
  const fade = () => {
    const t = (performance.now() - fadeStart) / 200;
    mat.opacity = Math.max(0, 0.85 * (1 - t));
    bubble.mesh.scale.multiplyScalar(1 + 0.012);
    if (t < 1) requestAnimationFrame(fade);
    else scene.remove(bubble.mesh);
  };
  fade();

  if (allPopped) {
    gridClears += 1;

    // 올클리어 체크 — 스트레스 제외, 레벨 10 이상이면 무조건 여기서 끝
    if (mode !== "stress" && level >= 10) {
      spawnMasterCelebration();
      const msg = mode === "meditation" ? "모든 레벨 클리어!" : "시간 안에 올클리어!";
      showToast(clearToastEl, clearTextEl, msg, 2500);
      playing = false;
      setTimeout(() => endSession(), 1800);
      return;
    }

    if (mode === "stress") {
      stressLabelEl.classList.add("is-exploding");
      setTimeout(() => {
        stressLabelEl.setAttribute("hidden", "");
        stressLabelEl.classList.remove("is-exploding");
        endSession();
      }, 900);
    } else {
      level += 1;
      updateLevelHud();
      showToast(clearToastEl, clearTextEl, levelUpPraise(level, mode), 1400);
      if (mode === "immersion") {
        immersionRemaining += IMMERSION_BONUS_MS;
        immersionBonusEl.textContent = `+${IMMERSION_BONUS_MS / 1000}`;
        immersionBonusEl.setAttribute("data-show", "true");
        setTimeout(() => immersionBonusEl.setAttribute("data-show", "false"), 800);
        setTimeout(() => buildImmersionGrid(), 600);
      } else {
        setTimeout(() => buildMeditationGrid(), 600);
      }
    }
  }
}

let dragging = false;
canvas.addEventListener("pointerdown", (e) => { dragging = true; tryPopAt(e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => { if (dragging) tryPopAt(e.clientX, e.clientY); });
canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });
canvas.addEventListener("pointerleave", () => { dragging = false; });

// ---------- 6. 모드 흐름 ----------
function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function startMode(m: Mode) {
  mode = m;
  level = 1;
  sessionCount = 0;
  gridClears = 0;
  playing = true;
  clearDecoBubbles();
  sessionStartTime = performance.now();
  hero.classList.add("is-hidden");
  resultEl.setAttribute("data-show", "false");
  resultEl.setAttribute("hidden", "");
  hudBrand.setAttribute("hidden", "");
  hudTodayCounter.removeAttribute("hidden");
  btnStop.removeAttribute("hidden");
  gameInfoHud.removeAttribute("hidden");
  monthInfo.setAttribute("hidden", "");
  refreshCounters();

  updateLevelHud();

  stressLabelEl.setAttribute("hidden", "");

  if (m === "immersion") {
    gameInfoHud.setAttribute("hidden", "");
    immersionRemaining = IMMERSION_START_MS;
    immersionLastTick = performance.now();
    immersionHud.removeAttribute("hidden");
    immersionTimerEl.textContent = formatTime(IMMERSION_START_MS);
    buildImmersionGrid();
  } else if (m === "stress") {
    immersionHud.setAttribute("hidden", "");
    buildStressBubbles(stressName);
  } else {
    immersionHud.setAttribute("hidden", "");
    buildMeditationGrid();
  }
}

function endSession() {
  playing = false;
  btnStop.setAttribute("hidden", "");
  hudBrand.setAttribute("hidden", "");
  immersionHud.setAttribute("hidden", "");
  gameInfoHud.setAttribute("hidden", "");
  clearStressLabels();

  const elapsed = performance.now() - sessionStartTime;
  let title: string;
  let praise: string;
  let summary: string;

  stressLabelEl.setAttribute("hidden", "");

  if (mode === "stress") {
    title = "다 뿌셨어요!";
    praise = stressPraise(stressName);
    summary = `${Math.floor(elapsed / 1000)}초 만에 부숨`;
    resultStressWord.textContent = `"${stressName}"`;
    resultStressWord.removeAttribute("hidden");
    resultCountWrap.setAttribute("hidden", "");
  } else {
    resultStressWord.setAttribute("hidden", "");
    resultCountWrap.removeAttribute("hidden");
    if (mode === "immersion") {
      title = level >= 10 ? "몰입 마스터 달성!" : `${formatElapsed(elapsed)} 동안 몰입!`;
      praise = level >= 10 ? `${formatElapsed(elapsed)} 만에 올클리어!\n완벽한 집중력이었어요.` : pickResultPraise();
      summary = `레벨 ${level} · ${gridClears}판 클리어`;
    } else {
      title = level >= 10 ? "뽁뽁 마스터 달성!" : "시원하게 비웠어요";
      praise = level >= 10 ? "10단계 전부 클리어!\n오늘 스트레스, 완전히 날려버렸어요." : pickResultPraise();
      summary = `레벨 ${level} · ${formatElapsed(elapsed)} 동안 뽁뽁`;
    }
  }

  resultTitle.textContent = title;
  resultCount.textContent = sessionCount.toLocaleString();
  resultPraise.textContent = praise;
  resultSummary.textContent = summary;

  if (mode === "meditation") btnOther.textContent = "스트레스 터뜨리기";
  else if (mode === "immersion") btnOther.textContent = "명상 모드로 쉬기";
  else btnOther.textContent = "명상 모드 해보기";

  // 레벨 2~9이면 초기화 버튼 표시 (올클리어 시 "한 번 더"가 이미 Lv.1부터이므로 숨김)
  if (level > 1 && level < 10 && mode !== "stress") {
    btnResetLevel.removeAttribute("hidden");
  } else {
    btnResetLevel.setAttribute("hidden", "");
  }

  resultEl.removeAttribute("hidden");
  requestAnimationFrame(() => resultEl.setAttribute("data-show", "true"));
}

// 그만하기 — 실수 방지: 확인 모달 대신 우상단 배치 (뽁뽁이 영역과 분리)
btnStop.addEventListener("click", () => { if (playing) endSession(); });

btnMeditation.addEventListener("click", () => startMode("meditation"));
btnImmersion.addEventListener("click", () => startMode("immersion"));

// 스트레스 터뜨리기 — 입력 모달
btnStress.addEventListener("click", () => {
  hero.classList.add("is-hidden");
  stressTextField.value = "";
  stressInputEl.removeAttribute("hidden");
  requestAnimationFrame(() => {
    stressInputEl.setAttribute("data-show", "true");
    stressTextField.focus();
  });
});
btnStressGo.addEventListener("click", () => {
  const text = stressTextField.value.trim();
  if (!text) { stressTextField.focus(); return; }
  stressName = text;
  stressInputEl.setAttribute("data-show", "false");
  setTimeout(() => { stressInputEl.setAttribute("hidden", ""); startMode("stress"); }, 300);
});
stressTextField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnStressGo.click();
});
btnStressBack.addEventListener("click", () => {
  stressInputEl.setAttribute("data-show", "false");
  setTimeout(() => { stressInputEl.setAttribute("hidden", ""); hero.classList.remove("is-hidden"); }, 300);
});
btnReplay.addEventListener("click", () => startMode(mode));
btnResetLevel.addEventListener("click", () => {
  level = 1;
  startMode(mode);
});
btnHome.addEventListener("click", () => {
  resultEl.setAttribute("data-show", "false");
  setTimeout(() => {
    resultEl.setAttribute("hidden", "");
    for (const b of bubbles) scene.remove(b.mesh);
    bubbles.length = 0;
    camera.position.set(0, 0, camera.position.z);
    fitCamera();
    buildDecoBubbles();
    hero.classList.remove("is-hidden");
    hudTodayCounter.setAttribute("hidden", "");
    hudBrand.removeAttribute("hidden");
    updateHeroGreeting();
  }, 300);
});
btnOther.addEventListener("click", () => {
  if (mode === "meditation") {
    // 스트레스 입력 모달 열기
    resultEl.setAttribute("data-show", "false");
    setTimeout(() => {
      resultEl.setAttribute("hidden", "");
      stressTextField.value = "";
      stressInputEl.removeAttribute("hidden");
      requestAnimationFrame(() => {
        stressInputEl.setAttribute("data-show", "true");
        stressTextField.focus();
      });
    }, 300);
  } else {
    startMode("meditation");
  }
});
btnShare.addEventListener("click", async () => {
  try {
    const blob = await buildShareCard({
      title: "오늘뽁",
      score: sessionCount,
      subtitle: resultPraise.textContent ?? "",
      patternName: mode === "stress" ? stressName : undefined,
    });
    await shareOrDownload(blob, "todapop.png", "오늘뽁", `${sessionCount}개의 스트레스를 터뜨렸어요!`);
  } catch (err) { console.error("share failed", err); }
});

// 오늘 카운터 홈에서 숨기기 / 월간 i 버튼
const hudTodayCounter = document.getElementById("hudTodayCounter")!;
const btnMonthInfo = document.getElementById("btnMonthInfo")!;
hudTodayCounter.setAttribute("hidden", "");
hudBrand.removeAttribute("hidden");
const monthTooltip = document.getElementById("monthTooltip")!;
btnMonthInfo.addEventListener("click", () => {
  monthTooltip.setAttribute("data-show", "true");
  setTimeout(() => monthTooltip.setAttribute("data-show", "false"), 2000);
});

// 개인정보처리방침 오버레이
const privacyOverlay = document.getElementById("privacyOverlay")!;
const btnPrivacy = document.getElementById("btnPrivacy")!;
const btnPrivacyClose = document.getElementById("btnPrivacyClose")!;
btnPrivacy.addEventListener("click", (e) => {
  e.preventDefault();
  privacyOverlay.removeAttribute("hidden");
  requestAnimationFrame(() => privacyOverlay.setAttribute("data-show", "true"));
});
btnPrivacyClose.addEventListener("click", () => {
  privacyOverlay.setAttribute("data-show", "false");
  setTimeout(() => privacyOverlay.setAttribute("hidden", ""), 280);
});


// 감성 인사 (A안 전용)
const heroGreeting = document.getElementById("heroGreeting")!;
const heroTodayNum = document.getElementById("heroTodayNum")!;

const GREETINGS_F: Record<string, string> = {
  dawn: "아직 안 잔거야? 좀 쉬어",
  earlyMorning: "좋은 아침! 한 판 하고 가",
  morning: "잠깐 쉬어가, 한 판 어때?",
  lunch: "점심 먹었어? 밥 잘 챙겨먹어!",
  afternoon: "거의 다 왔어, 여기 두고 가",
  evening: "고생했어, 스트레스 털고 가자",
  night: "수고했어, 다 터뜨리고 자",
};


function getTimeSlot(): string {
  const h = new Date().getHours();
  if (h < 6) return "dawn";
  if (h < 9) return "earlyMorning";
  if (h < 12) return "morning";
  if (h < 14) return "lunch";
  if (h < 18) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function updateHeroGreeting() {
  const slot = getTimeSlot();
  heroGreeting.textContent = GREETINGS_F[slot];
  heroTodayNum.textContent = getTodayCount().toLocaleString();
}
updateHeroGreeting();

// 초기 표시
monthLabelEl.textContent = currentMonthLabel();
refreshCounters();

monthInfoText.textContent = `${currentMonthLabel()} 기록은 매달 1일에 새로 시작돼요`;

// ---------- 7. 리사이즈 ----------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (playing && bubbles.length > 0) {
    fitCameraToContent(mode === "immersion" ? 1.2 : 0.6);
  } else {
    fitCamera();
  }
});

// ---------- 8. 애니메이션 루프 ----------
fitCamera();
buildDecoBubbles();

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  // 모드별 버블 움직임
  const immBounds = (mode === "immersion" && playing) ? getVisibleBounds() : null;
  for (const b of bubbles) {
    if (b.popped) continue;
    if (mode === "immersion" && playing && immBounds) {
      const mult = 1 + (level - 1) * 0.18;
      b.mesh.position.y = b.basePos.y + Math.sin(t * 1.8 * mult + b.floatPhase) * 0.15 * mult;
      b.mesh.position.x = b.basePos.x + Math.cos(t * 1.3 * mult + b.floatPhase) * 0.12 * mult;
      b.mesh.position.z = b.basePos.z + Math.sin(t * 0.9 * mult + b.floatPhase * 2) * 0.08 * mult;
      b.mesh.rotation.y = t * 0.15 + b.floatPhase;
      const r = b.mesh.scale.x * 0.55 * 0.5;
      b.mesh.position.x = Math.max(-immBounds.halfW + r, Math.min(immBounds.halfW - r, b.mesh.position.x));
      b.mesh.position.y = Math.max(-immBounds.halfH + r, Math.min(immBounds.halfH - r, b.mesh.position.y));
    } else if (mode === "stress") {
      b.mesh.position.y = b.basePos.y + Math.abs(Math.sin(t * 1.5 + b.floatPhase)) * 0.15;
      b.mesh.position.x = b.basePos.x + Math.sin(t * 0.6 + b.floatPhase) * 0.06;
      b.mesh.rotation.y = 0;
    } else {
      b.mesh.rotation.y = 0;
    }
  }

  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.life -= f.decay;
    f.mesh.scale.setScalar(0.1 + (1 - f.life) * f.maxScale);
    (f.mesh.material as THREE.MeshBasicMaterial).opacity = f.life;
    if (f.life <= 0) { scene.remove(f.mesh); flashes.splice(i, 1); }
  }
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.mesh.position.add(s.velocity);
    s.velocity.multiplyScalar(0.96); s.velocity.y -= 0.004;
    s.mesh.rotation.x += s.spin.x; s.mesh.rotation.y += s.spin.y; s.mesh.rotation.z += s.spin.z;
    s.life -= 0.04;
    const pulse = s.life > 0.7 ? s.startScale * (1 + (1 - s.life) * 0.6) : s.startScale * s.life * 1.4;
    s.mesh.scale.setScalar(Math.max(0.01, pulse));
    (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life);
    if (s.life <= 0) { scene.remove(s.mesh); shards.splice(i, 1); }
  }

  if (mode === "immersion" && playing) {
    const now = performance.now();
    immersionRemaining -= (now - immersionLastTick);
    immersionLastTick = now;
    immersionTimerEl.textContent = formatTime(immersionRemaining);
    if (immersionRemaining <= 0) {
      playing = false;
      immersionTimerEl.textContent = "0:00";
      showToast(clearToastEl, clearTextEl, "시간 종료!", 1200);
      setTimeout(() => endSession(), 800);
    }
  }

  // 스트레스 라벨 위치 동기화
  if (mode === "stress" && playing) updateStressLabelPositions();

  // 데코 버블 느긋한 플로팅
  for (const d of decoBubbles) {
    const p = d.userData.floatPhase as number;
    d.position.y += Math.sin(t * 0.3 + p) * 0.002;
    d.position.x += Math.cos(t * 0.2 + p) * 0.001;
    d.rotation.y = t * 0.1 + p;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
