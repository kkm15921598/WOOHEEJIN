import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { pickMessage } from "./messages";

// ---------- 0. 일일 카운트 (LocalStorage) ----------
// 데모/터널 환경에서는 무제한, 운영 도메인에서만 일일 5개 제한
const IS_DEMO =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.hostname.endsWith(".loca.lt") ||
  location.hostname.endsWith(".trycloudflare.com") ||
  new URLSearchParams(location.search).has("dev");
const DAILY_LIMIT = IS_DEMO ? Infinity : 5;
const TODAY_KEY = "sc.today";
const COUNT_KEY = "sc.count";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readCount(): number {
  if (localStorage.getItem(TODAY_KEY) !== todayStr()) {
    localStorage.setItem(TODAY_KEY, todayStr());
    localStorage.setItem(COUNT_KEY, "0");
  }
  return Number(localStorage.getItem(COUNT_KEY) ?? "0");
}
function increment() {
  const next = readCount() + 1;
  localStorage.setItem(COUNT_KEY, String(next));
  return next;
}

// ---------- 1. 씬 셋업 ----------
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const dailyEl = document.getElementById("daily")!;
const hintEl = document.getElementById("hint")!;
const messageEl = document.getElementById("message")!;
const messageText = document.getElementById("messageText")!;
const messageClose = document.getElementById("messageClose")!;

function refreshDaily() {
  if (!isFinite(DAILY_LIMIT)) {
    dailyEl.textContent = "∞";
    return;
  }
  const remaining = Math.max(0, DAILY_LIMIT - readCount());
  dailyEl.textContent = String(remaining);
}
refreshDaily();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();

// 환경맵: 이리데센스가 살아나려면 reflection이 필수
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

