// 프로시저럴 앰비언트 음악 — Web Audio API (저작권 무료, 번들 용량 0)
// v1: 간단한 pad 코드 진행. v1.1에서 실제 음원 추가 가능.

let ctx: AudioContext | null = null;
let meditationNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
let immersionNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

// 명상: 느린 pad (C major 7th → F major 7th 반복)
export function startMeditationMusic() {
  stopAll();
  const c = getCtx();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);

  const freqs = [130.81, 164.81, 196.00, 246.94]; // C3 E3 G3 B3
  const oscs = freqs.map((f) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const oscGain = c.createGain();
    oscGain.gain.value = 0.06;
    osc.connect(oscGain).connect(gain);
    osc.start();
    return osc;
  });

  // 천천히 페이드인
  gain.gain.linearRampToValueAtTime(0.35, c.currentTime + 3);

  // 느린 주파수 모듈레이션 (떠다니는 느낌)
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.1;
  lfoGain.gain.value = 2;
  lfo.connect(lfoGain);
  oscs.forEach((o) => lfoGain.connect(o.frequency));
  lfo.start();

  meditationNodes = { oscs: [...oscs, lfo], gain };
}

// 몰입: 약간 더 에너지 있는 pad + 펄스
export function startImmersionMusic() {
  stopAll();
  const c = getCtx();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);

  const freqs = [164.81, 207.65, 261.63, 329.63]; // E3 Ab3 C4 E4
  const oscs = freqs.map((f) => {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const oscGain = c.createGain();
    oscGain.gain.value = 0.05;
    osc.connect(oscGain).connect(gain);
    osc.start();
    return osc;
  });

  gain.gain.linearRampToValueAtTime(0.3, c.currentTime + 2);

  // 살짝 빠른 LFO (박동감)
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.5;
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain);
  oscs.forEach((o) => lfoGain.connect(o.frequency));
  lfo.start();

  immersionNodes = { oscs: [...oscs, lfo], gain };
}

export function stopAll() {
  [meditationNodes, immersionNodes].forEach((nodes) => {
    if (!nodes) return;
    try {
      const c = getCtx();
      nodes.gain.gain.linearRampToValueAtTime(0, c.currentTime + 1);
      setTimeout(() => {
        nodes.oscs.forEach((o) => { try { o.stop(); } catch {} });
        try { nodes.gain.disconnect(); } catch {}
      }, 1200);
    } catch {}
  });
  meditationNodes = null;
  immersionNodes = null;
}
