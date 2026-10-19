"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Control = "left" | "right" | "gas" | "brake";
type Controls = Record<Control, boolean>;
const emptyControls: Controls = { left: false, right: false, gas: false, brake: false };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmtTime = (v: number) => {
  const t = Math.max(0, v);
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + (t % 60).toFixed(3).padStart(6, "0");
};

export default function HomePage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls>({ ...emptyControls });
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [gear, setGear] = useState(1);
  const [rpm, setRpm] = useState(4000);
  const [lap, setLap] = useState(1);
  const [lapTime, setLapTime] = useState("00:00.000");
  const [lastLap, setLastLap] = useState("--:--.---");
  const [bestLap, setBestLap] = useState("--:--.---");
  const [message, setMessage] = useState("READY ON THE GRID");
  const [trackState, setTrackState] = useState("ON TRACK");
  const [progress, setProgress] = useState(0);

  const reset = useCallback(() => {
    controlsRef.current = { ...emptyControls };
    window.dispatchEvent(new CustomEvent("racing-reset"));
    setRunning(false); setSpeed(0); setGear(1); setRpm(4000); setLap(1);
    setLapTime("00:00.000"); setLastLap("--:--.---"); setBestLap("--:--.---");
    setMessage("READY ON THE GRID"); setTrackState("ON TRACK"); setProgress(0);
  }, []);
  const start = useCallback(() => {
    window.dispatchEvent(new CustomEvent("racing-start"));
    controlsRef.current = { ...emptyControls };
    setRunning(true); setMessage("LIGHTS OUT — GO!");
  }, []);
  const pause = useCallback(() => {
    window.dispatchEvent(new CustomEvent("racing-pause"));
    controlsRef.current = { ...emptyControls };
    setRunning(false); setMessage("SESSION PAUSED");
  }, []);
  const setControl = useCallback((control: Control, pressed: boolean) => { controlsRef.current[control] = pressed; }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setMessage("3D GRAPHICS NOT SUPPORTED");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a9c0d0");
    scene.fog = new THREE.Fog("#a9c0d0", 85, 230);
    const camera = new THREE.PerspectiveCamera(66, mount.clientWidth / mount.clientHeight, 0.1, 350);
    scene.add(new THREE.HemisphereLight("#eaf4ff", "#48533e", 2.2));
    const sun = new THREE.DirectionalLight("#fff0d7", 3);
    sun.position.set(-45, 70, -25); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);

    const material = (color: string, roughness = 0.8, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), material("#477348"));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.12; ground.receiveShadow = true; scene.add(ground);

    // Yas Marina-inspired layout: long start/finish straight, tight hairpins,
    // a flowing middle sector and a technical final sector (not a surveyed replica).
    const trackPoints = [
      new THREE.Vector3(-22, 0, 15), new THREE.Vector3(17, 0, 15),
      new THREE.Vector3(25, 0, 12), new THREE.Vector3(27, 0, 7),
      new THREE.Vector3(23, 0, 3), new THREE.Vector3(5, 0, 3),
      new THREE.Vector3(0, 0, -1), new THREE.Vector3(4, 0, -7),
      new THREE.Vector3(20, 0, -13), new THREE.Vector3(23, 0, -19),
      new THREE.Vector3(18, 0, -25), new THREE.Vector3(5, 0, -27),
      new THREE.Vector3(-5, 0, -25), new THREE.Vector3(-9, 0, -20),
      new THREE.Vector3(-8, 0, -12), new THREE.Vector3(-13, 0, -7),
      new THREE.Vector3(-23, 0, -5), new THREE.Vector3(-28, 0, -1),
      new THREE.Vector3(-27, 0, 5), new THREE.Vector3(-22, 0, 15)
    ];
    const centerCurve = new THREE.CatmullRomCurve3(trackPoints, true, "centripetal");
    const samples = centerCurve.getSpacedPoints(420);
    const offsetPoints = (distance: number) => samples.slice(0, -1).map((p, i) => {
      const tangent = samples[Math.min(i + 1, samples.length - 1)].clone().sub(samples[Math.max(0, i - 1)]).normalize();
      return new THREE.Vector2(p.x - tangent.z * distance, p.z + tangent.x * distance);
    });
    const addRibbon = (outerDistance: number, innerDistance: number, color: string, y: number) => {
      const outer = offsetPoints(outerDistance);
      const inner = offsetPoints(innerDistance).reverse();
      const shape = new THREE.Shape();
      outer.forEach((p, i) => i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y));
      shape.closePath();
      const hole = new THREE.Path();
      inner.forEach((p, i) => i === 0 ? hole.moveTo(p.x, p.y) : hole.lineTo(p.x, p.y));
      hole.closePath(); shape.holes.push(hole);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 2), material(color, 0.95));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; scene.add(mesh);
    };
    // Wide sandy run-off, a darker asphalt strip, then painted edge lines.
    addRibbon(13.5, 6.6, "#b7a47f", -0.035);
    addRibbon(6.6, -6.6, "#303238", 0.006);
    const addTrackLine = (distance: number, color: string, radius: number) => {
      const pts = centerCurve.getSpacedPoints(420).map((p, i, arr) => {
        const tangent = arr[(i + 1) % arr.length].clone().sub(arr[(i - 1 + arr.length) % arr.length]).normalize();
        return new THREE.Vector3(p.x - tangent.z * distance, 0.055, p.z + tangent.x * distance);
      });
      const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 420, radius, 5, true), material(color)));
    };
    addTrackLine(6.25, "#f5f2e9", 0.12);
    addTrackLine(-6.25, "#f5f2e9", 0.12);
    addTrackLine(0, "#bfc1c4", 0.035);

    // Red/white kerbs placed along alternating sections of the track edge.
    const curbWhite = material("#f6f3e9");
    const curbRed = material("#d93d4c");
    for (let i = 0; i < 170; i++) {
      const p = centerCurve.getPointAt(i / 170);
      const t = centerCurve.getTangentAt(i / 170).normalize();
      const n = new THREE.Vector3(-t.z, 0, t.x);
      for (const side of [-1, 1]) {
        if ((i % 17 < 7) || (i % 29 < 9)) {
          const curb = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.075, 0.52), i % 2 ? curbWhite : curbRed);
          curb.position.set(p.x + n.x * side * 6.45, 0.075, p.z + n.z * side * 6.45);
          curb.rotation.y = Math.atan2(t.x, t.z);
          scene.add(curb);
        }
      }
    }
    // A recognizable start/finish stripe across the main straight.
    const startLine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 12.2), material("#ffffff", 0.65));
    startLine.position.set(-14, 0.03, 15); scene.add(startLine);
    const standMat = material("#2b303a");
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const stand = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 3), standMat);
      stand.position.set(Math.sin(a) * 35, 1.1, Math.cos(a) * 43);
      stand.lookAt(0, 1, 0); stand.castShadow = true; scene.add(stand);
    }

    const car = new THREE.Group();
    const body = (w: number, h: number, l: number, color: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), color);
      m.position.set(x, y, z); m.castShadow = true; car.add(m); return m;
    };
    const purple = material("#7629d8", 0.3, 0.2);
    const lilac = material("#c0a2ff", 0.32, 0.15);
    const black = material("#101216", 0.58);
    const glass = material("#20384c", 0.18, 0.35);
    body(1.7, 0.17, 1.1, purple, 0, 0.42, -0.3);
    body(0.68, 0.23, 2.7, purple, 0, 0.43, 0.5);
    body(0.26, 0.16, 2.3, lilac, 0, 0.55, 0.65);
    body(0.4, 0.2, 0.65, black, 0, 0.56, -0.95);
    body(1.85, 0.13, 0.35, lilac, 0, 0.48, 1.75);
    body(1.95, 0.17, 0.28, black, 0, 0.8, -1.45);
    body(0.12, 0.55, 0.14, purple, 0, 0.61, -1.45);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), glass);
    cockpit.scale.set(0.72, 0.72, 1.15); cockpit.position.set(0, 0.68, 0.02); cockpit.castShadow = true; car.add(cockpit);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 20, Math.PI), lilac);
    halo.rotation.x = Math.PI / 2; halo.position.set(0, 0.85, 0.12); car.add(halo);
    const wheels: THREE.Mesh[] = [];
    for (const x of [-0.91, 0.91]) for (const z of [-1.05, 1.12]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 18), black);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.36, z); wheel.castShadow = true; car.add(wheel); wheels.push(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.29, 12), material("#aaaeb8", 0.4, 0.5));
      hub.rotation.z = Math.PI / 2; hub.position.set(x * 1.01, 0.36, z); car.add(hub);
    }
    scene.add(car);

    const sim = { running: false, speed: 0, angle: 0, lateral: 0, lateralVelocity: 0, steer: 0,
      lapElapsed: 0, lap: 1, lapTimes: [] as number[], offTrack: false, lastUi: 0, lastFrame: 0 };
    const updateCarAndCamera = () => {
      const u = ((sim.angle / (Math.PI * 2)) % 1 + 1) % 1;
      const center = centerCurve.getPointAt(u);
      const tangent = centerCurve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      car.position.set(center.x + normal.x * sim.lateral, 0, center.z + normal.z * sim.lateral);
      car.rotation.y = Math.atan2(tangent.x, tangent.z) + sim.steer * 0.08;
      wheels.forEach(w => { w.rotation.x += sim.speed * 0.0008; });
      const behind = new THREE.Vector3(0, 3.7, -8.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y).add(car.position);
      camera.position.lerp(behind, 0.14);
      const target = car.position.clone().add(new THREE.Vector3(0, 0.7, 4.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y));
      camera.lookAt(target);
    };
    updateCarAndCamera();

    const onStart = () => { sim.running = true; sim.lastFrame = 0; };
    const onPause = () => { sim.running = false; controlsRef.current = { ...emptyControls }; };
    const onReset = () => {
      Object.assign(sim, { running: false, speed: 0, angle: 0, lateral: 0, lateralVelocity: 0, steer: 0, lapElapsed: 0, lap: 1, lapTimes: [], offTrack: false, lastFrame: 0 });
      updateCarAndCamera();
    };
    window.addEventListener("racing-start", onStart);
    window.addEventListener("racing-pause", onPause);
    window.addEventListener("racing-reset", onReset);

    let raf = 0;
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = sim.lastFrame ? Math.min((now - sim.lastFrame) / 1000, 0.04) : 0;
      sim.lastFrame = now;
      if (sim.running && dt > 0) {
        const c = controlsRef.current;
        const throttle = c.gas ? 1 : 0;
        const brake = c.brake ? 1 : 0;
        const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        const speedMs = sim.speed / 3.6;
        const drag = 0.006 * sim.speed + 0.00009 * sim.speed * sim.speed;
        sim.speed = clamp(sim.speed + (throttle * (12.5 - speedMs * 0.012) - brake * 25 - drag - (throttle ? 0 : 1.2)) * dt * 3.6, 0, 335);
        sim.steer += (steer - sim.steer) * Math.min(1, dt * (sim.speed > 180 ? 4 : 7));
        const grip = clamp(1 - Math.max(0, sim.speed - 190) / 240, 0.28, 1);
        sim.lateralVelocity += sim.steer * (4.4 + sim.speed / 70) * grip * dt;
        sim.lateralVelocity *= Math.max(0, 1 - dt * (sim.speed > 180 ? 1.4 : 2.6));
        sim.lateral = clamp(sim.lateral + sim.lateralVelocity * dt, -8, 8);
        sim.offTrack = Math.abs(sim.lateral) > 5.35;
        if (sim.offTrack) sim.speed = Math.max(0, sim.speed - 36 * dt);
        sim.angle += ((sim.speed / 3.6) / Math.max(22, centerCurve.getLength() / (Math.PI * 2))) * dt * (Math.PI * 2);
        sim.lapElapsed += dt;
        if (sim.angle >= Math.PI * 2) {
          sim.angle -= Math.PI * 2; sim.lapTimes.push(sim.lapElapsed); sim.lap += 1; sim.lapElapsed = 0;
          const last = sim.lapTimes[sim.lapTimes.length - 1];
          setLastLap(fmtTime(last)); setBestLap(fmtTime(Math.min(...sim.lapTimes)));
          setLap(sim.lap); setMessage("LAP " + (sim.lap - 1) + " COMPLETE");
        }
        if (now - sim.lastUi > 100) {
          setSpeed(Math.round(sim.speed)); setGear(clamp(Math.floor(sim.speed / 42) + 1, 1, 8));
          setRpm(Math.round(3500 + (sim.speed % 42) / 42 * 5500));
          setLapTime(fmtTime(sim.lapElapsed)); setTrackState(sim.offTrack ? "OFF TRACK · LOW GRIP" : "ON TRACK");
          setProgress(Math.round(sim.angle / (Math.PI * 2) * 100)); sim.lastUi = now;
        }
      }
      updateCarAndCamera(); renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const keyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
      if (k === "arrowleft" || k === "a") controlsRef.current.left = true;
      if (k === "arrowright" || k === "d") controlsRef.current.right = true;
      if (k === "arrowup" || k === "w" || k === " ") controlsRef.current.gas = true;
      if (k === "arrowdown" || k === "s") controlsRef.current.brake = true;
      if (k === "escape") onPause();
    };
    const keyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") controlsRef.current.left = false;
      if (k === "arrowright" || k === "d") controlsRef.current.right = false;
      if (k === "arrowup" || k === "w" || k === " ") controlsRef.current.gas = false;
      if (k === "arrowdown" || k === "s") controlsRef.current.brake = false;
    };
    window.addEventListener("resize", resize); window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
      window.removeEventListener("racing-start", onStart); window.removeEventListener("racing-pause", onPause); window.removeEventListener("racing-reset", onReset);
      renderer.dispose(); if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); } });
    };
  }, []);

  const button = (label: string, control: Control, cls = "") => (
    <button key={control} className={"sim-control " + cls} type="button" aria-label={label}
      onPointerDown={e => { e.preventDefault(); setControl(control, true); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={e => { e.preventDefault(); setControl(control, false); }}
      onPointerCancel={() => setControl(control, false)} onLostPointerCapture={() => setControl(control, false)}>
      {control === "left" ? "◀" : control === "right" ? "▶" : control === "gas" ? "▲" : "▼"}<span>{label}</span>
    </button>
  );

  return (
    <main className="sim-shell">
      <header className="sim-topbar"><a className="sim-brand" href="#"><span className="sim-brand-mark">R</span> RACING<span className="sim-brand-dot">.</span></a><div className="sim-mode"><span className="sim-live" /> 3D DRIVER SIM</div></header>
      <section className="sim-intro"><p className="sim-eyebrow">SINGLE-SEATER • CHASE CAMERA</p><h1>OWN THE <span>RACING LINE.</span></h1><p>Build speed on the straights. Brake early. Keep the car on the racing line.</p></section>
      <section className="sim-game" aria-label="3D driving simulator">
        <div className="sim-view"><div className="sim-world" ref={mountRef} />
          <div className="sim-overlay sim-overlay-top"><span className={trackState.startsWith("OFF") ? "state-warning" : ""}>{trackState}</span><span>SESSION · PRACTICE</span></div>
          <div className="speed-hud"><strong>{speed}</strong><span>KM/H</span><i>GEAR <b>{gear}</b></i></div>
          <div className="rpm-hud"><span>RPM</span><div className="rpm-bar"><i style={{ width: clamp((rpm - 3000) / 6000 * 100, 0, 100) + "%" }} /></div><b>{rpm.toLocaleString()}</b></div>
          <div className="lap-hud"><span>LAP</span><b>{String(lap).padStart(2, "0")}</b><small>{progress}%</small><div className="lap-progress"><i style={{ width: progress + "%" }} /></div></div>
          {!running && <div className="sim-ready"><span>RACING SIMULATOR</span><b>{message}</b><small>Use the controls to accelerate and steer</small></div>}
        </div>
        <div className="sim-telemetry"><div><span>SESSION TIME</span><strong>{lapTime}</strong></div><div><span>LAST LAP</span><strong>{lastLap}</strong></div><div><span>PERSONAL BEST</span><strong>{bestLap}</strong></div></div>
        <div className="sim-actions">{!running ? <button className="sim-start" onClick={start}>▶ START SESSION</button> : <button className="sim-start sim-pause" onClick={pause}>Ⅱ PAUSE SESSION</button>}<button className="sim-reset" onClick={reset}>↻ RESET</button></div>
      </section>
      <section className="sim-controls-panel"><div className="sim-controls-head"><div><p className="sim-eyebrow">DRIVER INPUT</p><h2>Controls</h2></div><span>HOLD TO INPUT</span></div>
        <div className="sim-controls-layout"><div className="sim-steering">{button("STEER LEFT", "left")}{button("STEER RIGHT", "right")}</div><div className="sim-pedals">{button("BRAKE", "brake", "sim-brake")}{button("THROTTLE", "gas", "sim-gas")}</div></div>
        <p className="sim-hint">Keyboard: ← → steer · ↑ / W throttle · ↓ / S brake · ESC pause. Mobile: hold the on-screen controls.</p>
      </section>
      <footer className="sim-footer"><span>RACING<span className="sim-brand-dot">.</span></span><span>SMOOTH INPUT. CLEAN LINES. FAST LAPS.</span></footer>
    </main>
  );
}
