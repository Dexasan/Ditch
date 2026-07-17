"use client";

// Owns the live handles behind "media" layers (local video/audio files) and
// extra-device "camera" layers (raw getUserMedia captures, i.e. any camera
// layer with sourceConfig.deviceId - the primary camera stays Agora-owned).
//
// Files and device streams can't be persisted, so on reload the persisted
// layers come back with no backing source: they get sourceUnavailable=true and
// the Inspector offers a re-select / device picker to restore them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioStore, type Layer } from "@/lib/studio-store";

type SourceEntry = {
  el: HTMLVideoElement;
  /** Object URL for media files; null for device captures. */
  url: string | null;
  /** getUserMedia stream for extra cameras; null for media files. */
  stream: MediaStream | null;
  /** Audio track captured from a media file (null until decoded / for cameras). */
  audioTrack: MediaStreamTrack | null;
  /** Device id this entry was acquired for (extra cameras only). */
  deviceId?: string;
};

export interface MediaAudioSource {
  id: string; // mixer source id, "media-<layerId>"
  track: MediaStreamTrack;
  label: string;
}

function disposeEntry(entry: SourceEntry) {
  try { entry.el.pause(); } catch {}
  entry.el.srcObject = null;
  entry.el.removeAttribute("src");
  if (entry.url) { try { URL.revokeObjectURL(entry.url); } catch {} }
  entry.stream?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
}

