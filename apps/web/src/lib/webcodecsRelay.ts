"use client";

// Browser-side H264 encode with explicit key frame control, replacing
// MediaRecorder on the relay path. MediaRecorder emits H264 key frames on its
// own schedule (videoKeyFrameIntervalDuration is ignored for H264 in Chromium),
// which makes copy-path startup nondeterministic and forces the relay to
// re-encode keyframe-strict targets (YouTube/Twitch) at a generation-loss cost.
//
// Here we use WebCodecs via Mediabunny: MediaStreamVideoTrackSource pulls frames
// from the compositor's output track, encodes them to H264 with a key frame
// every `keyFrameIntervalSec`, and muxes H264 + Opus into a fragmented MP4 that
// is streamed to the relay through an AppendOnlyStreamTarget.
//
// Latency note: Mediabunny finalizes an fMP4 fragment only on a key frame
// boundary (isobmff-muxer: `keyFrameQueuedEverywhere`), so a fragment, and thus
// the first key frame, reaches the relay after ~keyFrameIntervalSec. That is
// acceptable on the broadcast-out RTMP path (destinations add their own buffer;
// the interactive path runs over Agora, not this relay) and it makes first-key-
// frame delivery deterministic instead of a random 0-4s gap.

import {
  Output,
  Mp4OutputFormat,
  AppendOnlyStreamTarget,
  MediaStreamVideoTrackSource,
  MediaStreamAudioTrackSource,
  canEncodeVideo,
  canEncodeAudio,
} from "mediabunny";

const VIDEO_CODEC = "avc" as const;
const AUDIO_CODEC = "opus" as const;

// Mediabunny's constructors take the DOM `MediaStreamVideoTrack` / `...AudioTrack`
// globals (from @types/dom-mediacapture-transform), which aren't guaranteed to be
// in the app's TS lib. Derive the exact param types from the classes instead of
// naming the globals, so the cast holds regardless.
type VideoTrackParam = ConstructorParameters<typeof MediaStreamVideoTrackSource>[0];
type AudioTrackParam = ConstructorParameters<typeof MediaStreamAudioTrackSource>[0];

export interface WebCodecsCapabilityConfig {
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

// Feature gate + real capability probe. Requires the WebCodecs + Breakout Box
// globals (Safari lacks MediaStreamTrackProcessor → falls back to MediaRecorder,
// mirroring the compositor's own gate), then asks the browser whether it can
// actually encode AVC and Opus at the *exact* resolution, fps and bitrate we
// intend to use, since a browser can expose the API yet fail to encode 1080p H264.
export async function canUseWebCodecsRelay(cfg: WebCodecsCapabilityConfig): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const g = window as unknown as Record<string, unknown>;
  if (
    typeof g.VideoEncoder === "undefined" ||
    typeof g.AudioEncoder === "undefined" ||
    typeof g.MediaStreamTrackProcessor === "undefined" ||
    typeof g.MediaStreamTrackGenerator === "undefined"
  ) {
    return false;
  }
  try {
    const [video, audio] = await Promise.all([
      canEncodeVideo(VIDEO_CODEC, {
        width: cfg.width,
        height: cfg.height,
        bitrate: cfg.videoBitrateKbps * 1000,
        latencyMode: "realtime",
        bitrateMode: "constant",
      }),
      canEncodeAudio(AUDIO_CODEC, {
        numberOfChannels: 2,
        sampleRate: 48000,
        bitrate: cfg.audioBitrateKbps * 1000,
      }),
    ]);
    return video && audio;
  } catch {
    return false;
  }
}

export interface WebCodecsEncoderOptions {
  stream: MediaStream;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  fps: number;
  keyFrameIntervalSec: number;
  /** Called for every muxed byte range. Return false to signal the socket send
   *  queue is saturated; the encoder stops and the caller restarts the stream. */
  onChunk: (data: Uint8Array) => boolean;
  /** Runtime encode/mux/capture failure. The caller falls back to MediaRecorder. */
  onError: (err: unknown) => void;
}

export interface WebCodecsEncoderController {
  stop: () => void;
}

export async function startWebCodecsEncoder(
  opts: WebCodecsEncoderOptions,
): Promise<WebCodecsEncoderController> {
  const videoTrack = opts.stream.getVideoTracks()[0];
  if (!videoTrack) throw new Error("No video track to encode");
  const audioTrack = opts.stream.getAudioTracks()[0] ?? null;

  let stopped = false;
  let overflowed = false;

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "fragmented" }),
    target: new AppendOnlyStreamTarget(
      new WritableStream<Uint8Array>({
        write(data) {
          if (stopped) return;
          if (!opts.onChunk(data)) {
            // Socket overflow: throwing aborts the writable and unwinds the
            // pipeline. The caller has already scheduled a restart via the
            // false return, so suppress this as a spurious onError below.
            overflowed = true;
            throw new Error("relay-socket-overflow");
          }
        },
      }),
    ),
  });

  const videoSource = new MediaStreamVideoTrackSource(
    videoTrack as VideoTrackParam,
    {
      codec: VIDEO_CODEC,
      bitrate: opts.videoBitrateKbps * 1000,
      keyFrameInterval: opts.keyFrameIntervalSec,
      // Realtime, CBR, no B-frames: what RTMP ingests and -c:v copy expect.
      latencyMode: "realtime",
      bitrateMode: "constant",
    },
    // Sample at the target rate so the encoded stream is ~CFR (RTMP wants CFR).
    { frameRate: opts.fps },
  );
  output.addVideoTrack(videoSource);

  let audioSource: MediaStreamAudioTrackSource | null = null;
  if (audioTrack) {
    audioSource = new MediaStreamAudioTrackSource(audioTrack as AudioTrackParam, {
      codec: AUDIO_CODEC,
      bitrate: opts.audioBitrateKbps * 1000,
    });
    output.addAudioTrack(audioSource);
  }

  const teardown = () => {
    if (stopped) return;
    stopped = true;
    try { videoSource.close(); } catch {}
    try { audioSource?.close(); } catch {}
    // cancel() (not finalize): we're aborting a live stream, not producing a
    // complete file; the relay gets EOF when the socket closes.
    void output.cancel().catch(() => {});
  };

  // errorPromise never resolves; it rejects on a runtime encode/capture failure.
  // Self-tear-down the sources (they may still be capturing even if start() has
  // not resolved yet), then route real failures to onError, ignoring rejections
  // caused by our own teardown or a deliberate overflow abort.
  const reportError = (err: unknown) => {
    const wasStopped = stopped || overflowed;
    teardown();
    if (!wasStopped) opts.onError(err);
  };
  void videoSource.errorPromise.catch(reportError);
  void audioSource?.errorPromise.catch(reportError);

  await output.start();

  return { stop: teardown };
}
