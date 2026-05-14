import { create } from "zustand";

export type CamCell = { x: number; y: number; w: number; h: number };

export interface Scene {
  id: string;
  name: string;
  camVisible: boolean;
  screenshareVisible: boolean;
  // null = auto-grid; non-null = custom position (fractions 0–1 of canvas)
  camCell: CamCell | null;
}

interface StudioStore {
  // Relay / Go Live
  streamingEnabled: boolean;
  streaming: boolean;
  streamError: string | null;
  fps: number | null;
  targetFps: 30 | 60;
  setStreamingEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  setStreaming: (v: boolean) => void;
  setStreamError: (v: string | null) => void;
  setFps: (v: number) => void;
  setTargetFps: (v: 30 | 60) => void;

  // Camera — global "has the camera been started" gate
  camEnabled: boolean;
  setCamEnabled: (v: boolean) => void;

  // Scenes — each scene owns its own layer visibility + camera position
  scenes: Scene[];
  activeSceneId: string;
  addScene: () => void;
  switchScene: (id: string) => void;
  setActiveSceneCamVisible: (visible: boolean) => void;
  setActiveSceneCamCell: (cell: CamCell | null) => void;
}

const INITIAL_SCENE_ID = "scene-1";

export const useStudioStore = create<StudioStore>((set) => ({
  // Relay
  streamingEnabled: false,
  streaming: false,
  streamError: null,
  fps: null,
  targetFps: 30,
  setStreamingEnabled: (v) =>
    set((s) => ({
      streamingEnabled: typeof v === "function" ? v(s.streamingEnabled) : v,
    })),
  setStreaming: (v) => set({ streaming: v }),
  setStreamError: (v) => set({ streamError: v }),
  setFps: (v) => set({ fps: v }),
  setTargetFps: (v) => set({ targetFps: v }),

  // Camera
  camEnabled: false,
  setCamEnabled: (v) => set({ camEnabled: v }),

  // Scenes
  scenes: [{ id: INITIAL_SCENE_ID, name: "Scene 1", camVisible: true, screenshareVisible: false, camCell: null }],
  activeSceneId: INITIAL_SCENE_ID,
  addScene: () =>
    set((s) => {
      const id = `scene-${Date.now()}`;
      const current = s.scenes.find((sc) => sc.id === s.activeSceneId);
      return {
        scenes: [
          ...s.scenes,
          {
            id,
            name: `Scene ${s.scenes.length + 1}`,
            camVisible: current?.camVisible ?? true,
            screenshareVisible: false,
            camCell: null,
          },
        ],
        activeSceneId: id,
      };
    }),
  switchScene: (id) => set({ activeSceneId: id }),
  setActiveSceneCamVisible: (visible) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId ? { ...sc, camVisible: visible } : sc,
      ),
    })),
  setActiveSceneCamCell: (cell) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === s.activeSceneId ? { ...sc, camCell: cell } : sc,
      ),
    })),
}));
