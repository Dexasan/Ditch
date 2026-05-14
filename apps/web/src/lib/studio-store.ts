import { create } from "zustand";

export type CamCell = { x: number; y: number; w: number; h: number };

type LayerType = "camera" | "screenshare" | "media" | "browser" | "image" | "text" | "shape";

interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: Transform;
  sourceConfig: Record<string, unknown>;
  effects: Record<string, unknown>[];
}

interface AudioConfig {
  [sourceId: string]: { muted: boolean; volume: number };
}

interface SceneTransition {
  type: "cut" | "fade" | "slide";
  durationMs: number;
}

export interface Destination {
  id: string;
  platform: "twitch" | "youtube" | "custom";
  label: string;
  streamKey: string;
}

interface StudioSettings {
  destinations: Destination[];
  streamTitle: string;
}

export interface Scene {
  id: string;
  name: string;
  layers: Layer[];
  audioConfig: AudioConfig;
  transition: SceneTransition;
  thumbnail: string | null;
  camCell: CamCell | null; // keep for now, remove in Phase 2
  bgColor: string;
}

function makeCameraLayer(): Layer {
  return {
    id: crypto.randomUUID(),
    type: "camera",
    name: "Camera",
    visible: true,
    locked: false,
    opacity: 100,
    transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
    sourceConfig: {},
    effects: [],
  };
}

function makeScene(id: string, name: string): Scene {
  return {
    id,
    name,
    layers: [makeCameraLayer()],
    audioConfig: {},
    transition: { type: "cut", durationMs: 0 },
    thumbnail: null,
    camCell: null,
    bgColor: "#0a0a0a",
  };
}

interface StudioStore {
  // Stream state
  streamStatus: "offline" | "connecting" | "live";
  streamDuration: number;
  isRecording: boolean;
  streamError: string | null;
  fps: number | null;
  targetFps: 30 | 60;
  bitrateKbps: number;
  setStreamStatus: (status: "offline" | "connecting" | "live") => void;
  setStreamDuration: (seconds: number) => void;
  setIsRecording: (v: boolean) => void;
  setStreamError: (v: string | null) => void;
  setFps: (v: number) => void;
  setTargetFps: (v: 30 | 60) => void;
  setBitrateKbps: (v: number) => void;

  // Scenes
  scenes: Scene[];
  activeSceneId: string;
  selectedLayerId: string | null;
  addScene: () => void;
  switchScene: (id: string) => void;
  setActiveSceneCamCell: (cell: CamCell | null) => void;
  setSelectedLayerId: (id: string | null) => void;

  // Settings
  settings: StudioSettings;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  addDestination: (dest: Destination) => void;
  removeDestination: (id: string) => void;

  // Scene actions
  updateScene: (sceneId: string, patch: Partial<Omit<Scene, "id" | "layers">>) => void;

  // Layer actions
  addLayer: (sceneId: string, layer: Layer) => void;
  removeLayer: (sceneId: string, layerId: string) => void;
  updateLayer: (sceneId: string, layerId: string, patch: Partial<Layer>) => void;
  reorderLayers: (sceneId: string, newOrder: Layer[]) => void;
}

const INITIAL_SCENE_ID = "scene-1";

export const useStudioStore = create<StudioStore>((set) => ({
  // Stream state
  streamStatus: "offline",
  streamDuration: 0,
  isRecording: false,
  streamError: null,
  fps: null,
  targetFps: 30,
  bitrateKbps: 0,
  setStreamStatus: (status) => set({ streamStatus: status }),
  setStreamDuration: (seconds) => set({ streamDuration: seconds }),
  setIsRecording: (v) => set({ isRecording: v }),
  setStreamError: (v) => set({ streamError: v }),
  setFps: (v) => set({ fps: v }),
  setTargetFps: (v) => set({ targetFps: v }),
  setBitrateKbps: (v) => set({ bitrateKbps: v }),

  // Scenes
  scenes: [makeScene(INITIAL_SCENE_ID, "Scene 1")],
  activeSceneId: INITIAL_SCENE_ID,
  selectedLayerId: null,
  addScene: () =>
    set((s) => {
      const id = `scene-${Date.now()}`;
      return {
        scenes: [...s.scenes, makeScene(id, `Scene ${s.scenes.length + 1}`)],
        activeSceneId: id,
      };
    }),
  switchScene: (id) => set({ activeSceneId: id }),
  setActiveSceneCamCell: (cell) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId ? { ...sc, camCell: cell } : sc,
      ),
    })),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),

  // Settings
  settings: { destinations: [], streamTitle: "" },
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  addDestination: (dest) =>
    set((s) => ({ settings: { ...s.settings, destinations: [...s.settings.destinations, dest] } })),
  removeDestination: (id) =>
    set((s) => ({
      settings: { ...s.settings, destinations: s.settings.destinations.filter((d) => d.id !== id) },
    })),

  // Scene actions
  updateScene: (sceneId, patch) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, ...patch } : sc,
      ),
    })),

  // Layer actions
  addLayer: (sceneId, layer) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, layers: [...sc.layers, layer] } : sc,
      ),
    })),
  removeLayer: (sceneId, layerId) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId
          ? { ...sc, layers: sc.layers.filter((l) => l.id !== layerId) }
          : sc,
      ),
    })),
  updateLayer: (sceneId, layerId, patch) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId
          ? {
              ...sc,
              layers: sc.layers.map((l) =>
                l.id === layerId ? { ...l, ...patch } : l,
              ),
            }
          : sc,
      ),
    })),
  reorderLayers: (sceneId, newOrder) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, layers: newOrder } : sc,
      ),
    })),
}));
