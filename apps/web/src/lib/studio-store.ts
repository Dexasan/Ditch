import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StreamPlatform } from "@ditch/types";

export type CamCell = { x: number; y: number; w: number; h: number };

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export interface LayerSnapshot {
  sceneId: string;
  layers: Layer[];
}

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
  sourceUnavailable?: boolean;
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
  platform: StreamPlatform;
  label: string;
  streamKey: string;
}

export type EncoderPreset = "quality" | "balanced" | "performance";
export type OutputResolution = "720p" | "1080p";

interface StudioSettings {
  destinations: Destination[];
  streamTitle: string;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  encoderPreset: EncoderPreset;
  outputResolution: OutputResolution;
}

export interface Scene {
  id: string;
  name: string;
  layers: Layer[];
  audioConfig: AudioConfig;
  transition: SceneTransition;
  thumbnail: string | null;
  bgColor: string;
}

function makeScene(id: string, name: string): Scene {
  return {
    id,
    name,
    layers: [],
    audioConfig: {},
    transition: { type: "cut", durationMs: 0 },
    thumbnail: null,
    bgColor: "#0a0a0a",
  };
}

interface StudioStore {
  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;

  // Undo
  undoStack: LayerSnapshot[];
  pushUndo: (sceneId: string, layers: Layer[]) => void;
  popUndo: () => void;

  // Grid snap
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;

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
  isTransitioning: boolean;
  lastSessionId: string | null;
  transitionKey: number;
  addScene: () => void;
  switchScene: (id: string) => void;
  setSelectedLayerId: (id: string | null) => void;

  // Settings
  settings: StudioSettings;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  addDestination: (dest: Destination) => void;
  removeDestination: (id: string) => void;

  // Scene actions
  updateScene: (sceneId: string, patch: Partial<Omit<Scene, "id" | "layers">>) => void;
  removeScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  resetForNewSession: (sessionId: string) => void;

  // Layer actions
  addLayer: (sceneId: string, layer: Layer) => void;
  removeLayer: (sceneId: string, layerId: string) => void;
  updateLayer: (sceneId: string, layerId: string, patch: Partial<Layer>) => void;
  reorderLayers: (sceneId: string, newOrder: Layer[]) => void;
}

const INITIAL_SCENE_ID = "scene-1";
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

export const useStudioStore = create<StudioStore>()(
  persist(
  (set) => ({
  // Toasts
  toasts: [],
  addToast: (message, type = "info", duration = 3000) =>
    set((s) => ({
      toasts: [{ id: crypto.randomUUID(), message, type, duration }, ...s.toasts],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // Undo
  undoStack: [],
  pushUndo: (sceneId, layers) =>
    set((s) => {
      const snapshot: LayerSnapshot = { sceneId, layers: JSON.parse(JSON.stringify(layers)) };
      const stack = [...s.undoStack, snapshot];
      if (stack.length > 20) stack.shift();
      return { undoStack: stack };
    }),
  popUndo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const snapshot = s.undoStack[s.undoStack.length - 1];
      return {
        undoStack: s.undoStack.slice(0, -1),
        scenes: s.scenes.map((sc) =>
          sc.id === snapshot.sceneId ? { ...sc, layers: snapshot.layers } : sc,
        ),
      };
    }),

  // Grid snap
  snapToGrid: false,
  setSnapToGrid: (v) => set({ snapToGrid: v }),

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
  isTransitioning: false,
  transitionKey: 0,
  lastSessionId: null,
  addScene: () =>
    set((s) => {
      const id = `scene-${Date.now()}`;
      return {
        scenes: [...s.scenes, makeScene(id, `Scene ${s.scenes.length + 1}`)],
        activeSceneId: id,
      };
    }),
  switchScene: (id) =>
    set((s) => {
      const target = s.scenes.find((sc) => sc.id === id);
      const transition = target?.transition ?? { type: "cut", durationMs: 0 };

      if (transition.type === "cut" || transition.durationMs === 0) {
        return { activeSceneId: id, isTransitioning: false };
      }

      if (transitionTimer) clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => {
        useStudioStore.setState({ isTransitioning: false });
        transitionTimer = null;
      }, transition.durationMs);

      return { activeSceneId: id, isTransitioning: true, transitionKey: s.transitionKey + 1 };
    }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),

  resetForNewSession: (sessionId) => set({
    scenes: [makeScene(INITIAL_SCENE_ID, "Scene 1")],
    activeSceneId: INITIAL_SCENE_ID,
    selectedLayerId: null,
    lastSessionId: sessionId,
  }),

  // Settings
  settings: {
    destinations: [],
    streamTitle: "",
    videoBitrateKbps: 4000,
    audioBitrateKbps: 128,
    encoderPreset: "balanced" as EncoderPreset,
    outputResolution: "720p" as OutputResolution,
  },
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
      scenes: s.scenes.map((sc) => sc.id === sceneId ? { ...sc, ...patch } : sc),
    })),

  removeScene: (sceneId) =>
    set((s) => {
      if (s.scenes.length <= 1) return s;
      const newScenes = s.scenes.filter((sc) => sc.id !== sceneId);
      const newActiveId = s.activeSceneId === sceneId ? newScenes[0].id : s.activeSceneId;
      return { scenes: newScenes, activeSceneId: newActiveId };
    }),

  duplicateScene: (sceneId) =>
    set((s) => {
      const src = s.scenes.find((sc) => sc.id === sceneId);
      if (!src) return s;
      const newId = `scene-${Date.now()}`;
      const copy: Scene = {
        ...src,
        id: newId,
        name: `${src.name} (copy)`,
        thumbnail: null,
        layers: src.layers.map((l) => ({ ...l, id: crypto.randomUUID() })),
      };
      const idx = s.scenes.findIndex((sc) => sc.id === sceneId);
      return {
        scenes: [...s.scenes.slice(0, idx + 1), copy, ...s.scenes.slice(idx + 1)],
        activeSceneId: newId,
      };
    }),

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
  }),
  {
    name: "ditch-studio-v1",
    storage: createJSONStorage(() => localStorage),
    // Only persist layout state. Stream status, bitrate, recording, toasts,
    // and undo history are ephemeral — they reset correctly on reload.
    // settings (destinations) intentionally excluded to keep stream keys out of localStorage.
    partialize: (state) => ({
      scenes: state.scenes,
      activeSceneId: state.activeSceneId,
      targetFps: state.targetFps,
      snapToGrid: state.snapToGrid,
      lastSessionId: state.lastSessionId,
    }),
  }
));
