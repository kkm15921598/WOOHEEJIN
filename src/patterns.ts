// 일일 한정 패턴 — 날짜 시드 기반으로 매일 새 모양이 생성된다.
// 패턴은 (col, row) 좌표 집합으로 정의되고 매트릭스로 평면화된다.

export const COLS = 6;
export const ROWS = 9;

export type PatternMask = boolean[]; // length = COLS * ROWS, true면 그 자리에 버블 배치

function idx(c: number, r: number): number {
  return r * COLS + c;
}

// 명상 모드 / 스테이지 진행 — 전체 채움
export function fullMask(): PatternMask {
  return Array(COLS * ROWS).fill(true);
}

// ---------- 모양 패턴들 ----------

// 하트 (러브)
const HEART: ReadonlyArray<readonly [number, number]> = [
  [1, 7], [2, 7], [3, 7], [4, 7],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
  [1, 4], [2, 4], [3, 4], [4, 4],
  [2, 3], [3, 3],
];

// 별
const STAR: ReadonlyArray<readonly [number, number]> = [
  [2, 8], [3, 8],
  [2, 7], [3, 7],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [1, 5], [2, 5], [3, 5], [4, 5],
  [1, 4], [2, 4], [3, 4], [4, 4],
  [0, 3], [1, 3], [4, 3], [5, 3],
];

// 한글 자음 "ㅎ" (오늘)
const HIEUH: ReadonlyArray<readonly [number, number]> = [
  [2, 8], [3, 8],
  [1, 7], [4, 7],
  [1, 6], [2, 6], [3, 6], [4, 6],
  [1, 5], [4, 5],
  [1, 4], [4, 4],
  [1, 3], [2, 3], [3, 3], [4, 3],
];

// 미소 (스마일)
const SMILE: ReadonlyArray<readonly [number, number]> = [
  [1, 7], [4, 7],            // 눈
  [1, 6], [4, 6],
  [0, 4], [5, 4],            // 입꼬리
  [0, 3], [1, 3], [4, 3], [5, 3],
  [1, 2], [2, 2], [3, 2], [4, 2],
];

// 다이아몬드
const DIAMOND: ReadonlyArray<readonly [number, number]> = [
  [2, 8], [3, 8],
  [1, 7], [2, 7], [3, 7], [4, 7],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
  [1, 4], [2, 4], [3, 4], [4, 4],
  [2, 3], [3, 3],
];

// 음표
const NOTE: ReadonlyArray<readonly [number, number]> = [
  [3, 8], [4, 8],
  [3, 7], [4, 7],
  [3, 6],
  [3, 5],
  [3, 4],
  [1, 3], [2, 3], [3, 3],
  [1, 2], [2, 2],
];

// 격자 줄무늬 — 짝수 row만
function STRIPES(): ReadonlyArray<readonly [number, number]> {
  const out: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < COLS; c++) out.push([c, r]);
    }
  }
  return out;
}

const PATTERNS = [
  { name: "하트", cells: HEART },
  { name: "별", cells: STAR },
  { name: "ㅎ", cells: HIEUH },
  { name: "미소", cells: SMILE },
  { name: "다이아", cells: DIAMOND },
  { name: "음표", cells: NOTE },
  { name: "스트라이프", cells: STRIPES() },
];

// 날짜 시드 — YYYYMMDD → 패턴 인덱스
export function todaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function todayPattern(): { name: string; mask: PatternMask } {
  const seed = todaySeed();
  const p = PATTERNS[seed % PATTERNS.length];
  const mask: PatternMask = Array(COLS * ROWS).fill(false);
  for (const [c, r] of p.cells) mask[idx(c, r)] = true;
  return { name: p.name, mask };
}

// 일일 패턴 표시명
export function todayPatternName(): string {
  return PATTERNS[todaySeed() % PATTERNS.length].name;
}

// 사용자 입력 텍스트 → 버블 마스크 (스트레스 터뜨리기 모드)
export function textToMask(text: string): PatternMask {
  const scale = 20;
  const w = COLS * scale;
  const h = ROWS * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const fontSize = Math.min(h * 0.6, (w / Math.max(text.length, 1)) * 1.6);
  ctx.font = `900 ${fontSize}px "Pretendard Variable", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText(text, w / 2, h / 2);

  const data = ctx.getImageData(0, 0, w, h).data;
  const mask: PatternMask = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = Math.floor((c + 0.5) * scale);
      const cy = Math.floor((r + 0.5) * scale);
      let filled = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            if (data[(py * w + px) * 4 + 3] > 50) filled++;
          }
        }
      }
      mask.push(filled > 6);
    }
  }

  // 텍스트가 너무 작아서 마스크가 거의 비었으면 전체 채움으로 폴백
  const filledCount = mask.filter(Boolean).length;
  if (filledCount < 8) return fullMask();

  return mask;
}
