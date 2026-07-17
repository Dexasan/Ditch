"use client";

import { useEffect, useRef } from "react";
import type { ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { Layer } from "@/lib/studio-store";
import { useStudioStore } from "@/lib/studio-store";

export function useStudioShortcuts({
  localAudioTrack,
}: {
  localAudioTrack: ILocalAudioTrack | null;
}) {
  const localAudioTrackRef = useRef(localAudioTrack);
  localAudioTrackRef.current = localAudioTrack;

  // Track mic muted state independently so Cmd+M works without a prop callback
  const micMutedRef = useRef(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

      const meta = e.metaKey || e.ctrlKey;
      const s = useStudioStore.getState();

      // ── Scene switch: 1-9 ────────────────────────────────────────────────────
      if (!meta && !e.shiftKey && !e.altKey && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        if (s.scenes[idx]) {
          e.preventDefault();
          s.switchScene(s.scenes[idx].id);
        }
        return;
      }

      // ── Escape: deselect layer ───────────────────────────────────────────────
      if (e.key === "Escape") {
        s.setSelectedLayerId(null);
        return;
      }

      // ── Cmd+M: toggle mic ────────────────────────────────────────────────────
      if (meta && e.key === "m") {
        e.preventDefault();
        const track = localAudioTrackRef.current;
        if (track) {
          micMutedRef.current = !micMutedRef.current;
          track.setMuted(micMutedRef.current);
          s.addToast(micMutedRef.current ? "Mic muted" : "Mic unmuted", "info");
        }
        return;
      }

      // ── Cmd+Z: undo ──────────────────────────────────────────────────────────
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        s.popUndo();
        return;
      }

      // ── Cmd+G: toggle snap grid ──────────────────────────────────────────────
      if (meta && e.key === "g") {
        e.preventDefault();
        s.setSnapToGrid(!s.snapToGrid);
        s.addToast(s.snapToGrid ? "Snap grid off" : "Snap grid on", "info");
        return;
      }

      // ── Layer shortcuts (require a selection) ────────────────────────────────
      const activeScene = s.scenes.find((sc) => sc.id === s.activeSceneId);
      if (!activeScene || !s.selectedLayerId) return;
      const selectedLayer = activeScene.layers.find((l) => l.id === s.selectedLayerId);
      if (!selectedLayer) return;

      // Delete / Backspace: remove selected layer
      if ((e.key === "Delete" || e.key === "Backspace") && !meta) {
        e.preventDefault();
        s.pushUndo(s.activeSceneId, activeScene.layers);
        s.removeLayer(s.activeSceneId, s.selectedLayerId);
        s.setSelectedLayerId(null);
        return;
      }

      // Cmd+D: duplicate selected layer (screenshare/media are lifecycle-bound
      // to their captures/files and can't be duplicated)
      if (meta && e.key === "d") {
        e.preventDefault();
        if (selectedLayer.type === "screenshare" || selectedLayer.type === "media" || selectedLayer.type === "browser") return;
        s.pushUndo(s.activeSceneId, activeScene.layers);
        const dup: Layer = {
          ...selectedLayer,
          id: crypto.randomUUID(),
          name: `${selectedLayer.name} Copy`,
          transform: {
            ...selectedLayer.transform,
            x: selectedLayer.transform.x + 16,
            y: selectedLayer.transform.y + 16,
          },
          sourceConfig: { ...selectedLayer.sourceConfig },
          effects: selectedLayer.effects.map((ef) => ({ ...ef })),
        };
        s.addLayer(s.activeSceneId, dup);
        s.setSelectedLayerId(dup.id);
        return;
      }

      // F: fill canvas with selected layer
      if (!meta && e.key === "f") {
        e.preventDefault();
        s.pushUndo(s.activeSceneId, activeScene.layers);
        s.updateLayer(s.activeSceneId, s.selectedLayerId, {
          transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
        });
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // safe: all store reads go through getState() inside the handler
}
