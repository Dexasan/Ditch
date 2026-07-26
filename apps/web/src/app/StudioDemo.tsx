"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./StudioDemo.module.css";

type LayerKind = "camera" | "guest" | "screen" | "text" | "logo" | "shape";

type DemoLayer = {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  detail?: string;
  color?: string;
};

type DemoScene = {
  id: string;
  name: string;
  accent: string;
  layers: DemoLayer[];
};

const STARTING_SCENES: DemoScene[] = [
  {
    id: "intro",
    name: "Intro",
    accent: "#ff1db4",
    layers: [
      { id: "intro-camera", kind: "camera", name: "Host camera", visible: true, opacity: 100, x: 6, y: 12, width: 46, height: 75, text: "YOU", detail: "Host" },
      { id: "intro-title", kind: "text", name: "Show title", visible: true, opacity: 100, x: 58, y: 28, width: 35, height: 28, text: "THE\nAFTERSHOW", detail: "LIVE EVERY FRIDAY" },
      { id: "intro-logo", kind: "logo", name: "DITCH bug", visible: true, opacity: 100, x: 81, y: 7, width: 12, height: 9, text: "DITCH" },
    ],
  },
  {
    id: "interview",
    name: "Interview",
    accent: "#00d4aa",
    layers: [
      { id: "interview-host", kind: "camera", name: "Host camera", visible: true, opacity: 100, x: 5, y: 9, width: 43, height: 72, text: "YOU", detail: "Host" },
      { id: "interview-guest", kind: "guest", name: "Guest: Maya", visible: true, opacity: 100, x: 52, y: 9, width: 43, height: 72, text: "M", detail: "Maya from Twitch" },
      { id: "interview-title", kind: "text", name: "Lower third", visible: true, opacity: 100, x: 5, y: 83, width: 62, height: 11, text: "DITCH CREATOR SESSIONS", detail: "BUILDING SHOWS PEOPLE CAN JOIN" },
    ],
  },
  {
    id: "screen",
    name: "Screen share",
    accent: "#7c6cff",
    layers: [
      { id: "screen-source", kind: "screen", name: "Browser source", visible: true, opacity: 100, x: 4, y: 7, width: 92, height: 86 },
      { id: "screen-camera", kind: "camera", name: "Host camera", visible: true, opacity: 100, x: 72, y: 61, width: 21, height: 28, text: "YOU", detail: "Host" },
      { id: "screen-logo", kind: "logo", name: "DITCH bug", visible: true, opacity: 100, x: 7, y: 10, width: 11, height: 8, text: "DITCH" },
    ],
  },
];

const SOURCES: { kind: LayerKind; label: string; code: string }[] = [
  { kind: "camera", label: "Camera", code: "CAM" },
  { kind: "guest", label: "Guest", code: "GST" },
  { kind: "screen", label: "Screen", code: "SCR" },
  { kind: "text", label: "Text", code: "TXT" },
  { kind: "logo", label: "Logo", code: "LOG" },
  { kind: "shape", label: "Shape", code: "SHP" },
];

