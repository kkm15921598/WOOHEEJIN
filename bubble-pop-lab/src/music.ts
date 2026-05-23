// 자연 소리 기반 앰비언트 — 노이즈 + 필터로 파도/바람 느낌
let ctx: AudioContext | null = null;
let activeSources: AudioBufferSourceNode[] = [];
let activeGains: GainNode[] = [];
let activeLfos: OscillatorNode[] = [];
let masterGain: GainNode | null = null;

async function ensureCtx(): Promise<AudioContext> {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

function makeNoise(c: AudioContext, seconds: number): AudioBuffer {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // 브라운 노이즈 (파도/바람에 가까움)
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

// 명상: 부드러운 바람/파도 소리 — 느린 wash
export async function startMeditationMusic() {
  stopAll();
  const c = await ensureCtx();

  masterGain = c.createGain();
  masterGain.gain.setValueAtTime(0.001, c.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.6, c.currentTime + 3);
  masterGain.connect(c.destination);

  const noiseBuf = makeNoise(c, 4);

  // 레이어 1: 깊은 바람
  const src1 = c.createBufferSource();
  src1.buffer = noiseBuf;
  src1.loop = true;
  const lp1 = c.createBiquadFilter();
  lp1.type = "lowpass";
  lp1.frequency.setValueAtTime(300, c.currentTime);
  lp1.Q.setValueAtTime(0.5, c.currentTime);
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0.7, c.currentTime);
  src1.connect(lp1).connect(g1).connect(masterGain);
  src1.start();

  // 레이어 2: 높은 바람결
  const src2 = c.createBufferSource();
  src2.buffer = noiseBuf;
  src2.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(800, c.currentTime);
  bp.Q.setValueAtTime(1.5, c.currentTime);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.15, c.currentTime);
  src2.connect(bp).connect(g2).connect(masterGain);
  src2.start();

  // 파도 wash LFO: 필터 주파수를 천천히 올렸다 내림
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.08, c.currentTime); // 12초 주기
  const lfoG = c.createGain();
  lfoG.gain.setValueAtTime(200, c.currentTime);
  lfo.connect(lfoG).connect(lp1.frequency);
  lfo.start();

  activeSources.push(src1, src2);
  activeGains.push(g1, g2);
  activeLfos.push(lfo);
}

// 몰입: 더 리듬감 있는 파도 — 빠른 wash + 약간의 주파수 높임
export async function startImmersionMusic() {
  stopAll();
  const c = await ensureCtx();

  masterGain = c.createGain();
  masterGain.gain.setValueAtTime(0.001, c.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.55, c.currentTime + 2);
  masterGain.connect(c.destination);

  const noiseBuf = makeNoise(c, 4);

  const src1 = c.createBufferSource();
  src1.buffer = noiseBuf;
  src1.loop = true;
  const lp1 = c.createBiquadFilter();
  lp1.type = "lowpass";
  lp1.frequency.setValueAtTime(500, c.currentTime);
  lp1.Q.setValueAtTime(0.8, c.currentTime);
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0.6, c.currentTime);
  src1.connect(lp1).connect(g1).connect(masterGain);
  src1.start();

  const src2 = c.createBufferSource();
  src2.buffer = noiseBuf;
  src2.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1200, c.currentTime);
  bp.Q.setValueAtTime(2, c.currentTime);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.12, c.currentTime);
  src2.connect(bp).connect(g2).connect(masterGain);
  src2.start();

  // 빠른 파도 wash (4초 주기)
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.25, c.currentTime);
  const lfoG = c.createGain();
  lfoG.gain.setValueAtTime(300, c.currentTime);
  lfo.connect(lfoG).connect(lp1.frequency);
  lfo.start();

  activeSources.push(src1, src2);
  activeGains.push(g1, g2);
  activeLfos.push(lfo);
}

export function stopAll() {
  if (masterGain && ctx) {
    try {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    } catch {}
  }
  const srcs = [...activeSources];
  const lfos = [...activeLfos];
  const mg = masterGain;
  activeSources = [];
  activeGains = [];
  activeLfos = [];
  masterGain = null;
  setTimeout(() => {
    srcs.forEach((s) => { try { s.stop(); } catch {} });
    lfos.forEach((l) => { try { l.stop(); } catch {} });
    if (mg) try { mg.disconnect(); } catch {}
  }, 1200);
}
