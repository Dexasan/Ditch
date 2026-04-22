"use client";

import { useEffect, useRef, useState } from "react";
import type { IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { Participant } from "@ditch/types";

// Output canvas dimensions
const W = 1280;
const H = 720;
const CELL_W = W / 2;
const CELL_H = H / 2;

// Fixed 2×2 grid: creator top-left, participants fill remaining cells
const GRID = [
  { x: 0,      y: 0,      w: CELL_W, h: CELL_H }, // slot 0 — creator cam
  { x: CELL_W, y: 0,      w: CELL_W, h: CELL_H }, // slot 1 — participant slot_index 0
  { x: 0,      y: CELL_H, w: CELL_W, h: CELL_H }, // slot 2 — participant slot_index 1
  { x: CELL_W, y: CELL_H, w: CELL_W, h: CELL_H }, // slot 3 — participant slot_index 2
];

interface CompositorOptions {
  localVideoTrack: ILocalVideoTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  liveParticipants: Participant[];
  enabled: boolean;
}

export function useCompositor({
  localVideoTrack,
  localAudioTrack,
  remoteUsers,
  liveParticipants,
  enabled,
}: CompositorOptions): { stream: MediaStream | null } {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  // Pool of hidden <video> elements keyed by MediaStreamTrack id
  const videoElemsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  // Track IDs already connected to the audio graph
  const connectedAudioRef = useRef<Set<string>>(new Set());

  // Stand up canvas, AudioContext, and the composite MediaStream once when enabled
  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvasRef.current = canvas;

    const audioCtx = new AudioContext();
    const audioDest = audioCtx.createMediaStreamDestination();
    audioCtxRef.current = audioCtx;
    audioDestRef.current = audioDest;

    const composite = new MediaStream([
      ...canvas.captureStream(30).getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);
    setStream(composite);

    return () => {
      cancelAnimationFrame(rafRef.current);
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      audioDestRef.current = null;
      connectedAudioRef.current.clear();
      videoElemsRef.current.forEach((el) => { el.srcObject = null; });
      videoElemsRef.current.clear();
      canvasRef.current = null;
      setStream(null);
    };
  }, [enabled]);

  // Draw loop — restarts whenever the set of active tracks changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    cancelAnimationFrame(rafRef.current);

    function getVideoElem(trackId: string, nativeTrack: MediaStreamTrack): HTMLVideoElement {
      let el = videoElemsRef.current.get(trackId);
      if (!el) {
        el = document.createElement("video");
        el.autoplay = true;
        el.muted = true;    // audio goes through AudioContext, not the video element
        el.playsInline = true;
        el.srcObject = new MediaStream([nativeTrack]);
        el.play().catch(() => {});
        videoElemsRef.current.set(trackId, el);
      }
      return el;
    }

    function draw() {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);

      // Slot 0: creator camera
      if (localVideoTrack) {
        try {
          const native = localVideoTrack.getMediaStreamTrack();
          const el = getVideoElem(native.id, native);
          const { x, y, w, h } = GRID[0];
          ctx!.drawImage(el, x, y, w, h);
        } catch (_) {}
      }

      // Slots 1-3: live participants mapped by slot_index (0 → grid[1], 1 → grid[2], 2 → grid[3])
      for (const p of liveParticipants) {
        const gridIdx = (p.slot_index ?? 0) + 1;
        if (gridIdx > 3) continue; // slot_index 3 is audio-only in the composite

        const uid = (p.slot_index ?? 0) + 1; // mirrors slotToUid()
        const remoteUser = remoteUsers.find((u) => u.uid === uid);
        if (!remoteUser?.videoTrack) continue;

        try {
          const native = remoteUser.videoTrack.getMediaStreamTrack();
          const el = getVideoElem(native.id, native);
          const { x, y, w, h } = GRID[gridIdx];
          ctx!.drawImage(el, x, y, w, h);
        } catch (_) {}
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, localVideoTrack, remoteUsers, liveParticipants]);

  // Audio graph — connect new tracks to the AudioContext destination
  useEffect(() => {
    if (!enabled || !audioCtxRef.current || !audioDestRef.current) return;

    function connectIfNew(nativeTrack: MediaStreamTrack) {
      if (connectedAudioRef.current.has(nativeTrack.id)) return;
      try {
        const src = audioCtxRef.current!.createMediaStreamSource(
          new MediaStream([nativeTrack])
        );
        src.connect(audioDestRef.current!);
        connectedAudioRef.current.add(nativeTrack.id);
      } catch (_) {}
    }

    if (localAudioTrack) {
      try { connectIfNew(localAudioTrack.getMediaStreamTrack()); } catch (_) {}
    }

    for (const user of remoteUsers) {
      if (!user.audioTrack) continue;
      try { connectIfNew(user.audioTrack.getMediaStreamTrack()); } catch (_) {}
    }
  }, [enabled, localAudioTrack, remoteUsers]);

  return { stream };
}
