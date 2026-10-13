// Gemini Live voice session: mic (16kHz PCM) -> WebSocket -> audio (24kHz PCM) back.
// Turns + CV-edit tool calls are saved through the Django API, so voice and text share one chat.
import api from "../api/axios";

const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('pcm',P)`;
const b64 = (buf) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function startLive({ jobId, language, onState, onCaption, onSync, onProfile, onError }) {
  let ws, inCtx, outCtx, node, stream, analyser, closed = false, muted = false;
  let userText = "", coachText = "", nextT = 0, micLvl = 0;
  const wave = new Uint8Array(256);
  const sources = new Set();
  const body = { job_id: jobId || undefined, language: language && language !== "auto" ? language : undefined };

  const stop = () => {
    if (closed) return;
    closed = true;
    try { ws?.close(); } catch { /* ignore */ }
    try { node?.disconnect(); } catch { /* ignore */ }
    stream?.getTracks().forEach((t) => t.stop());
    sources.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
    inCtx?.close().catch(() => {}); outCtx?.close().catch(() => {});
    onState("idle");
  };

  try {
    onState("connecting");
    const { data: cfg } = await api.post("/jobs/coach/live/token/", body);
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    outCtx = new AudioContext({ sampleRate: 24000 });
    analyser = outCtx.createAnalyser(); analyser.fftSize = 256;
    analyser.connect(outCtx.destination);
    const host = "generativelanguage.googleapis.com/ws/google.ai.generativelanguage";
    const url = cfg.mode === "key"
      ? `wss://${host}.v1beta.GenerativeService.BidiGenerateContent?key=${cfg.token}`
      : `wss://${host}.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${cfg.token}`;
    ws = new WebSocket(url);

    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: `models/${cfg.model}`,
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
      systemInstruction: { parts: [{ text: cfg.system_instruction }] },
      tools: cfg.tools,
      inputAudioTranscription: {}, outputAudioTranscription: {},
      // less trigger-happy VAD: fewer false interruptions from echo / background noise
      realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: "START_SENSITIVITY_LOW", endOfSpeechSensitivity: "END_SENSITIVITY_LOW", prefixPaddingMs: 40, silenceDurationMs: 600 } },
    } }));

    const startMic = async () => {
      inCtx = new AudioContext({ sampleRate: 16000 });
      await inCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" })));
      node = new AudioWorkletNode(inCtx, "pcm");
      inCtx.createMediaStreamSource(stream).connect(node);
      let buf = [], n = 0;
      node.port.onmessage = (e) => {
        buf.push(e.data); n += e.data.length;
        if (n < 1600 || ws.readyState !== 1) return; // ~100ms chunks
        const i16 = new Int16Array(n); let o = 0, sum = 0;
        for (const f of buf) for (let i = 0; i < f.length; i++) { sum += f[i] * f[i]; i16[o++] = Math.max(-1, Math.min(1, f[i])) * 0x7fff; }
        buf = []; n = 0;
        const rms = Math.sqrt(sum / i16.length);
        micLvl = Math.max(muted ? 0 : rms * 6, micLvl * 0.8);
        // echo gate: while the coach talks, only quiet-room-level mic input is blanked, real speech still barges in
        if (muted || (sources.size && rms < 0.03)) i16.fill(0);
        ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64(i16.buffer), mimeType: "audio/pcm;rate=16000" } } }));
      };
      onState("listening");
    };

    const play = (data) => {
      const i16 = new Int16Array(unb64(data).buffer);
      const f = Float32Array.from(i16, (v) => v / 0x8000);
      const b = outCtx.createBuffer(1, f.length, 24000);
      b.copyToChannel(f, 0);
      const s = outCtx.createBufferSource();
      s.buffer = b; s.connect(analyser);
      // jitter buffer: after an underrun (or at the start) wait ~150ms so late chunks don't cause gaps
      if (nextT < outCtx.currentTime + 0.02) nextT = outCtx.currentTime + 0.15;
      s.start(nextT); nextT += b.duration;
      sources.add(s); s.onended = () => { sources.delete(s); if (!sources.size) onState("listening"); };
      onState("speaking");
    };

    const flush = async () => {
      const u = userText.trim(), c = coachText.trim();
      userText = ""; coachText = ""; onCaption("", "");
      if (!u && !c) return;
      try { const { data } = await api.post("/jobs/coach/live/turn/", { ...body, user_text: u, coach_text: c }); onSync(data.messages); } catch { /* ignore */ }
    };

    const runTool = async (call) => {
      let response = { ok: false, error: "Tool failed." };
      try {
        const { data } = await api.post("/jobs/coach/live/tool/", { ...body, name: call.name, args: call.args, heard: userText });
        response = data.result; onSync(data.messages);
        if (data.profile) onProfile(data.profile);
      } catch { /* keep default */ }
      ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response }] } }));
    };

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : await ev.data.text());
      if (msg.setupComplete) { startMic().catch((e) => { onError(e); stop(); }); return; }
      if (msg.toolCall) { msg.toolCall.functionCalls?.forEach(runTool); return; }
      const sc = msg.serverContent;
      if (!sc) return;
      if (sc.interrupted) { sources.forEach((s) => { try { s.stop(); } catch { /* ignore */ } }); sources.clear(); nextT = 0; coachText = ""; } // barge-in
      sc.modelTurn?.parts?.forEach((p) => p.inlineData?.data && play(p.inlineData.data));
      if (sc.inputTranscription?.text) userText += sc.inputTranscription.text;
      if (sc.outputTranscription?.text) coachText += sc.outputTranscription.text;
      onCaption(userText, coachText);
      if (sc.turnComplete) flush();
    };
    ws.onerror = () => { if (!closed) onError(new Error("Voice connection failed")); };
    ws.onclose = () => { if (!closed) { flush(); stop(); } };
  } catch (e) {
    onError(e); stop();
  }
  return {
    stop,
    setMuted: (v) => { muted = v; },
    getLevels: () => { // 0..1 loudness of you and the coach, for the animated orb
      let out = 0;
      if (analyser && !closed) { analyser.getByteTimeDomainData(wave); let sum = 0; for (const v of wave) sum += ((v - 128) / 128) ** 2; out = Math.min(1, Math.sqrt(sum / wave.length) * 4); }
      return { mic: Math.min(1, micLvl), out };
    },
  };
}
