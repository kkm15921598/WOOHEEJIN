import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ---------- 1. 씬 셋업 ----------
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const scoreEl = document.getElementById("score")!;
const startBtn = document.getElementById("startBtn")!;
const hero = document.getElementById("hero")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();

// 환경맵 — iridescence·transmission 굴절을 위한 필수 reflection
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 12);

// 조명: 신비로운 듀얼 림
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

// ---------- 2. 버블 그리드 ----------
type Bubble = {
  mesh: THREE.Mesh;
  popped: boolean;
  basePos: THREE.Vector3;
  color: number;
  emissive: number;
  floatPhase: number;
};

const bubbles: Bubble[] = [];
const COLS = 6;
const ROWS = 9;
const GAP = 1.45;

const bubbleGeo = new THREE.SphereGeometry(0.55, 32, 32);

// 신비·오묘 큐레이션 팔레트 — 각 버블이 이 중 랜덤으로 골라 진한 색 그대로 발산
const MYSTIC_PALETTE = [
  { color: 0x7DD3FC, emissive: 0x1E3A8A, name: "sky-saphir" },     // 사파이어 하늘
  { color: 0xC084FC, emissive: 0x4C1D95, name: "amethyst" },       // 자수정
  { color: 0xF472B6, emissive: 0x9D174D, name: "rose-quartz" },    // 로즈쿼츠
  { color: 0x6EE7B7, emissive: 0x065F46, name: "jade" },           // 옥
  { color: 0xFCD34D, emissive: 0xB45309, name: "honey" },          // 황금꿀
  { color: 0xA78BFA, emissive: 0x5B21B6, name: "lavender-dusk" },  // 라벤더 황혼
  { color: 0xFB7185, emissive: 0xBE123C, name: "coral-flame" },    // 코랄
  { color: 0x67E8F9, emissive: 0x0E7490, name: "aqua-aurora" },    // 아쿠아 오로라
  { color: 0xFDA4AF, emissive: 0xBE185D, name: "peach-sunset" },   // 노을 복숭아
  { color: 0xC4B5FD, emissive: 0x4338CA, name: "iris" },           // 아이리스
  { color: 0x86EFAC, emissive: 0x166534, name: "mint-aurora" },    // 민트 오로라
  { color: 0xFBBF24, emissive: 0x92400E, name: "topaz" },          // 황옥
];

function makeBubbleMaterial(): { mat: THREE.MeshPhysicalMaterial; palette: typeof MYSTIC_PALETTE[number] } {
  const palette = MYSTIC_PALETTE[Math.floor(Math.random() * MYSTIC_PALETTE.length)];
  const mat = new THREE.MeshPhysicalMaterial({
    color: palette.color,
    emissive: palette.emissive,
    emissiveIntensity: 0.35, // 내부에서 색이 살짝 빛남
    metalness: 0,
    roughness: 0.08,
    transmission: 0.55, // 낮춰서 색이 드러나게
    thickness: 1.2,
    ior: 1.5,
    iridescence: 0.7, // 무지개 반사는 살짝만 (색을 가리지 않게)
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [200, 600],
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    sheen: 1.0,
    sheenRoughness: 0.25,
    sheenColor: new THREE.Color(palette.color),
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.0,
  });
  return { mat, palette };
}

function buildGrid() {
  for (const b of bubbles) scene.remove(b.mesh);
  bubbles.length = 0;

  const offsetX = -((COLS - 1) * GAP) / 2;
  const offsetY = -((ROWS - 1) * GAP) / 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { mat, palette } = makeBubbleMaterial();
      const mesh = new THREE.Mesh(bubbleGeo, mat);
      const x = offsetX + c * GAP + (r % 2 === 0 ? 0 : GAP * 0.5);
      const y = offsetY + r * GAP;
      mesh.position.set(x, y, 0);
      // 크기도 살짝 랜덤하게 다양성 부여
      const sizeJitter = 0.92 + Math.random() * 0.16;
      mesh.scale.setScalar(sizeJitter);
      scene.add(mesh);
      bubbles.push({
        mesh,
        popped: false,
        basePos: mesh.position.clone(),
        color: palette.color,
        emissive: palette.emissive,
        floatPhase: Math.random() * Math.PI * 2,
      });
    }
  }
}
buildGrid();