// 다크 스튜디오 라이팅 + 듀얼 림 (골드/마젠타)
scene.add(new THREE.AmbientLight(0x4030a0, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffd66b, 1.5);
rim.position.set(-4, -2, -3);
scene.add(rim);
const fill = new THREE.PointLight(0xe879f9, 1.4, 12);
fill.position.set(0, 0, 3);
scene.add(fill);
// 캡슐 뒤편 발광 (압력 빌드업 시 강해짐)
const corePulse = new THREE.PointLight(0xffd6f5, 0, 8);
corePulse.position.set(0, 0, -0.5);
scene.add(corePulse);

// ---------- 2. 캡슐: 다층 구조 (외각 투명 셸 + 내부 발광 코어 + 표면 디테일) ----------
const capsuleGroup = new THREE.Group();
capsuleGroup.rotation.z = Math.PI / 8;
scene.add(capsuleGroup);

// 2-a. 외각 셸 — 반투명 이리데센트 (안에 코어가 비쳐 보임)
const capsuleGeo = new THREE.CapsuleGeometry(0.95, 1.4, 32, 64);
const capsuleMat = new THREE.MeshPhysicalMaterial({
  color: 0xd4c5ff,
  metalness: 0.15,
  roughness: 0.05,
  emissive: 0x4a2d8a,
  emissiveIntensity: 0.15,
  transmission: 0.55, // 안 비치게 적당히
  thickness: 1.2,
  ior: 1.5,
  iridescence: 1.0,
  iridescenceIOR: 1.6,
  iridescenceThicknessRange: [200, 1400],
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  sheen: 1.0,
  sheenRoughness: 0.2,
  sheenColor: new THREE.Color(0xffd66b),
  transparent: true,
  opacity: 0.92,
  envMapIntensity: 1.8,
});
const capsule = new THREE.Mesh(capsuleGeo, capsuleMat);
capsuleGroup.add(capsule);

// 2-b. 내부 발광 코어 — 작고 강렬한 빛의 결정
const coreGeo = new THREE.IcosahedronGeometry(0.42, 1);
const coreMat = new THREE.MeshStandardMaterial({
  color: 0xffd6f5,
  emissive: 0xff9af5,
  emissiveIntensity: 1.8,
  metalness: 0.0,
  roughness: 0.0,
});
const core = new THREE.Mesh(coreGeo, coreMat);
capsuleGroup.add(core);

// 2-c. 코어 주변 글로우 (additive 구체)
const coreGlowGeo = new THREE.SphereGeometry(0.65, 32, 32);
const coreGlowMat = new THREE.MeshBasicMaterial({
  color: 0xff9af5,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const coreGlow = new THREE.Mesh(coreGlowGeo, coreGlowMat);
capsuleGroup.add(coreGlow);

// 2-d. 캡슐 표면 디테일 — 위/아래 메탈 캡 + 적도 라인
const capTopGeo = new THREE.TorusGeometry(0.95, 0.05, 16, 64);
const capMetalMat = new THREE.MeshStandardMaterial({
  color: 0xffd66b,
  metalness: 1.0,
  roughness: 0.15,
  emissive: 0x8a5a00,
  emissiveIntensity: 0.4,
});
const equatorRing = new THREE.Mesh(capTopGeo, capMetalMat);
equatorRing.rotation.x = Math.PI / 2;
capsuleGroup.add(equatorRing);

// 2-e. 떠다니는 룬(rune) 링 — 캡슐 주위 천천히 도는 자기장 같은 라인
const runeGeo = new THREE.TorusGeometry(1.35, 0.012, 8, 96);
const runeMat = new THREE.MeshBasicMaterial({
  color: 0xe879f9,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const runeRing1 = new THREE.Mesh(runeGeo, runeMat);
const runeRing2 = new THREE.Mesh(runeGeo, runeMat.clone());
(runeRing2.material as THREE.MeshBasicMaterial).color.setHex(0xffd66b);
runeRing1.rotation.x = Math.PI / 3;
runeRing2.rotation.x = -Math.PI / 4;
runeRing2.rotation.y = Math.PI / 3;
capsuleGroup.add(runeRing1);
capsuleGroup.add(runeRing2);

// 폭발 시 그룹 단위로 visible 토글하기 위해 capsule 변수 참조 유지

// ---------- 2-b. 영롱 오라(할로) ----------
const haloGeo = new THREE.SphereGeometry(1.6, 32, 32);
const haloMat = new THREE.MeshBasicMaterial({
  color: 0xe879f9,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.BackSide,
});
const halo = new THREE.Mesh(haloGeo, haloMat);
scene.add(halo);

// 외곽 글리머 입자 (압력 시 회전·발광)
const glimmerCount = 24;
const glimmerGeo = new THREE.IcosahedronGeometry(0.04, 0);
const glimmerMat = new THREE.MeshBasicMaterial({
  color: 0xffd66b,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const glimmers: THREE.Mesh[] = [];
for (let i = 0; i < glimmerCount; i++) {
  const m = new THREE.Mesh(glimmerGeo, glimmerMat.clone());
  const a = (i / glimmerCount) * Math.PI * 2;
  const r = 2.2 + Math.random() * 0.4;
  m.userData.angle = a;
  m.userData.radius = r;
  m.userData.tilt = (Math.random() - 0.5) * 0.6;
  scene.add(m);
  glimmers.push(m);
}

// ---------- 3. 파편 풀 ----------
type Shard = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; spin: THREE.Vector3 };
const shards: Shard[] = [];
const shardGeo = new THREE.IcosahedronGeometry(0.06, 0);

function spawnExplosion() {
  for (let i = 0; i < 36; i++) {
    const color = Math.random() < 0.5 ? 0xffd66b : 0xe879f9;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.5,
      transparent: true,
    });
    const m = new THREE.Mesh(shardGeo, mat);
    m.position.copy(capsule.position);
    scene.add(m);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize();
    shards.push({
      mesh: m,
      velocity: dir.multiplyScalar(0.12 + Math.random() * 0.08),
      life: 1,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.2),
    });
  }
}

// ---------- 4. 사운드 ----------
let audioCtx: AudioContext | null = null;
function rumble(pressure: number) {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  // 짧은 구현: 압력 표현은 햅틱 위주, 사운드는 폭발 시
  void pressure;
}
function explode() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ctx = audioCtx;
  // 폭발 톡
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);
  osc.type = "triangle";
  osc.frequency.value = 180;
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.4);
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  // 챠임
  const c = ctx.createOscillator();
  const cg = ctx.createGain();
  c.connect(cg).connect(ctx.destination);
  c.type = "sine";
  c.frequency.value = 880;
  cg.gain.value = 0;
  cg.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
  cg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
  c.start();
  c.stop(ctx.currentTime + 1);
}

function vibrateBuildup() {
  if (navigator.vibrate) navigator.vibrate([5, 5, 5, 5, 5, 5, 5, 5]);
}
function vibrateExplode() {
  if (navigator.vibrate) navigator.vibrate([20, 30, 60]);
}

// ---------- 5. 인터랙션: 길게 누르기 ----------
const BUILD_DURATION = 1200; // ms
let pressStart: number | null = null;
let exploded = false;
let pressure = 0;

function startPress(e: PointerEvent) {
  if (exploded) return;
  if (readCount() >= DAILY_LIMIT) {
    showMessage("오늘 캡슐은 모두 사용했어요.\n내일 0시에 충전돼요.");
    return;
  }
  pressStart = performance.now();
  vibrateBuildup();
  hintEl.style.opacity = "0";
  e.preventDefault();
}

function endPress() {
  if (pressStart === null || exploded) {
    pressStart = null;
    return;
  }
  const held = performance.now() - pressStart;
  pressStart = null;
  if (held >= BUILD_DURATION * 0.7) {
    triggerExplosion();
  } else {
    // 너무 짧으면 캡슐 원복
    pressure = 0;
  }
}

function triggerExplosion() {
  if (exploded) return;
  exploded = true;
  vibrateExplode();
  explode();
  spawnExplosion();
  capsuleGroup.visible = false;
  increment();
  refreshDaily();
  setTimeout(() => {
    showMessage(pickMessage());
  }, 600);
}

