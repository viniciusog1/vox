// Efeitos de voz do microfone (robô, vilão espacial, grave, esquilo, rádio, megafone,
// caverna, alien). Tudo gerado em tempo real com Web Audio, sem arquivos.
// A lista de ids também é usada pelo servidor (ícone do efeito na lista da voz).
// Usado por main.js (via room-state.js) e renderer.js (VoxVoiceFx). Também é módulo Node (testes).
(function (root) {
  const EFFECTS = [
    { id: 'normal', name: 'Normal' },
    { id: 'robo', name: 'Robô' },
    { id: 'vilao', name: 'Vilão espacial' },
    { id: 'grave', name: 'Grave' },
    { id: 'esquilo', name: 'Esquilo' },
    { id: 'radio', name: 'Rádio' },
    { id: 'megafone', name: 'Megafone' },
    { id: 'caverna', name: 'Caverna' },
    { id: 'alien', name: 'Alien' }
  ];
  const IDS = EFFECTS.map((e) => e.id);

  function isVoiceFx(id) {
    return typeof id === 'string' && IDS.includes(id);
  }

  function nameOf(id) {
    const fx = EFFECTS.find((e) => e.id === id);
    return fx ? fx.name : 'Normal';
  }

  // Quanto o tom muda em cada efeito (1 = igual; 0,5 = uma oitava abaixo; 2 = acima).
  const PITCH = { vilao: 0.72, grave: 0.78, esquilo: 1.6, alien: 1.3 };

  // Muda o tom sem mudar a velocidade: duas leituras de uma linha de atraso que anda
  // mais rápido ou mais devagar que a escrita, cruzadas por uma janela de Hann (as duas
  // somam sempre 1). Latência de meia janela. Função isolada: roda no AudioWorklet
  // (copiada como texto) e nos testes do Node.
  function createPitchShifter(sampleRate, windowMs) {
    const W = Math.max(64, Math.round(sampleRate * (windowMs || 60) / 1000));
    const size = W * 2 + 8;
    const buf = new Float32Array(size);
    let w = 0;
    let phase = 0;
    const read = (delay) => {
      let pos = w - 1 - delay;
      while (pos < 0) pos += size;
      const i = Math.floor(pos);
      const f = pos - i;
      const a = buf[i % size];
      const b = buf[(i + 1) % size];
      return a + (b - a) * f;
    };
    return {
      windowSamples: W,
      process(input, output, ratio) {
        const step = 1 - (ratio > 0 ? ratio : 1);
        for (let n = 0; n < output.length; n++) {
          buf[w] = input ? input[n] || 0 : 0;
          w = (w + 1) % size;
          phase += step;
          while (phase >= W) phase -= W;
          while (phase < 0) phase += W;
          const d1 = phase;
          const d2 = (phase + W / 2) % W;
          const g1 = 0.5 - 0.5 * Math.cos((2 * Math.PI * d1) / W);
          const g2 = 0.5 - 0.5 * Math.cos((2 * Math.PI * d2) / W);
          output[n] = read(d1) * g1 + read(d2) * g2;
        }
      }
    };
  }

  // Curva de distorção suave (saturação) para o WaveShaper: limitada a ±1.
  function makeDriveCurve(amount, points) {
    const n = points || 1024;
    const k = Math.max(0, amount || 0);
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  // Resposta de impulso da "caverna": ruído que decai, com sorteio de semente fixa
  // (sai sempre igual). Devolve as amostras; o renderer copia para um AudioBuffer.
  function makeCaveImpulse(sampleRate, seconds, decay) {
    const len = Math.max(1, Math.round(sampleRate * (seconds || 2)));
    const out = new Float32Array(len);
    let seed = 0x5eed1234;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < len; i++) {
      out[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, decay || 3);
    }
    return out;
  }

  // Monta o efeito no contexto de áudio. `pitchNode(ratio)` cria o nó do worklet de tom
  // (o renderer passa; sem ele, os efeitos que mudam o tom ficam sem essa parte).
  // Devolve { input, output, dispose }.
  function buildEffect(ctx, id, opts) {
    const o = opts || {};
    const nodes = [];
    const oscillators = [];
    const node = (n) => { nodes.push(n); return n; };
    const gain = (v) => { const g = node(ctx.createGain()); g.gain.value = v; return g; };
    const filter = (type, freq, q, dB) => {
      const f = node(ctx.createBiquadFilter());
      f.type = type;
      f.frequency.value = freq;
      if (q !== undefined) f.Q.value = q;
      if (dB !== undefined) f.gain.value = dB;
      return f;
    };
    const drive = (amount) => {
      const s = node(ctx.createWaveShaper());
      s.curve = makeDriveCurve(amount);
      s.oversample = '2x';
      return s;
    };
    const osc = (type, freq) => {
      const s = ctx.createOscillator();
      s.type = type;
      s.frequency.value = freq;
      s.start();
      oscillators.push(s);
      nodes.push(s);
      return s;
    };
    // Multiplica o sinal por uma onda (modulação em anel): som metálico de robô.
    const ring = (freq, type) => {
      const g = gain(0);
      osc(type || 'sine', freq).connect(g.gain);
      return g;
    };
    const pitch = (ratio) => {
      if (!o.pitchNode) return gain(1);
      const p = o.pitchNode(ratio);
      nodes.push(p);
      return p;
    };
    // Eco curto com realimentação (timbre de lata, metálico).
    const comb = (delaySec, feedback, wet) => {
      const input = gain(1);
      const output = gain(1);
      const d = node(ctx.createDelay(0.1));
      d.delayTime.value = delaySec;
      const fb = gain(feedback);
      const w = gain(wet);
      input.connect(output);
      input.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(w);
      w.connect(output);
      return { input, output };
    };
    const series = (...parts) => {
      for (let i = 0; i < parts.length - 1; i++) {
        const a = parts[i].output || parts[i];
        const b = parts[i + 1].input || parts[i + 1];
        a.connect(b);
      }
      return { input: parts[0].input || parts[0], output: parts[parts.length - 1].output || parts[parts.length - 1] };
    };

    // Os ganhos finais deixam todos perto do volume da voz normal, sem estourar (medido no app).
    let graph;
    switch (id) {
      case 'robo': {
        const r = ring(55, 'sine');
        graph = series(filter('highpass', 180, 0.7), r, comb(0.006, 0.55, 0.7), gain(1.1));
        break;
      }
      case 'vilao': {
        graph = series(pitch(PITCH.vilao), filter('peaking', 180, 1, 5), drive(3),
          filter('lowpass', 3200, 0.8), comb(0.011, 0.35, 0.45), gain(0.45));
        break;
      }
      case 'grave':
        graph = series(pitch(PITCH.grave), filter('lowshelf', 200, undefined, 3), gain(1));
        break;
      case 'esquilo':
        graph = series(pitch(PITCH.esquilo), gain(1));
        break;
      case 'radio':
        graph = series(filter('highpass', 400, 0.7), filter('lowpass', 3200, 0.7),
          filter('peaking', 1500, 1, 6), drive(6), gain(0.33));
        break;
      case 'megafone':
        graph = series(filter('highpass', 700, 0.7), filter('lowpass', 4200, 0.7),
          filter('peaking', 2000, 1, 8), drive(25), gain(0.25));
        break;
      case 'caverna': {
        const input = gain(1);
        const output = gain(1);
        const dry = gain(0.92);
        const pre = node(ctx.createDelay(0.2));
        pre.delayTime.value = 0.04;
        const conv = node(ctx.createConvolver());
        const samples = makeCaveImpulse(ctx.sampleRate, 2.2, 3);
        const ir = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        ir.getChannelData(0).set(samples);
        conv.buffer = ir;
        const wet = gain(0.68);
        input.connect(dry);
        dry.connect(output);
        input.connect(pre);
        pre.connect(conv);
        conv.connect(wet);
        wet.connect(output);
        graph = { input, output };
        break;
      }
      case 'alien': {
        const p = pitch(PITCH.alien);
        // Tom balançando devagar (6 Hz) quando o worklet aceita o parâmetro.
        if (p.parameters && p.parameters.get) {
          const ratioParam = p.parameters.get('ratio');
          if (ratioParam) {
            const depth = gain(0.06);
            osc('sine', 6).connect(depth);
            depth.connect(ratioParam);
          }
        }
        const split = gain(1);
        const out = gain(1);
        const dry = gain(0.55);
        const r = ring(32, 'triangle');
        const wet = gain(0.7);
        split.connect(dry);
        dry.connect(out);
        split.connect(r);
        r.connect(wet);
        wet.connect(out);
        graph = series(p, { input: split, output: out }, filter('highpass', 150, 0.7), gain(1.35));
        break;
      }
      default: {
        const g = gain(1);
        graph = { input: g, output: g };
      }
    }

    return {
      input: graph.input,
      output: graph.output,
      dispose() {
        for (const s of oscillators) { try { s.stop(); } catch (e) {} }
        for (const n of nodes) {
          if (n.port) { try { n.port.postMessage('stop'); } catch (e) {} } // encerra o worklet de tom
          try { n.disconnect(); } catch (e) {}
        }
      }
    };
  }

  const api = { EFFECTS, PITCH, isVoiceFx, nameOf, createPitchShifter, makeDriveCurve, makeCaveImpulse, buildEffect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VoxVoiceFx = api;
})(typeof window !== 'undefined' ? window : globalThis);