// ---------- 3. 도파민 폭발 시스템 ----------
type Shard = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  spin: THREE.Vector3;
  startScale: number;
};
const shards: Shard[] = [];
const shardGeos = [
  new THREE.IcosahedronGeometry(0.08, 0),
  new THREE.TetrahedronGeometry(0.1, 0),
  new THREE.SphereGeometry(0.07, 8, 8),
  new THREE.OctahedronGeometry(0.09, 0),
];

type Flash = { mesh: THREE.Mesh; life: number; maxScale: number };
const flashes: Flash[] = [];
const ringGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 32);
const flashSphereGeo = new THREE.SphereGeometry(0.5, 16, 16);

function spawnExplosion(pos: THREE.Vector3, color: number, emissive: number) {
  // 1. 중앙 플래시 (구체 - 빠르게 확장하며 사라짐)
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = new THREE.Mesh(flashSphereGeo, flashMat);
  flash.position.copy(pos);
  scene.add(flash);
  flashes.push({ mesh: flash, life: 1, maxScale: 2.4 });

  // 2. 컬러 링 (도넛 - 외곽으로 확장)
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pos);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  flashes.push({ mesh: ring, life: 1, maxScale: 4.5 });

  // 3. 다양한 모양·크기 파편 30개 (도파민 양 확보)
  const SHARD_COUNT = 30;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const geo = shardGeos[i % shardGeos.length];
    // 70%는 버블 본연 색, 30%는 흰색/이리데센스 보조
    const isAccent = Math.random() < 0.3;
    const c = isAccent ? 0xffffff : (Math.random() < 0.5 ? color : emissive);
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    const startScale = 0.6 + Math.random() * 0.8;
    m.scale.setScalar(startScale);
    scene.add(m);
    // 구형 사방으로 폭발 + 위쪽 살짝 가중
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 0.1 + Math.random() * 0.12;
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta) + 0.2,
      Math.cos(phi) * 0.4
    );
    shards.push({
      mesh: m,
      velocity: dir.multiplyScalar(speed),
      life: 1,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.3),
      startScale,
    });
  }

  // 4. 화면 섬광 (CSS overlay)
  triggerScreenFlash(color);
}

// CSS 섬광 오버레이
const flashOverlay = document.createElement("div");
flashOverlay.style.cssText =
  "position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity 280ms cubic-bezier(0.32,0.72,0,1);mix-blend-mode:screen;";
document.body.appendChild(flashOverlay);
function triggerScreenFlash(color: number) {
  const hex = "#" + color.toString(16).padStart(6, "0");
  flashOverlay.style.background = `radial-gradient(circle at center, ${hex}66 0%, transparent 60%)`;
  flashOverlay.style.opacity = "1";
  requestAnimationFrame(() => {
    flashOverlay.style.opacity = "0";
  });
}

// ---------- 4. 사운드: 도파민 팝(메인 톡 + 하모닉 + 화이트노이즈 버스트) ----------
let audioCtx: AudioContext | null = null;
function pop(color: number) {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ctx = audioCtx;
  // 컬러 → 음정 매핑 (HSL의 H로 추정)
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const tone = (r * 0.3 + g * 0.5 + b * 0.2); // 0~1
  const base = 320 + tone * 380;

  // 메인 톡
  const o1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  o1.type = "sine";
  o1.connect(g1).connect(ctx.destination);
  o1.frequency.value = base;
  o1.frequency.exponentialRampToValueAtTime(base * 0.45, ctx.currentTime + 0.18);
  g1.gain.value = 0;
  g1.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.005);
  g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
  o1.start();
  o1.stop(ctx.currentTime + 0.25);

  // 5도 하모닉 (도파민 음정감)
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = "triangle";
  o2.connect(g2).connect(ctx.destination);
  o2.frequency.value = base * 1.5;
  g2.gain.value = 0;
  g2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
  o2.start();
  o2.stop(ctx.currentTime + 0.3);

  // 노이즈 버스트 (탁! 감)
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const ndata = noiseBuffer.getChannelData(0);
  for (let i = 0; i < ndata.length; i++) ndata[i] = (Math.random() - 0.5) * Math.exp(-i / (ctx.sampleRate * 0.01));
  const noise = ctx.createBufferSource();
  const ng = ctx.createGain();
  noise.buffer = noiseBuffer;
  ng.gain.value = 0.12;
  noise.connect(ng).connect(ctx.destination);
  noise.start();
}

