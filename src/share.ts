// 공유 카드 생성 — canvas로 그려서 Blob 만들고 Web Share API 또는 다운로드.

export type ShareCardOpts = {
  title: string;
  score: number;
  subtitle: string;
  best?: number;
  patternName?: string;
};

export async function buildShareCard(opts: ShareCardOpts): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 배경 — 버블팝 신비 그라데이션
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#E6F9FA");
  bg.addColorStop(0.5, "#FFF8FB");
  bg.addColorStop(1, "#F5E6FF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 데코 버블 (랜덤 위치 12개)
  for (let i = 0; i < 12; i++) {
    const r = 40 + Math.random() * 100;
    const x = Math.random() * W;
    const y = Math.random() * H;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    const hues = ["#7AE5E5", "#FFB7D5", "#C4B5FD", "#FCD34D", "#86EFAC"];
    grad.addColorStop(0.7, hues[i % hues.length] + "55");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 브랜드
  ctx.fillStyle = "rgba(26,31,54,0.55)";
  ctx.font = "700 32px 'NanumSquareRound', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("오늘뽁 · Todapop", W / 2, 120);

  // 타이틀
  ctx.fillStyle = "#1A1F36";
  ctx.font = "800 64px 'NanumSquareRound', system-ui, sans-serif";
  ctx.fillText(opts.title, W / 2, 240);

  // 점수
  const scoreGrad = ctx.createLinearGradient(0, 300, W, 600);
  scoreGrad.addColorStop(0, "#5A6FFF");
  scoreGrad.addColorStop(1, "#FFB7D5");
  ctx.fillStyle = scoreGrad;
  ctx.font = "900 240px 'NanumSquareRound', system-ui, sans-serif";
  ctx.fillText(String(opts.score), W / 2, 540);

  // 서브타이틀
  ctx.fillStyle = "rgba(26,31,54,0.7)";
  ctx.font = "600 36px 'NanumSquareRound', system-ui, sans-serif";
  ctx.fillText(opts.subtitle, W / 2, 640);

  // 베스트
  if (opts.best !== undefined) {
    ctx.fillStyle = "rgba(26,31,54,0.45)";
    ctx.font = "500 28px 'NanumSquareRound', system-ui, sans-serif";
    ctx.fillText(`나의 베스트 ${opts.best}`, W / 2, 720);
  }

  // 패턴 이름 배지
  if (opts.patternName) {
    const badgeW = 360;
    const badgeH = 70;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 800;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 36);
    ctx.fill();
    ctx.fillStyle = "#5A6FFF";
    ctx.font = "700 28px 'NanumSquareRound', system-ui, sans-serif";
    ctx.fillText(`오늘의 패턴 — ${opts.patternName}`, W / 2, badgeY + 46);
  }

  // 푸터
  ctx.fillStyle = "rgba(26,31,54,0.4)";
  ctx.font = "500 24px 'NanumSquareRound', system-ui, sans-serif";
  ctx.fillText("오늘뽁 · 스트레스를 터뜨려요", W / 2, H - 80);

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function shareOrDownload(blob: Blob, filename: string, title: string, text: string) {
  const file = new File([blob], filename, { type: "image/png" });
  // 1) Web Share API + file
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch {
      // 사용자 취소
    }
  }
  // 2) 텍스트만 공유 (파일 미지원 브라우저)
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch {
      // 사용자 취소
    }
  }
  // 3) 다운로드 폴백
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
