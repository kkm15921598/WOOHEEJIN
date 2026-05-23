let ctx: AudioContext | null = null;
let activeNodes: { oscs: OscillatorNode[]; gains: GainNode[]; master: GainNode } | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function startMeditationMusic() {
  stopAll();
  const c = getCtx();
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  const freqs = [130.81, 164.81, 196.00, 246.94]; // C3 E3 G3 B3 — Cmaj7
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  freqs.forEach((f) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.08;
    osc.connect(g).connect(master);
    osc.start();
    oscs.push(osc);
    gains.push(g);
  });

  // 느린 LFO — 떠다니는 느낌
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.08;
  lfoG.gain.value = 1.5;
  lfo.connect(lfoG);
  oscs.forEach((o) => lfoG.connect(o.frequency));
  lfo.start();
  oscs.push(lfo);
  gains.push(lfoG);

  // 페이드인
  master.gain.linearRampToValueAtTime(0.4, c.currentTime + 3);
  activeNodes = { oscs, gains, master };
}

export function startImmersionMusic() {
  stopAll();
  const c = getCtx();
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  const freqs = [164.81, 207.65, 261.63, 329.63]; // E3 Ab3 C4 E4
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  freqs.forEach((f) => {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.06;
    osc.connect(g).connect(master);
    osc.start();
    oscs.push(osc);
    gains.push(g);
  });

  // 리듬감 있는 LFO
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.4;
  lfoG.gain.value = 2.5;
  lfo.connect(lfoG);
  oscs.forEach((o) => lfoG.connect(o.frequency));
  lfo.start();
  oscs.push(lfo);
  gains.push(lfoG);

  master.gain.linearRampToValueAtTime(0.35, c.currentTime + 2);
  activeNodes = { oscs, gains, master };
}

export function stopAll() {
  if (!activeNodes || !ctx) return;
  const c = ctx;
  const nodes = activeNodes;
  activeNodes = null;

  try {
    nodes.master.gain.cancelScheduledValues(c.currentTime);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, c.currentTime);
    nodes.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
  } catch {}

  setTimeout(() => {
    nodes.oscs.forEach((o) => { try { o.stop(); } catch {} });
    try { nodes.master.disconnect(); } catch {}
  }, 1000);
}
