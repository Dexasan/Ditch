import { create } from "zustand";

export interface Scene {
  id: string;
  name: string;
}

interface StudioStore {
  // Relay / Go Live
  streamingEnabled: boolean;
  streaming: boolean;
  streamError: string | null;
  setStreamingEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  setStreaming: (v: boolean) => void;
  setStreamError: (v: string | null) => void;

  // Layer visibility
  camVisible: boolean;
  setCamVisible: (v: boolean) => void;

  // Scenes
  scenes: Scene[];
  activeSceneId: string;
  addScene: () => void;
  switchScene: (id: string) => void;
}

const INITIAL_SCENE_ID = "scene-1";

export const useStudioStore = create<StudioStore>((set) => ({
  // Relay
  streamingEnabled: false,
  streaming: false,
  streamError: null,
  setStreamingEnabled: (v) =>
    set((s) => ({
      streamingEnabled: typeof v === "function" ? v(s.streamingEnabled) : v,
    })),
  setStreaming: (v) => set({ streaming: v }),
  setStreamError: (v) => set({ streamError: v }),

  // Layers
  camVisible: true,
  setCamVisible: (v) => set({ camVisible: v }),

  // Scenes
  scenes: [{ id: INITIAL_SCENE_ID, name: "Scene 1" }],
  activeSceneId: INITIAL_SCENE_ID,
  addScene: () =>
    set((s) => {
      const id = `scene-${Date.now()}`;
      return {
        scenes: [...s.scenes, { id, name: `Scene ${s.scenes.length + 1}` }],
        activeSceneId: id,
      };
    }),
  switchScene: (id) => set({ activeSceneId: id }),
}));
