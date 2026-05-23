import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  type Mode,
  getTodayCount,
  getMonthCount,
  addPops,
  checkMilestone,
  clearPraise,
  milestonePraise,
  pickResultPraise,
  stressPraise,
  currentMonthLabel,
  IMMERSION_START_MS,
  IMMERSION_BONUS_MS,
} from "./modes";
import { COLS, ROWS, type PatternMask, fullMask, textToMask } from "./patterns";
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
const stressLabelText = document.getElementById("stressLabelText")!;
const comboEl = document.getElementById("combo")!;
const comboValueEl = document.getElementById("comboValue")!;
const praiseToastEl = document.getElementById("praiseToast")!;
const praiseTextEl = document.getElementById("praiseText")!;
const clearToastEl = document.getElementById("clearToast")!;
const clearTextEl = document.getElementById("clearText")!;
const immersionHud = document.getElementById("immersionHud") as HTMLElement;
const immersionTimerEl = document.getElementById("immersionTimer")!;
const immersionBonusEl = document.getElementById("immersionBonus")!;
const hudBrand = document.getElementById("hudBrand") as HTMLElement;
const btnStop = document.getElementById("btnStop") as HTMLElement;
const gameInfoHud = document.getElementById("gameInfoHud") as HTMLElement;
const levelNumEl = document.getElementById("levelNum")!;
const remainingCountEl = document.getElementById("remainingCount")!;
const monthInfo = document.getElementById("monthInfo") as HTMLElement;
const monthInfoText = document.getElementById("monthInfoText")!;
const resultEl = document.getElementById("result")!;
const resultTitle = document.getElementById("resultTitle")!;
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

// 카메라를 그리드에 맞춰서 모든 버블이 화면 안에 보이게
function fitCamera() {
  const gridW = (COLS - 1) * GAP + GAP; // 허니콤 오프셋 포함
  const gridH = (ROWS - 1) * GAP;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const zForH = (gridH / 2 + 1.5) / Math.tan(vFov / 2);
  const zForW = (gridW / 2 + 1.5) / Math.tan(hFov / 2);
  camera.position.z = Math.max(zForH, zForW);
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

// 레벨별 버블 크기 (1=큰, 10=작은)
function levelScale(): number {
  return Math.max(0.45, 1.4 - (level - 1) * 0.1);
}

// 레벨별 버블 개수 (1=12개, 10=54개)
function levelMask(): PatternMask {
  const total = COLS * ROWS;
  const target = Math.round(12 + (level - 1) * (total - 12) / 9);
  const mask = fullMask();
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const toRemove = total - target;
  for (let i = 0; i < toRemove; i++) mask[indices[i]] = false;
  return mask;
}

function updateLevelHud() {
  levelNumEl.textContent = String(level);
}

function buildGrid(mask: PatternMask = fullMask()) {
  for (const b of bubbles) scene.remove(b.mesh);
  bubbles.length = 0;
  const offsetX = -((COLS - 1) * GAP) / 2;
  const offsetY = -((ROWS - 1) * GAP) / 2;
  const ls = levelScale();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!mask[i]) continue;
      const isRare = Math.random() < 0.08;
      const { mat, palette } = makeBubbleMaterial(isRare);
      const mesh = new THREE.Mesh(bubbleGeo, mat);
      const x = offsetX + c * GAP + (r % 2 === 0 ? 0 : GAP * 0.5);
      const y = offsetY + r * GAP;
      mesh.position.set(x, y, 0);
      mesh.scale.setScalar(((isRare ? 1.1 : 0.92) + Math.random() * 0.12) * ls);
      scene.add(mesh);
      bubbles.push({
        mesh, popped: false, basePos: mesh.position.clone(),
        color: palette.color, emissive: palette.emissive,
        floatPhase: Math.random() * Math.PI * 2, rare: isRare,
      });
    }
  }
  gridStartTime = performance.now();
  if (gameInfoHud) updateRemaining();
}

