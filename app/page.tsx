"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Control = "left" | "right" | "gas" | "brake";
type ControlState = Record<Control, boolean>;

const initialControls: ControlState = { left: false, right: false, gas: false, brake: false };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const timeText = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${(safe % 60).toFixed(3).padStart(6, "0")}`;
};

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<ControlState>({ ...initialControls });
  const gameRef = useRef({
    speed: 0, x: 0, progress: 0, lap: 1, lapElapsed: 0, totalElapsed: 0,
    lastFrame: 0, running: false, steer: 0, lapTimes: [] as number[], messageUntil: 0,
    message: "READY TO RACE"
  });
  const [speed, setSpeed] = useState(0);
  const [lap, setLap] = useState(1);
  const [lapTime, setLapTime] = useState("00:00.000");
  const [lastLap, setLastLap] = useState("--:--.---");
  const [bestLap, setBestLap] = useState("--:--.---");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("READY TO RACE");
  const [completedLaps, setCompletedLaps] = useState(0);

  const reset = useCallback(() => {
    const g = gameRef.current;
    Object.assign(g, {
      speed: 0, x: 0, progress: 0, lap: 1, lapElapsed: 0, totalElapsed: 0,
      lastFrame: 0, running: false, steer: 0, lapTimes: [], messageUntil: 0,
      message: "READY TO RACE"
    });
    controlsRef.current = { ...initialControls };
    setSpeed(0); setLap(1); setLapTime("00:00.000"); setLastLap("--:--.---");
    setBestLap("--:--.---"); setRunning(false); setMessage("READY TO RACE");
    setCompletedLaps(0);
  }, []);

  const start = useCallback(() => {
    const g = gameRef.current;
    g.running = true;
    g.lastFrame = 0;
    g.message = "GO GO GO!";
    g.messageUntil = performance.now() + 1200;
    setRunning(true);
    setMessage("GO GO GO!");
  }, []);

  const pause = useCallback(() => {
    gameRef.current.running = false;
    controlsRef.current = { ...initialControls };
    setRunning(false);
  }, []);

  const setControl = useCallback((control: Control, pressed: boolean) => {
    controlsRef.current[control] = pressed;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let lastUi = 0;
    let width = 320;
    let height = 500;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(300, rect.width);
      height = Math.max(360, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawCar = (x: number, y: number, scale: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#101016";
      ctx.fillRect(-34, -25, 13, 34);
      ctx.fillRect(21, -25, 13, 34);
      ctx.fillRect(-29, 19, 11, 26);
      ctx.fillRect(18, 19, 11, 26);
      ctx.fillStyle = "#b8a0ff";
      ctx.beginPath();
      ctx.moveTo(-40, 38); ctx.lineTo(-29, 30); ctx.lineTo(29, 30);
      ctx.lineTo(40, 38); ctx.lineTo(37, 44); ctx.lineTo(-37, 44);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.moveTo(-25, 28); ctx.lineTo(-18, -9); ctx.lineTo(-12, -29);
      ctx.lineTo(-7, -39); ctx.lineTo(7, -39); ctx.lineTo(12, -29);
      ctx.lineTo(18, -9); ctx.lineTo(25, 28); ctx.lineTo(16, 36);
      ctx.lineTo(-16, 36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#d8ccff";
      ctx.beginPath(); ctx.moveTo(-17, -7); ctx.lineTo(-11, -25);
      ctx.lineTo(-7, -28); ctx.lineTo(-8, 15); ctx.lineTo(-15, 24);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(17, -7); ctx.lineTo(11, -25);
      ctx.lineTo(7, -28); ctx.lineTo(8, 15); ctx.lineTo(15, 24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#171329";
      ctx.beginPath(); ctx.ellipse(0, -10, 8, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#f3edff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -11, 10, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = "#4c1d95"; ctx.fillRect(-29, 25, 58, 7);
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px Arial"; ctx.textAlign = "center";
      ctx.fillText("R", 0, 19);
      ctx.restore();
    };

    const render = (now: number) => {
      const g = gameRef.current;
      const dt = g.lastFrame ? Math.min((now - g.lastFrame) / 1000, 0.05) : 0;
      g.lastFrame = now;
      const controls = controlsRef.current;

      if (g.running) {
        if (controls.gas) g.speed += 105 * dt;
        else g.speed -= 16 * dt;
        if (controls.brake) g.speed -= 185 * dt;
        g.speed = clamp(g.speed, 0, 320);
        const input = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
        g.steer += (input - g.steer) * Math.min(1, dt * 5);
        g.x = clamp(g.x + g.steer * (0.58 + g.speed / 175) * dt, -1.35, 1.35);
        g.progress += (g.speed / 3.6) * dt / 850;
        g.lapElapsed += dt;
        g.totalElapsed += dt;
        if (g.progress >= 1) {
          g.progress -= 1;
          g.lapTimes.push(g.lapElapsed);
          setLastLap(timeText(g.lapElapsed));
          setBestLap(timeText(Math.min(...g.lapTimes)));
          g.lapElapsed = 0;
          g.lap += 1;
          setLap(g.lap);
          setCompletedLaps(g.lapTimes.length);
          g.message = `LAP ${g.lap - 1} COMPLETE!`;
          g.messageUntil = now + 1700;
          setMessage(g.message);
        }
        if (Math.abs(g.x) > 0.94) g.speed = Math.max(0, g.speed - 48 * dt);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, height * 0.58);
      sky.addColorStop(0, "#121222"); sky.addColorStop(1, "#635082");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      const horizon = height * 0.37;

      ctx.fillStyle = "#292540";
      ctx.beginPath(); ctx.moveTo(0, horizon + 8);
      for (let x = 0; x <= width + 30; x += 30) {
        ctx.lineTo(x, horizon - 15 - Math.sin(x * 0.025) * 12 - Math.cos(x * 0.012) * 7);
      }
      ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();

      ctx.fillStyle = "#1c4d3a"; ctx.fillRect(0, horizon, width, height - horizon);
      const curve = Math.sin(g.progress * Math.PI * 2) * 0.23 + Math.sin(g.progress * Math.PI * 6) * 0.08;
      const center = width * (0.5 - g.x * 0.17 + curve * 0.35);
      for (let i = 0; i < 44; i++) {
        const z1 = i / 44; const z2 = (i + 1) / 44;
        const y1 = horizon + (height - horizon) * z1 * z1;
        const y2 = horizon + (height - horizon) * z2 * z2;
        const half1 = width * (0.035 + z1 * 0.68);
        const half2 = width * (0.035 + z2 * 0.68);
        const off1 = Math.sin((z1 * 1.7 + g.progress * 2.1) * Math.PI) * width * 0.12 * z1;
        const off2 = Math.sin((z2 * 1.7 + g.progress * 2.1) * Math.PI) * width * 0.12 * z2;
        const cx1 = center + off1; const cx2 = center + off2;
        ctx.fillStyle = i % 2 ? "#eeeeee" : "#e34264";
        ctx.beginPath(); ctx.moveTo(cx1 - half1 * 1.08, y1); ctx.lineTo(cx1 - half1, y1);
        ctx.lineTo(cx2 - half2, y2); ctx.lineTo(cx2 - half2 * 1.08, y2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx1 + half1, y1); ctx.lineTo(cx1 + half1 * 1.08, y1);
        ctx.lineTo(cx2 + half2 * 1.08, y2); ctx.lineTo(cx2 + half2, y2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = i % 2 ? "#55545f" : "#45444e";
        ctx.beginPath(); ctx.moveTo(cx1 - half1, y1); ctx.lineTo(cx1 + half1, y1);
        ctx.lineTo(cx2 + half2, y2); ctx.lineTo(cx2 - half2, y2); ctx.closePath(); ctx.fill();
        if (i % 5 < 2) {
          ctx.strokeStyle = "#f7f4ff"; ctx.lineWidth = 1 + z2 * 3;
          ctx.beginPath(); ctx.moveTo(cx1, y1); ctx.lineTo(cx2, y2); ctx.stroke();
        }
        if (i % 8 === 0 && i > 3) {
          const signW = 8 + z2 * 28; const signH = 5 + z2 * 13;
          ctx.fillStyle = "#eee8ff";
          ctx.fillRect(cx2 - half2 * 1.18 - signW, y2 - signH, signW, signH);
          ctx.fillRect(cx2 + half2 * 1.18, y2 - signH, signW, signH);
        }
      }

      if (g.speed > 180) {
        ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const x = (i / 8) * width;
          ctx.beginPath(); ctx.moveTo(x, height * 0.68);
          ctx.lineTo(x + (x - width / 2) * 0.06, height * 0.9); ctx.stroke();
        }
      }
      drawCar(width * 0.5 + g.x * width * 0.25, height * 0.79, clamp(width / 440, 0.72, 1.25));

      ctx.fillStyle = "rgba(8,7,18,.72)"; ctx.fillRect(12, 12, 138, 62);
      ctx.fillStyle = "#c4b5fd"; ctx.font = "bold 10px Arial"; ctx.fillText("RACING", 22, 28);
      ctx.fillStyle = "#fff"; ctx.font = "bold 27px Arial"; ctx.fillText(String(Math.round(g.speed)), 20, 55);
      ctx.fillStyle = "#c4b5fd"; ctx.font = "10px Arial"; ctx.fillText("KM/H", 86, 54);
      ctx.fillStyle = "rgba(8,7,18,.72)"; ctx.fillRect(width - 94, 12, 82, 46);
      ctx.fillStyle = "#c4b5fd"; ctx.font = "bold 10px Arial"; ctx.textAlign = "right";
      ctx.fillText("LAP", width - 22, 28);
      ctx.fillStyle = "#fff"; ctx.font = "bold 23px Arial"; ctx.fillText(String(g.lap), width - 22, 49);
      ctx.textAlign = "left";

      if (!g.running) {
        ctx.fillStyle = "rgba(5,4,12,.4)"; ctx.fillRect(0, 0, width, height);
        ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "900 29px Arial";
        ctx.fillText("RACING", width / 2, height * 0.31);
        ctx.fillStyle = "#c4b5fd"; ctx.font = "bold 12px Arial";
        ctx.fillText("ARCADE MOTORSPORT", width / 2, height * 0.31 + 24);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px Arial";
        ctx.fillText("PRESS START TO DRIVE", width / 2, height * 0.47);
        ctx.textAlign = "left";
      }
      if (now < g.messageUntil) {
        ctx.fillStyle = "rgba(17,12,32,.82)";
        ctx.fillRect(width / 2 - 94, height * 0.18, 188, 36);
        ctx.fillStyle = "#ddd6fe"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
        ctx.fillText(g.message, width / 2, height * 0.18 + 23); ctx.textAlign = "left";
      }
      if (now - lastUi > 100) {
        setSpeed(Math.round(g.speed));
        if (g.running) setLapTime(timeText(g.lapElapsed));
        lastUi = now;
      }
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault();
      if (key === "arrowleft" || key === "a") controlsRef.current.left = true;
      if (key === "arrowright" || key === "d") controlsRef.current.right = true;
      if (key === "arrowup" || key === "w" || key === " ") controlsRef.current.gas = true;
      if (key === "arrowdown" || key === "s") controlsRef.current.brake = true;
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") controlsRef.current.left = false;
      if (key === "arrowright" || key === "d") controlsRef.current.right = false;
      if (key === "arrowup" || key === "w" || key === " ") controlsRef.current.gas = false;
      if (key === "arrowdown" || key === "s") controlsRef.current.brake = false;
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  const button = (label: string, control: Control, extra = "") => (
    <button
      className={`control ${extra}`}
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        setControl(control, true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => { event.preventDefault(); setControl(control, false); }}
      onPointerCancel={() => setControl(control, false)}
      onLostPointerCapture={() => setControl(control, false)}
    >
      {control === "left" ? "◀" : control === "right" ? "▶" : control === "gas" ? "▲" : "▼"}
      <span>{label}</span>
    </button>
  );

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Racing home"><span className="brand-mark">R</span><span>RACING<span className="brand-dot">.</span></span></a>
        <div className="top-pill"><span className="live-dot" /> ARCADE MODE</div>
      </header>

      <section className="intro">
        <p className="eyebrow">MOTORSPORT • YOUR TRACK</p>
        <h1>CHASE THE<br /><span>PERFECT LAP.</span></h1>
        <p className="subtitle">Put your foot down. Nail the corners. Beat your best.</p>
      </section>

      <section className="game-card" aria-label="Racing game">
        <div className="canvas-wrap"><canvas ref={canvasRef} aria-label="Arcade racing track visualization" /></div>
        <div className="telemetry">
          <div className="telemetry-item"><span>SPEED</span><strong>{speed}<small> km/h</small></strong></div>
          <div className="telemetry-item"><span>CURRENT LAP</span><strong>{lapTime}</strong></div>
          <div className="telemetry-item"><span>BEST LAP</span><strong>{bestLap}</strong></div>
        </div>
        <div className="game-actions">
          {!running ? <button className="start-button" onClick={start}>▶ START RACE</button> : <button className="start-button pause-button" onClick={pause}>Ⅱ PAUSE</button>}
          <button className="reset-button" onClick={reset}>↻ RESET</button>
        </div>
        <div className="lap-row"><span>LAST LAP <b>{lastLap}</b></span><span>COMPLETED <b>{completedLaps}</b></span></div>
      </section>

      <section className="controls-panel">
        <div className="controls-heading"><div><p className="eyebrow">DRIVER INPUT</p><h2>Take control</h2></div><span className="touch-badge">TOUCH READY</span></div>
        <div className="controls-layout">
          <div className="steering">{button("LEFT", "left")}{button("RIGHT", "right")}</div>
          <div className="pedals">{button("BRAKE", "brake", "brake-control")}{button("THROTTLE", "gas", "gas-control")}</div>
        </div>
        <p className="hint">Desktop: use ← → to steer, ↑ to accelerate and ↓ to brake. Mobile: press and hold the touch controls.</p>
      </section>

      <footer className="footer"><span>RACING<span className="brand-dot">.</span></span><span>BUILD YOUR LINE. SET YOUR TIME.</span></footer>
    </main>
  );
}