function showMessage(text: string) {
  messageText.textContent = text;
  messageEl.removeAttribute("hidden");
  messageEl.setAttribute("data-show", "true");
}
function hideMessage() {
  messageEl.setAttribute("data-show", "false");
  setTimeout(() => {
    messageEl.setAttribute("hidden", "");
    resetCapsule();
  }, 480);
}

function resetCapsule() {
  capsuleGroup.scale.setScalar(1);
  capsuleGroup.visible = true;
  pressure = 0;
  exploded = false;
  hintEl.style.opacity = "";
}

canvas.addEventListener("pointerdown", startPress);
canvas.addEventListener("pointerup", endPress);
canvas.addEventListener("pointercancel", endPress);
canvas.addEventListener("pointerleave", endPress);
messageClose.addEventListener("click", hideMessage);

// ---------- 6. 리사이즈 ----------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- 7. 애니메이션 루프 ----------
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  if (pressStart !== null) {
    const held = performance.now() - pressStart;
    pressure = Math.min(1, held / BUILD_DURATION);
    if (pressure >= 1 && !exploded) triggerExplosion();
  }

  if (!exploded) {
    const breath = Math.sin(t * 1.5) * 0.02;
    const swell = 1 + pressure * 0.6 + breath;
    capsuleGroup.scale.setScalar(swell);
    capsuleGroup.rotation.y = Math.sin(t * 0.4) * 0.3 + pressure * t * 0.6;
    // 압력 진동
    if (pressure > 0.3) {
      const jitter = pressure * 0.05;
      capsuleGroup.position.x = (Math.random() - 0.5) * jitter;
      capsuleGroup.position.y = (Math.random() - 0.5) * jitter;
    } else {
      capsuleGroup.position.x = 0;
      capsuleGroup.position.y = 0;
    }
    capsuleMat.emissiveIntensity = 0.15 + pressure * 2.2;
    // 이리데센스 두께 압력 시프트
    capsuleMat.iridescenceThicknessRange = [200 + pressure * 200, 1400 + pressure * 600];
    corePulse.intensity = pressure * 4.0 + Math.sin(t * 3) * 0.2 * pressure;

    // 내부 코어: 자체 회전 + 압력 시 펄스
    const corePulseScale = 1 + Math.sin(t * 3) * 0.05 + pressure * 0.4;
    core.scale.setScalar(corePulseScale);
    core.rotation.x = t * 0.7;
    core.rotation.y = t * 1.1;
    coreMat.emissiveIntensity = 1.8 + pressure * 3.5 + Math.sin(t * 4) * 0.3;
    // 코어 글로우: 압력 시 밝아짐
    coreGlow.scale.setScalar(1 + pressure * 0.6 + Math.sin(t * 2.5) * 0.05);
    coreGlowMat.opacity = 0.4 + pressure * 0.5;
    coreGlowMat.color.setHSL(0.85 - pressure * 0.1, 0.85, 0.7);

    // 룬 링 회전 (압력 시 가속)
    const runeSpeed = 0.2 + pressure * 1.5;
    runeRing1.rotation.z = t * runeSpeed;
    runeRing2.rotation.z = -t * runeSpeed * 0.7;
    (runeRing1.material as THREE.MeshBasicMaterial).opacity = 0.55 + pressure * 0.4;
    (runeRing2.material as THREE.MeshBasicMaterial).opacity = 0.55 + pressure * 0.4;

    // 적도 링: 압력 시 발광 강화
    capMetalMat.emissiveIntensity = 0.4 + pressure * 1.6;

    // 할로: 압력 시 발광 확장
    halo.scale.setScalar(1 + pressure * 0.25 + Math.sin(t * 2) * 0.02);
    haloMat.opacity = 0.08 + pressure * 0.35;
    haloMat.color.setHSL(0.78 + pressure * 0.12, 0.7, 0.6 + pressure * 0.2);

    // 글리머 입자: 압력 시 발광 + 회전 가속
    const swirlSpeed = 0.15 + pressure * 1.2;
    for (let i = 0; i < glimmers.length; i++) {
      const g = glimmers[i];
      const ang = (g.userData.angle as number) + t * swirlSpeed;
      const r = (g.userData.radius as number) * (1 + pressure * 0.1);
      const tilt = g.userData.tilt as number;
      g.position.set(Math.cos(ang) * r, Math.sin(ang) * r + tilt, Math.sin(ang * 2) * 0.6);
      const m = g.material as THREE.MeshBasicMaterial;
      m.opacity = 0.15 + pressure * 0.85 + Math.sin(t * 5 + i) * 0.1 * pressure;
      m.color.setHSL(0.13 + pressure * 0.05 + (i % 2) * 0.6, 0.8, 0.7);
    }
    rumble(pressure);
  } else {
    haloMat.opacity = 0;
    for (const g of glimmers) (g.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  // 파편 업데이트
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.mesh.position.add(s.velocity);
    s.velocity.y -= 0.004;
    s.mesh.rotation.x += s.spin.x;
    s.mesh.rotation.y += s.spin.y;
    s.life -= 0.012;
    const mat = s.mesh.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.max(0, s.life);
    mat.emissiveIntensity = Math.max(0, s.life * 1.5);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      shards.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
