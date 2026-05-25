export type Mode = "meditation" | "immersion" | "stress";

const TODAY_COUNT_KEY = "bp.today.count";
const MONTH_COUNT_KEY = "bp.month.count";
const TODAY_DATE_KEY = "bp.today.date";
const MONTH_KEY = "bp.month.key";
const MILESTONE_KEY = "bp.milestone";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function monthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function ensureToday() {
  if (localStorage.getItem(TODAY_DATE_KEY) !== todayStr()) {
    localStorage.setItem(TODAY_DATE_KEY, todayStr());
    localStorage.setItem(TODAY_COUNT_KEY, "0");
  }
}

function ensureMonth() {
  if (localStorage.getItem(MONTH_KEY) !== monthStr()) {
    localStorage.setItem(MONTH_KEY, monthStr());
    localStorage.setItem(MONTH_COUNT_KEY, "0");
  }
}

export function getTodayCount(): number {
  ensureToday();
  return Number(localStorage.getItem(TODAY_COUNT_KEY) ?? "0");
}

export function getMonthCount(): number {
  ensureMonth();
  return Number(localStorage.getItem(MONTH_COUNT_KEY) ?? "0");
}

export function addPops(n: number) {
  ensureToday();
  ensureMonth();
  const today = getTodayCount() + n;
  const month = getMonthCount() + n;
  localStorage.setItem(TODAY_COUNT_KEY, String(today));
  localStorage.setItem(MONTH_COUNT_KEY, String(month));
}

// 마일스톤 (한 번만 띄움)
const MILESTONES = [100, 500, 1000, 5000, 10000];

export function checkMilestone(): { type: "today" | "month"; count: number } | null {
  const seen = JSON.parse(localStorage.getItem(MILESTONE_KEY) ?? "{}");
  const today = getTodayCount();
  const month = getMonthCount();

  for (const m of MILESTONES) {
    const todayKey = `t_${todayStr()}_${m}`;
    if (today >= m && !seen[todayKey]) {
      seen[todayKey] = true;
      localStorage.setItem(MILESTONE_KEY, JSON.stringify(seen));
      return { type: "today", count: m };
    }
  }
  for (const m of MILESTONES) {
    const monthKey = `m_${monthStr()}_${m}`;
    if (month >= m && !seen[monthKey]) {
      seen[monthKey] = true;
      localStorage.setItem(MILESTONE_KEY, JSON.stringify(seen));
      return { type: "month", count: m };
    }
  }
  return null;
}

export function clearPraise(secondsTaken: number): string {
  if (secondsTaken <= 5) return "손가락 폭주!";
  if (secondsTaken <= 10) return "시원하게 한 판!";
  if (secondsTaken <= 20) return "꼼꼼히 다 비웠네요";
  return "정성스럽게 한 판 ✨";
}

export function milestonePraise(ms: { type: "today" | "month"; count: number }): string {
  if (ms.type === "today") {
    if (ms.count >= 1000) return `오늘 ${ms.count.toLocaleString()}개… 스트레스 하나도 안 남았겠죠?`;
    if (ms.count >= 500) return `오늘 ${ms.count}개 돌파! 시원하다~`;
    return `오늘 ${ms.count}개 넘었어요!`;
  }
  if (ms.count >= 10000) return `이번 달 ${ms.count.toLocaleString()}개 마스터 🎉`;
  if (ms.count >= 5000) return `이번 달 ${ms.count.toLocaleString()}개! 꾸준히 비우는 중`;
  if (ms.count >= 1000) return `이번 달 ${ms.count.toLocaleString()}개 달성!`;
  return `이번 달 ${ms.count}개!`;
}

const RESULT_PRAISES = [
  "뽁뽁 터진 만큼,\n스트레스도 터져 나갔어요.",
  "손가락이 움직인 만큼,\n마음이 가벼워졌어요.",
  "오늘의 스트레스,\n다 비워냈어요.",
  "뽁뽁 소리에\n걱정이 사라졌어요.",
  "한 개 한 개\n스트레스가 톡톡 빠져나갔어요.",
  "머릿속이\n한결 맑아졌을 거예요.",
  "손끝에서 시작된\n작은 해방.",
  "뽁! 하나 터질 때마다\n하나씩 내려놓은 거예요.",
  "오늘도 잘 비웠어요.\n내일 또 만나요.",
  "마음이 조금\n가벼워졌길 바라요.",
  "스트레스 제로.\n지금 이 순간, 충분해요.",
  "잘했어요.\n오늘 하루, 수고했어요.",
];

export function pickResultPraise(): string {
  return RESULT_PRAISES[Math.floor(Math.random() * RESULT_PRAISES.length)];
}

// 스트레스 터뜨리기 완료 시 칭찬 카피
export function stressPraise(stressName: string): string {
  const options = [
    `"${stressName}" 다 부쉈어요!\n이제 없어요, 시원하죠?`,
    `${stressName}?\n뽁뽁 터뜨려서 날려버렸어요.`,
    `${stressName} 따위,\n손가락으로 전부 없앴어요.`,
    `${stressName}는 이제 가루가 됐어요.\n오늘 하루 수고했어요.`,
    `뽁! 뽁! 뽁!\n${stressName}, 안녕~`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export const IMMERSION_START_MS = 60_000;
export const IMMERSION_BONUS_MS = 5_000;

export function currentMonthLabel(): string {
  const d = new Date();
  return `${d.getMonth() + 1}월`;
}

export function levelUpPraise(level: number, mode: Mode): string {
  if (mode === "meditation") {
    const msgs: Record<number, string> = {
      2: "좋아요, 워밍업 끝!",
      3: "호흡이 차분해지고 있어요",
      4: "리듬을 찾았네요",
      5: "손끝에 집중되고 있어요",
      6: "마음이 고요해져요",
      7: "점점 깊어지는 몰입",
      8: "거의 선승 수준이에요",
      9: "뽁뽁 명상 마스터!",
      10: "경지에 도달했어요",
    };
    return msgs[level] ?? `Lv.${level} 돌입!`;
  }
  const msgs: Record<number, string> = {
    2: "시작이 좋아요!",
    3: "속도가 붙기 시작!",
    4: "시원하게 밀어붙이는 중!",
    5: "폭풍 터뜨리기 돌입!",
    6: "멈출 수 없는 손가락!",
    7: "뽁뽁 폭주 모드!",
    8: "스피드 마스터 등극!",
    9: "역대급 몰입이에요!",
    10: "전설의 뽁뽁러!",
  };
  return msgs[level] ?? `Lv.${level} 돌입!`;
}