// 히어로용 데코 버블 (대중소 랜덤 배치)
const decoBubbles: THREE.Mesh[] = [];
function buildDecoBubbles() {
  for (const m of decoBubbles) scene.remove(m);
  decoBubbles.length = 0;
  const count = 25;
  for (let i = 0; i < count; i++) {
    const isRare = Math.random() < 0.1;
    const { mat } = makeBubbleMaterial(isRare);
    const mesh = new THREE.Mesh(bubbleGeo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 2,
    );
    const sizes = [0.4, 0.6, 0.8, 1.0, 1.3, 1.6];
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
  flashes.push({ mesh: ring, life: 1, maxScale: isRare ? 6.5 : 4.5, decay: 0.05 });
  if (isRare) {
    const r2m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const r2 = new THREE.Mesh(ringGeo, r2m);
    r2.position.copy(pos); r2.rotation.x = Math.PI / 2;
    scene.add(r2);
    flashes.push({ mesh: r2, life: 1, maxScale: 9, decay: 0.04 });
  }
  const count = isRare ? 50 : 30;
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

// ---------- 4. 사운드 ----------
let audioCtx: AudioContext | null = null;
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
  spawnExplosion(bubble.mesh.position, bubble.color, bubble.emissive, bubble.rare);
  pop(bubble.color);
  hapticPop();
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

  if (bubbles.every((b) => b.popped)) {
    gridClears += 1;
    const gridTime = (performance.now() - gridStartTime) / 1000;
    showToast(clearToastEl, clearTextEl, clearPraise(gridTime), 1200);

    if (mode === "stress") {
      // 스트레스 단어 폭발 → 사라짐
      stressLabelEl.classList.add("is-exploding");
      setTimeout(() => {
        stressLabelEl.setAttribute("hidden", "");
        stressLabelEl.classList.remove("is-exploding");
        endSession();
      }, 700);
    } else {
      // 레벨업 (명상·몰입 공통)
      level = Math.min(level + 1, 10);
      updateLevelHud();
      showToast(praiseToastEl, praiseTextEl, `Lv.${level} 돌입!`, 1200);
      if (mode === "immersion") {
        immersionRemaining += IMMERSION_BONUS_MS;
        immersionBonusEl.textContent = `+${IMMERSION_BONUS_MS / 1000}`;
        immersionBonusEl.setAttribute("data-show", "true");
        setTimeout(() => immersionBonusEl.setAttribute("data-show", "false"), 800);
      }
      // 명상·몰입: 자동으로 새 그리드 재생성
      setTimeout(() => buildGrid(levelMask()), 600);
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
  btnStop.removeAttribute("hidden");
  gameInfoHud.removeAttribute("hidden");
  monthInfo.setAttribute("hidden", "");
  refreshCounters();

  updateLevelHud();

  if (m === "immersion") {
    immersionRemaining = IMMERSION_START_MS;
    immersionLastTick = performance.now();
    immersionHud.removeAttribute("hidden");
    immersionTimerEl.textContent = formatTime(IMMERSION_START_MS);
    stressLabelEl.setAttribute("hidden", "");
    buildGrid(levelMask());
  } else if (m === "stress") {
    immersionHud.setAttribute("hidden", "");
    stressLabelEl.removeAttribute("hidden");
    stressLabelText.textContent = stressName;
    buildGrid(textToMask(stressName));
  } else {
    immersionHud.setAttribute("hidden", "");
    stressLabelEl.setAttribute("hidden", "");
    buildGrid(levelMask());
  }
}

function endSession() {
  playing = false;
  btnStop.setAttribute("hidden", "");
  hudBrand.removeAttribute("hidden");
  immersionHud.setAttribute("hidden", "");
  gameInfoHud.setAttribute("hidden", "");

  const elapsed = performance.now() - sessionStartTime;
  let title: string;
  let praise: string;
  let summary: string;

  stressLabelEl.setAttribute("hidden", "");

  if (mode === "stress") {
    title = `"${stressName}" 다 뿌셨어요!`;
    praise = stressPraise(stressName);
    summary = `${Math.floor(elapsed / 1000)}초 만에 부숨`;
  } else if (mode === "immersion") {
    title = `${formatElapsed(elapsed)} 동안 몰입!`;
    praise = pickResultPraise();
    summary = `레벨 ${level} · 그리드 ${gridClears}번 클리어`;
  } else {
    title = "시원하게 비웠어요";
    praise = pickResultPraise();
    summary = `레벨 ${level} · ${formatElapsed(elapsed)} 동안 뽁뽁`;
  }

  resultTitle.textContent = title;
  resultCount.textContent = sessionCount.toLocaleString();
  resultPraise.textContent = praise;
  resultSummary.textContent = summary;

  if (mode === "meditation") btnOther.textContent = "스트레스 터뜨리기";
  else if (mode === "immersion") btnOther.textContent = "명상 모드로 쉬기";
  else btnOther.textContent = "명상 모드 해보기";

  // 레벨 2 이상이면 초기화 버튼 표시
  if (level > 1 && mode !== "stress") {
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
    buildDecoBubbles();
    hero.classList.remove("is-hidden");
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

// 초기 표시
monthLabelEl.textContent = currentMonthLabel();
refreshCounters();

monthInfoText.textContent = `${currentMonthLabel()} 기록은 매달 1일에 새로 시작돼요`;

// ---------- 7. 리사이즈 ----------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  fitCamera();
});

// ---------- 8. 애니메이션 루프 ----------
fitCamera();
buildDecoBubbles();

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  // 레벨 + 모드에 따른 움직임 (몰입은 레벨 올라갈수록 더 활발)
  const isImmersion = mode === "immersion" && playing;
  const levelMult = isImmersion ? 1 + (level - 1) * 0.15 : 1;
  const floatAmp = (isImmersion ? 0.14 : 0.08) * levelMult;
  const floatSpeed = (isImmersion ? 2.0 : 1.2) * levelMult;
  const driftAmp = (isImmersion ? 0.08 : 0.04) * levelMult;
  const driftSpeed = (isImmersion ? 1.4 : 0.8) * levelMult;

  for (const b of bubbles) {
    if (b.popped) continue;
    b.mesh.position.y = b.basePos.y + Math.sin(t * floatSpeed + b.floatPhase) * floatAmp;
    b.mesh.position.x = b.basePos.x + Math.cos(t * driftSpeed + b.floatPhase) * driftAmp;
    b.mesh.rotation.y = t * 0.2 + b.floatPhase;
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
    s.life -= 0.018;
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
    if (immersionRemaining <= 0) endSession();
  }

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
