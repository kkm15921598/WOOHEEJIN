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
  dailyPraise,
  currentMonthLabel,
  IMMERSION_START_MS,
  IMMERSION_BONUS_MS,
} from "./modes";
import { COLS, ROWS, type PatternMask, fullMask, todayPattern, todayPatternName } from "./patterns";
import { buildShareCard, shareOrDownload } from "./share";
import { startMeditationMusic, startImmersionMusic, stopAll as stopMusic } from "./music";

// ---------- DOM ----------
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const todayCountEl = document.getElementById("todayCount")!;
const monthCountEl = document.getElementById("monthCount")!;
const monthLabelEl = document.getElementById("monthLabel")!;
const hero = document.getElementById("hero")!;
const heroPatternName = document.getElementById("heroPatternName")!;
const btnMeditation = document.getElementById("btnMeditation")!;
const btnImmersion = document.getElementById("btnImmersion")!;
const btnDaily = document.getElementById("btnDaily")!;
const comboEl = document.getElementById("combo")!;
const comboValueEl = document.getElementById("comboValue")!;
const praiseToastEl = document.getElementById("praiseToast")!;
const praiseTextEl = document.getElementById("praiseText")!;
const clearToastEl = document.getElementById("clearToast")!;
const clearTextEl = document.getElementById("clearText")!;
const immersionHud = document.getElementById("immersionHud") as HTMLElement;
const immersionTimerEl = document.getElementById("immersionTimer")!;
const immersionBonusEl = document.getElementById("immersionBonus")!;
const btnStop = document.getElementById("btnStop") as HTMLElement;
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
camera.position.set(0, 0, 12);

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

function buildGrid(mask: PatternMask = fullMask()) {
  for (const b of bubbles) scene.remove(b.mesh);
  bubbles.length = 0;
  const offsetX = -((COLS - 1) * GAP) / 2;
  const offsetY = -((ROWS - 1) * GAP) / 2;
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
      mesh.scale.setScalar((isRare ? 1.1 : 0.92) + Math.random() * 0.12);
      scene.add(mesh);
      bubbles.push({
        mesh, popped: false, basePos: mesh.position.clone(),
        color: palette.color, emissive: palette.emissive,
        floatPhase: Math.random() * Math.PI * 2, rare: isRare,
      });
    }
  }
  gridStartTime = performance.now();
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

    if (mode === "daily") {
      setTimeout(() => endSession(), 800);
    } else {
      if (mode === "immersion") {
        immersionRemaining += IMMERSION_BONUS_MS;
        immersionBonusEl.textContent = `+${IMMERSION_BONUS_MS / 1000}`;
        immersionBonusEl.setAttribute("data-show", "true");
        setTimeout(() => immersionBonusEl.setAttribute("data-show", "false"), 800);
      }
      // 명상·몰입: 자동으로 새 그리드 재생성
      setTimeout(() => buildGrid(fullMask()), 600);
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
  sessionCount = 0;
  gridClears = 0;
  playing = true;
  sessionStartTime = performance.now();
  hero.classList.add("is-hidden");
  resultEl.setAttribute("data-show", "false");
  resultEl.setAttribute("hidden", "");
  btnStop.removeAttribute("hidden");
  monthInfo.setAttribute("hidden", "");
  refreshCounters();

  if (m === "immersion") {
    immersionRemaining = IMMERSION_START_MS;
    immersionLastTick = performance.now();
    immersionHud.removeAttribute("hidden");
    immersionTimerEl.textContent = formatTime(IMMERSION_START_MS);
    startImmersionMusic();
    buildGrid(fullMask());
  } else if (m === "daily") {
    immersionHud.setAttribute("hidden", "");
    stopMusic();
    buildGrid(todayPattern().mask);
  } else {
    immersionHud.setAttribute("hidden", "");
    startMeditationMusic();
    buildGrid(fullMask());
  }
}

function endSession() {
  playing = false;
  btnStop.setAttribute("hidden", "");
  immersionHud.setAttribute("hidden", "");
  stopMusic();

  const elapsed = performance.now() - sessionStartTime;
  let title: string;
  let praise: string;
  let summary: string;

  if (mode === "daily") {
    title = `오늘의 ${todayPatternName()} 완성!`;
    praise = dailyPraise(todayPatternName());
    summary = `${Math.floor(elapsed / 1000)}초 만에 클리어`;
  } else if (mode === "immersion") {
    title = `${formatElapsed(elapsed)} 동안 몰입!`;
    praise = pickResultPraise();
    summary = `그리드 ${gridClears}번 클리어`;
  } else {
    title = "시원하게 비웠어요";
    praise = pickResultPraise();
    summary = `${formatElapsed(elapsed)} 동안 뽁뽁`;
  }

  resultTitle.textContent = title;
  resultCount.textContent = sessionCount.toLocaleString();
  resultPraise.textContent = praise;
  resultSummary.textContent = summary;

  if (mode === "meditation") btnOther.textContent = "몰입 모드 해보기";
  else if (mode === "immersion") btnOther.textContent = "명상 모드로 쉬기";
  else btnOther.textContent = "명상 모드 해보기";

  resultEl.removeAttribute("hidden");
  requestAnimationFrame(() => resultEl.setAttribute("data-show", "true"));
}

// 그만하기 — 실수 방지: 확인 모달 대신 우상단 배치 (뽁뽁이 영역과 분리)
btnStop.addEventListener("click", () => { if (playing) endSession(); });

btnMeditation.addEventListener("click", () => startMode("meditation"));
btnImmersion.addEventListener("click", () => startMode("immersion"));
btnDaily.addEventListener("click", () => startMode("daily"));
btnReplay.addEventListener("click", () => startMode(mode));
btnHome.addEventListener("click", () => {
  resultEl.setAttribute("data-show", "false");
  setTimeout(() => { resultEl.setAttribute("hidden", ""); hero.classList.remove("is-hidden"); }, 300);
});
btnOther.addEventListener("click", () => {
  if (mode === "meditation") startMode("immersion");
  else startMode("meditation");
});
btnShare.addEventListener("click", async () => {
  try {
    const blob = await buildShareCard({
      title: "오늘뽁",
      score: sessionCount,
      subtitle: resultPraise.textContent ?? "",
      patternName: mode === "daily" ? todayPatternName() : undefined,
    });
    await shareOrDownload(blob, "todapop.png", "오늘뽁", `${sessionCount}개의 스트레스를 터뜨렸어요!`);
  } catch (err) { console.error("share failed", err); }
});

// 초기 표시
heroPatternName.textContent = todayPatternName();
monthLabelEl.textContent = currentMonthLabel();
refreshCounters();

// 월간 안내
monthInfoText.textContent = `${currentMonthLabel()} 기록은 매달 1일에 새로 시작돼요`;

// ---------- 7. 리사이즈 ----------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- 8. 애니메이션 루프 ----------
buildGrid(fullMask());

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  // 몰입 모드: 버블 움직임 더 활발하게 (명상보다 amplitude·speed 2배)
  const isImmersion = mode === "immersion" && playing;
  const floatAmp = isImmersion ? 0.18 : 0.08;
  const floatSpeed = isImmersion ? 2.4 : 1.2;
  const driftAmp = isImmersion ? 0.10 : 0.04;
  const driftSpeed = isImmersion ? 1.6 : 0.8;

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

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