export function useMediaSources(): {
  /** Bind a picked file to a media layer (also used by re-select). */
  attachFile: (layerId: string, file: File) => void;
  /** Bind a getDisplayMedia tab/window capture to a browser layer.
   *  Must be called from a user gesture. Captures tab audio when offered. */
  attachDisplayCapture: (layerId: string) => Promise<void>;
  /** Drawable element for a layer id, or null when nothing is attached yet. */
  getSource: (layerId: string) => HTMLVideoElement | null;
  /** Audio tracks of the ACTIVE scene's media/browser layers, for the mix. */
  mediaAudioSources: MediaAudioSource[];
} {
  const scenes = useStudioStore((s) => s.scenes);
  const activeSceneId = useStudioStore((s) => s.activeSceneId);

  const entriesRef = useRef<Map<string, SourceEntry>>(new Map());
  const acquiringRef = useRef<Set<string>>(new Set());
  // Bumped whenever an entry appears/changes so derived state recomputes.
  const [version, setVersion] = useState(0);

  const findSceneIdForLayer = useCallback((layerId: string): string | null => {
    const s = useStudioStore.getState();
    for (const sc of s.scenes) {
      if (sc.layers.some((l) => l.id === layerId)) return sc.id;
    }
    return null;
  }, []);

  const attachFile = useCallback((layerId: string, file: File) => {
    const old = entriesRef.current.get(layerId);
    if (old) disposeEntry(old);

    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.muted = true; // local playback stays silent; audio is mixed via captureStream
    el.playsInline = true;
    el.loop = true;
    el.src = url;

    const entry: SourceEntry = { el, url, stream: null, audioTrack: null };
    entriesRef.current.set(layerId, entry);

    el.addEventListener("loadeddata", () => {
      // captureStream taps the decoded media, so the element's muted flag does
      // not silence it - the mixer gain node is the volume control.
      try {
        const cap = (el as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
        entry.audioTrack = cap?.getAudioTracks()[0] ?? null;
      } catch {}
      setVersion((v) => v + 1);
    }, { once: true });

    el.play().catch(() => {});

    const sceneId = findSceneIdForLayer(layerId);
    if (sceneId) {
      const s = useStudioStore.getState();
      const layer = s.scenes.find((sc) => sc.id === sceneId)?.layers.find((l) => l.id === layerId);
      s.updateLayer(sceneId, layerId, {
        sourceUnavailable: false,
        sourceConfig: { ...(layer?.sourceConfig ?? {}), fileName: file.name },
      });
    }
    setVersion((v) => v + 1);
  }, [findSceneIdForLayer]);

  // ── Browser layers: tab/window capture via getDisplayMedia ───────────────────
  const attachDisplayCapture = useCallback(async (layerId: string) => {
    const s = useStudioStore.getState();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        // Tab audio carries alert sounds; Chrome only offers it for tab shares.
        audio: true,
      });
    } catch {
      s.addToast("Capture cancelled", "info");
      return;
    }

    const sceneId = findSceneIdForLayer(layerId);
    if (!sceneId) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const old = entriesRef.current.get(layerId);
    if (old) disposeEntry(old);

    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.srcObject = stream;
    el.play().catch(() => {});
    entriesRef.current.set(layerId, {
      el,
      url: null,
      stream,
      audioTrack: stream.getAudioTracks()[0] ?? null,
    });

    const track = stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener("ended", () => {
        // User clicked the browser's native "Stop sharing"
        const scId = findSceneIdForLayer(layerId);
        if (scId) useStudioStore.getState().updateLayer(scId, layerId, { sourceUnavailable: true });
        const e = entriesRef.current.get(layerId);
        if (e) { disposeEntry(e); entriesRef.current.delete(layerId); }
        setVersion((v) => v + 1);
      });
    }

    useStudioStore.getState().updateLayer(sceneId, layerId, { sourceUnavailable: false });
    setVersion((v) => v + 1);
  }, [findSceneIdForLayer]);

  // ── Extra-device cameras: acquire / re-acquire getUserMedia streams ──────────
  useEffect(() => {
    const wanted = new Map<string, { layer: Layer; sceneId: string }>();
    for (const sc of scenes) {
      for (const l of sc.layers) {
        if (l.type === "camera" && l.sourceConfig["deviceId"]) {
          wanted.set(l.id, { layer: l, sceneId: sc.id });
        }
      }
    }

    for (const [layerId, { layer, sceneId }] of wanted) {
      const deviceId = layer.sourceConfig["deviceId"] as string;
      const existing = entriesRef.current.get(layerId);
      if (existing && existing.deviceId === deviceId) continue;
      if (acquiringRef.current.has(layerId)) continue;
      acquiringRef.current.add(layerId);

      navigator.mediaDevices
        .getUserMedia({ video: { deviceId: { exact: deviceId } } })
        .then((stream) => {
          acquiringRef.current.delete(layerId);
          // Layer may have been deleted while the permission prompt was open
          if (!findSceneIdForLayer(layerId)) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const old = entriesRef.current.get(layerId);
          if (old) disposeEntry(old);

          const el = document.createElement("video");
          el.muted = true;
          el.playsInline = true;
          el.autoplay = true;
          el.srcObject = stream;
          el.play().catch(() => {});
          entriesRef.current.set(layerId, { el, url: null, stream, audioTrack: null, deviceId });

          const track = stream.getVideoTracks()[0];
          if (track) {
            track.addEventListener("ended", () => {
              // Device unplugged or capture revoked
              const scId = findSceneIdForLayer(layerId);
              if (scId) useStudioStore.getState().updateLayer(scId, layerId, { sourceUnavailable: true });
              const e = entriesRef.current.get(layerId);
              if (e) { disposeEntry(e); entriesRef.current.delete(layerId); }
              setVersion((v) => v + 1);
            });
          }

          const s = useStudioStore.getState();
          if (layer.sourceUnavailable) s.updateLayer(sceneId, layerId, { sourceUnavailable: false });
          setVersion((v) => v + 1);
        })
        .catch(() => {
          acquiringRef.current.delete(layerId);
          const scId = findSceneIdForLayer(layerId);
          if (scId) {
            const s = useStudioStore.getState();
            s.updateLayer(scId, layerId, { sourceUnavailable: true });
            s.addToast("Could not open camera device", "warning");
          }
        });
    }
  }, [scenes, findSceneIdForLayer]);

  // ── Reload recovery + lifecycle sync ─────────────────────────────────────────
  useEffect(() => {
    const allLayerIds = new Set<string>();
    const s = useStudioStore.getState();

    for (const sc of scenes) {
      for (const l of sc.layers) {
        allLayerIds.add(l.id);

        if (l.type === "media") {
          const entry = entriesRef.current.get(l.id);
          if (entry) {
            // Keep element flags in sync with sourceConfig
            entry.el.loop = l.sourceConfig["loop"] !== false;
            // Media in inactive scenes pauses so it doesn't play into the mix
            if (sc.id === activeSceneId && l.visible) {
              if (entry.el.paused) entry.el.play().catch(() => {});
            } else if (!entry.el.paused) {
              entry.el.pause();
            }
          } else if (!l.sourceUnavailable) {
            // Persisted media layer with no file behind it (page reload)
            s.updateLayer(sc.id, l.id, { sourceUnavailable: true });
          }
        }

        if (l.type === "browser" && !entriesRef.current.has(l.id) && !l.sourceUnavailable) {
          // Persisted browser layer with no capture behind it (page reload)
          s.updateLayer(sc.id, l.id, { sourceUnavailable: true });
        }
      }
    }

    // Dispose entries whose layer was deleted (any scene)
    for (const [layerId, entry] of entriesRef.current) {
      if (!allLayerIds.has(layerId)) {
        disposeEntry(entry);
        entriesRef.current.delete(layerId);
      }
    }
  }, [scenes, activeSceneId]);

  // Dispose everything on unmount
  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) disposeEntry(entry);
      entries.clear();
    };
  }, []);

  const getSource = useCallback(
    (layerId: string) => entriesRef.current.get(layerId)?.el ?? null,
    [],
  );

  const mediaAudioSources = useMemo<MediaAudioSource[]>(() => {
    const active = scenes.find((sc) => sc.id === activeSceneId);
    if (!active) return [];
    const out: MediaAudioSource[] = [];
    for (const l of active.layers) {
      if ((l.type !== "media" && l.type !== "browser") || !l.visible) continue;
      const entry = entriesRef.current.get(l.id);
      if (entry?.audioTrack) out.push({ id: `media-${l.id}`, track: entry.audioTrack, label: l.name });
    }
    return out;
  // version invalidates when entries gain/lose tracks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, activeSceneId, version]);

  return { attachFile, attachDisplayCapture, getSource, mediaAudioSources };
}
