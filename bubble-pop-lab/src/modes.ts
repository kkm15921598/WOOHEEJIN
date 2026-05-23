export type Mode = "meditation" | "immersion" | "daily";

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

// 오늘의 패턴 완료 시 패턴별 긍정 메시지
const DAILY_PRAISES: Record<string, string> = {
  "하트": "사랑으로 가득 채운 하루,\n스트레스는 사라졌어요.",
  "별": "오늘 당신은 별처럼 빛났어요.\n걱정은 다 터져 나갔어요.",
  "ㅎ": "하하, 웃음이 나오죠?\n스트레스도 같이 웃으면서 사라졌어요.",
  "미소": "미소를 완성한 당신,\n기분이 한결 나아졌을 거예요.",
  "다이아": "다이아몬드처럼 단단한 당신.\n스트레스 따윈 터뜨려 버렸어요.",
  "음표": "한 음 한 음 터뜨리면서\n마음의 소음도 사라졌어요.",
  "스트라이프": "줄줄이 날려보낸 스트레스.\n깔끔하게 비웠어요.",
};

export function dailyPraise(patternName: string): string {
  return DAILY_PRAISES[patternName] ?? "오늘의 패턴 완성!\n스트레스도 함께 사라졌어요.";
}

export const IMMERSION_START_MS = 60_000;
export const IMMERSION_BONUS_MS = 5_000;

export function currentMonthLabel(): string {
  const d = new Date();
  return `${d.getMonth() + 1}월`;
}