function freshScenes() {
  return STARTING_SCENES.map((scene) => ({ ...scene, layers: scene.layers.map((layer) => ({ ...layer })) }));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function CameraFeed({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    void ref.current.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} muted playsInline className={styles.cameraVideo} />;
}

function LayerArtwork({ layer, cameraStream }: { layer: DemoLayer; cameraStream: MediaStream | null }) {
  if (layer.kind === "camera" || layer.kind === "guest") {
    return (
      <div className={`${styles.personSource} ${layer.kind === "guest" ? styles.guestSource : ""}`}>
        {layer.kind === "camera" && cameraStream
          ? <CameraFeed stream={cameraStream} />
          : <span className={styles.personAvatar}>{layer.text}</span>}
        <span className={styles.sourceName}>{layer.detail}<i /></span>
      </div>
    );
  }
  if (layer.kind === "text") {
    return <div className={styles.textSource}><strong>{layer.text}</strong>{layer.detail && <small>{layer.detail}</small>}</div>;
  }
  if (layer.kind === "logo") return <div className={styles.logoSource}>{layer.text ?? "LOGO"}</div>;
  if (layer.kind === "shape") return <div className={styles.shapeSource} style={{ background: layer.color }} />;
  return (
    <div className={styles.screenSource}>
      <div className={styles.browserBar}><i /><i /><i /><span /></div>
      <div className={styles.browserBody}>
        <aside><b />{[72, 88, 61, 79].map((width) => <i key={width} style={{ width: `${width}%` }} />)}</aside>
        <main><strong /><div>{[48, 76, 58, 88, 68, 94].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></main>
      </div>
    </div>
  );
}

export default function StudioDemo() {
  const [scenes, setScenes] = useState<DemoScene[]>(freshScenes);
  const [activeSceneId, setActiveSceneId] = useState("intro");
  const [selectedId, setSelectedId] = useState<string | null>("intro-title");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [message, setMessage] = useState("Try it: switch scenes, add a layer, or drag anything on the canvas.");
  const [transitioning, setTransitioning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const activeScene = useMemo(() => scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0], [activeSceneId, scenes]);
  const selectedLayer = activeScene.layers.find((layer) => layer.id === selectedId) ?? null;

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  function updateScene(updater: (scene: DemoScene) => DemoScene) {
    setScenes((current) => current.map((scene) => scene.id === activeSceneId ? updater(scene) : scene));
  }

  function updateLayer(id: string, patch: Partial<DemoLayer>) {
    updateScene((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer),
    }));
  }

  function switchScene(id: string) {
    const target = scenes.find((scene) => scene.id === id);
    if (!target) return;
    setActiveSceneId(id);
    setSelectedId(target.layers[0]?.id ?? null);
    setTransitioning(true);
    window.setTimeout(() => setTransitioning(false), 260);
    setMessage(`${target.name} is now in preview.`);
  }

  function addScene() {
    const number = scenes.length + 1;
    const id = makeId("scene");
    setScenes((current) => [...current, { id, name: `Scene ${number}`, accent: "#ff1db4", layers: [] }]);
    setActiveSceneId(id);
    setSelectedId(null);
    setMessage(`Scene ${number} created. Add its first layer.`);
  }

  async function addLayer(kind: LayerKind) {
    let camera = cameraStream;
    if (kind === "camera" && !camera) {
      try {
        camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = camera;
        setCameraStream(camera);
        setMessage("Camera added locally. Nothing in this demo is broadcast.");
      } catch {
        setMessage("Camera permission was not granted, so a demo camera was added.");
      }
    }

    const id = makeId(kind);
    const defaults: Record<LayerKind, Omit<DemoLayer, "id" | "kind" | "visible" | "opacity">> = {
      camera: { name: "My camera", x: 7, y: 12, width: 43, height: 72, text: "YOU", detail: camera ? "Your camera" : "Demo camera" },
      guest: { name: "Guest slot", x: 53, y: 14, width: 39, height: 66, text: "G", detail: "Guest from DITCH" },
      screen: { name: "Screen share", x: 6, y: 8, width: 88, height: 84 },
      text: { name: "New title", x: 54, y: 31, width: 38, height: 25, text: "YOUR TITLE", detail: "CLICK TO EDIT" },
      logo: { name: "Logo", x: 80, y: 7, width: 13, height: 10, text: "YOUR LOGO" },
      shape: { name: "Color block", x: 12, y: 18, width: 34, height: 38, color: "#7c6cff" },
    };
    const layer: DemoLayer = { id, kind, visible: true, opacity: 100, ...defaults[kind] };
    updateScene((scene) => ({ ...scene, layers: [...scene.layers, layer] }));
    setSelectedId(id);
    setMenuOpen(false);
    if (kind !== "camera") setMessage(`${layer.name} added. Drag it into place.`);
  }

  function removeLayer() {
    if (!selectedLayer) return;
    updateScene((scene) => ({ ...scene, layers: scene.layers.filter((layer) => layer.id !== selectedLayer.id) }));
    setSelectedId(null);
    setMessage(`${selectedLayer.name} removed.`);
  }

  function reorderLayer(id: string, direction: -1 | 1) {
    updateScene((scene) => {
      const index = scene.layers.findIndex((layer) => layer.id === id);
      const next = index + direction;
      if (next < 0 || next >= scene.layers.length) return scene;
      const layers = [...scene.layers];
      [layers[index], layers[next]] = [layers[next], layers[index]];
      return { ...scene, layers };
    });
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, layer: DemoLayer) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: layer.id,
      offsetX: ((event.clientX - bounds.left) / bounds.width) * 100 - layer.x,
      offsetY: ((event.clientY - bounds.top) / bounds.height) * 100 - layer.y,
    };
    setSelectedId(layer.id);
  }

  function moveLayer(event: ReactPointerEvent<HTMLDivElement>, layer: DemoLayer) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    const drag = dragRef.current;
    if (!bounds || !drag || drag.id !== layer.id) return;
    updateLayer(layer.id, {
      x: Math.max(0, Math.min(100 - layer.width, ((event.clientX - bounds.left) / bounds.width) * 100 - drag.offsetX)),
      y: Math.max(0, Math.min(100 - layer.height, ((event.clientY - bounds.top) / bounds.height) * 100 - drag.offsetY)),
    });
  }

  function reset() {
    setScenes(freshScenes());
    setActiveSceneId("intro");
    setSelectedId("intro-title");
    setMessage("Demo reset. Make it yours.");
  }

  return (
    <div className={styles.demoWrap}>
      <div className={styles.tryLabel}><i /> LIVE PRODUCT DEMO <span>Nothing is broadcast</span></div>
      <div className={styles.studio}>
        <header className={styles.topbar}>
          <div className={styles.studioMark}>D</div><strong>ditch studio</strong><span className={styles.demoPill}>demo</span>
          <div className={styles.metrics}><span>PREVIEW</span><span><b>30</b> FPS</span><span><b>1080p</b></span></div>
          <button type="button" onClick={reset} className={styles.resetButton}>Reset</button>
          <Link href="/auth" className={styles.liveButton}><i /> Take it live</Link>
        </header>

        <div className={styles.studioBody}>
          <aside className={styles.scenePanel}>
            <PanelHeader title="Scenes" action={addScene} />
            <div className={styles.sceneList}>
              {scenes.map((scene, index) => (
                <button type="button" key={scene.id} onClick={() => switchScene(scene.id)} className={`${styles.sceneCard} ${scene.id === activeSceneId ? styles.sceneActive : ""}`}>
                  <span className={styles.sceneThumb} style={{ "--scene-accent": scene.accent } as CSSProperties}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    {scene.layers.some((layer) => layer.kind === "camera") && <b />}
                    {scene.layers.some((layer) => layer.kind === "guest") && <em />}
                    {scene.layers.some((layer) => layer.kind === "screen") && <strong />}
                  </span>
                  <small>{scene.name}</small>
                </button>
              ))}
              <button type="button" className={styles.addSceneCard} onClick={addScene}>+ Add scene</button>
            </div>
          </aside>

          <main className={styles.previewPanel}>
            <div className={styles.previewHeader}><span>Preview / {activeScene.name}</span><b><i /> Signal ready</b></div>
            <div ref={canvasRef} className={`${styles.stage} ${transitioning ? styles.stageTransition : ""}`} style={{ "--scene-accent": activeScene.accent } as CSSProperties} onClick={() => setSelectedId(null)}>
              <div className={styles.stageGrid} />
              {activeScene.layers.map((layer, index) => layer.visible && (
                <div
                  key={layer.id}
                  className={`${styles.canvasLayer} ${layer.id === selectedId ? styles.canvasLayerSelected : ""}`}
                  style={{ left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.width}%`, height: `${layer.height}%`, opacity: layer.opacity / 100, zIndex: index + 2 }}
                  onClick={(event) => { event.stopPropagation(); setSelectedId(layer.id); }}
                  onPointerDown={(event) => startDrag(event, layer)}
                  onPointerMove={(event) => moveLayer(event, layer)}
                  onPointerUp={() => { dragRef.current = null; }}
                >
                  <LayerArtwork layer={layer} cameraStream={cameraStream} />
                  {layer.id === selectedId && <><i className={styles.handleOne} /><i className={styles.handleTwo} /><i className={styles.handleThree} /><i className={styles.handleFour} /></>}
                </div>
              ))}
              {activeScene.layers.length === 0 && <div className={styles.emptyStage}><b>Your scene is empty</b><span>Add a source from the layers panel</span></div>}
            </div>
            <div className={styles.hintBar}><i /><span>{message}</span><b>16:9</b></div>
          </main>

          <aside className={styles.layerPanel}>
            <div className={styles.panelHeader}>
              <b>Layers</b>
              <div className={styles.addMenuWrap}>
                <button type="button" className={styles.addButton} onClick={() => setMenuOpen((value) => !value)}>+ Add</button>
                {menuOpen && <div className={styles.addMenu}>{SOURCES.map((source) => <button type="button" key={source.kind} onClick={() => void addLayer(source.kind)}><span>{source.code}</span>{source.label}</button>)}</div>}
              </div>
            </div>
            <div className={styles.layerList}>
              {[...activeScene.layers].reverse().map((layer) => (
                <button type="button" key={layer.id} className={`${styles.layerRow} ${layer.id === selectedId ? styles.layerSelected : ""} ${!layer.visible ? styles.layerHidden : ""}`} onClick={() => setSelectedId(layer.id)}>
                  <span>{layer.kind.slice(0, 3)}</span><b>{layer.name}</b>
                  <i role="button" tabIndex={0} aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`} onClick={(event) => { event.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}>{layer.visible ? "ON" : "OFF"}</i>
                </button>
              ))}
            </div>
            <div className={styles.properties}>
              <h4>Properties</h4>
              {selectedLayer ? <>
                {(selectedLayer.kind === "text" || selectedLayer.kind === "logo") && <label><span>Text</span><input value={selectedLayer.text ?? ""} onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })} /></label>}
                <Range label="Size" value={selectedLayer.width} onChange={(width) => updateLayer(selectedLayer.id, { width, height: Math.min(92, Math.max(8, selectedLayer.height * (width / selectedLayer.width))) })} />
                <Range label="Opacity" value={selectedLayer.opacity} onChange={(opacity) => updateLayer(selectedLayer.id, { opacity })} />
                <div className={styles.layerActions}>
                  <button type="button" onClick={() => reorderLayer(selectedLayer.id, 1)}>Up</button>
                  <button type="button" onClick={() => reorderLayer(selectedLayer.id, -1)}>Down</button>
                  <button type="button" onClick={removeLayer}>Delete</button>
                </div>
              </> : <p>Select a layer to edit it.</p>}
            </div>
          </aside>
        </div>

        <footer className={styles.mixer}>
          <div><b>Mixer</b><span>Mic</span><i>{Array.from({ length: 14 }).map((_, index) => <em key={index} className={index < 8 ? styles.meterOn : index < 11 ? styles.meterWarn : ""} />)}</i></div>
          <p>{["Twitch", "YouTube", "TikTok", "Kick"].map((platform) => <span key={platform}>{platform}</span>)}</p>
          <strong><i /> OFFLINE</strong>
        </footer>
      </div>
      <p className={styles.demoCaption}><span>Real controls. Local demo state. Zero setup.</span><b>Build your first scene before you create an account.</b></p>
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action: () => void }) {
  return <div className={styles.panelHeader}><b>{title}</b><button type="button" onClick={action} aria-label={`Add ${title.toLowerCase()}`}>+</button></div>;
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span>{label} <b>{Math.round(value)}%</b></span><input type="range" min="10" max={label === "Opacity" ? 100 : 95} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