function hapticPop() {
  if (navigator.vibrate) navigator.vibrate([8, 20, 12]); // 짧은 더블 강조
}

// ---------- 5. 인터랙션: 레이캐스트 ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let score = 0;

function tryPopAt(clientX: number, clientY: number) {
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
  spawnExplosion(bubble.mesh.position, bubble.color, bubble.emissive);
  pop(bubble.color);
  hapticPop();
  score += 1;
  scoreEl.textContent = String(score);
  // 페이드아웃 후 제거
  const mat = bubble.mesh.material as THREE.MeshPhysicalMaterial;
  const fadeStart = performance.now();
  const fade = () => {
    const t = (performance.now() - fadeStart) / 200;
    mat.opacity = Math.max(0, 0.85 * (1 - t));
    bubble.mesh.scale.setScalar(1 + t * 0.4);
    if (t < 1) requestAnimationFrame(fade);
    else scene.remove(bubble.mesh);
  };
  fade();

  // 모든 버블 터지면 재생성
  if (bubbles.every((b) => b.popped)) {
    setTimeout(() => buildGrid(), 400);
  }
}

let dragging = false;
function pointerDown(e: PointerEvent) {
  dragging = true;
  tryPopAt(e.clientX, e.clientY);
}
function pointerMove(e: PointerEvent) {
  if (!dragging) return;
  tryPopAt(e.clientX, e.clientY);
}
function pointerUp() {
  dragging = false;
}

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
canvas.addEventListener("pointerleave", pointerUp);

// ---------- 6. 시작 버튼 ----------
startBtn.addEventListener("click", () => {
  hero.classList.add("is-hidden");
});

// ---------- 7. 리사이즈 ----------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- 8. 애니메이션 루프 ----------
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  // 둥실 떠다니는 모션
  for (const b of bubbles) {
    if (b.popped) continue;
    b.mesh.position.y = b.basePos.y + Math.sin(t * 1.2 + b.floatPhase) * 0.08;
    b.mesh.position.x = b.basePos.x + Math.cos(t * 0.8 + b.floatPhase) * 0.04;
    b.mesh.rotation.y = t * 0.2 + b.floatPhase;
  }
  // 플래시·링 업데이트 (빠르게 확장하며 페이드)
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.life -= 0.04;
    const progress = 1 - f.life;
    const scale = 0.1 + progress * f.maxScale;
    f.mesh.scale.setScalar(scale);
    const mat = f.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = f.life;
    if (f.life <= 0) {
      scene.remove(f.mesh);
      flashes.splice(i, 1);
    }
  }
  // 파편 업데이트 (회전 + 중력 + 페이드)
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.mesh.position.add(s.velocity);
    s.velocity.multiplyScalar(0.96); // 공기저항
    s.velocity.y -= 0.004; // 중력
    s.mesh.rotation.x += s.spin.x;
    s.mesh.rotation.y += s.spin.y;
    s.mesh.rotation.z += s.spin.z;
    s.life -= 0.018;
    // 후반에 살짝 커졌다 작아짐 (도파민 펄스)
    const pulse = s.life > 0.7 ? s.startScale * (1 + (1 - s.life) * 0.6) : s.startScale * s.life * 1.4;
    s.mesh.scale.setScalar(Math.max(0.01, pulse));
    (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      shards.splice(i, 1);
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
