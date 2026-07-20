import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface HlsPublisher {
  playlistPath: string;
  publicUrl: string;
  stop: () => Promise<void>;
}

const HLS_ROOT = join(tmpdir(), "ditch-hls");

export function isHlsConfigured() {
  return process.env.R2_HLS_ENABLED === "true" && Boolean(
    process.env.R2_ENDPOINT && process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY && process.env.R2_PUBLIC_BASE_URL,
  );
}

export async function createHlsPublisher(sessionId: string): Promise<HlsPublisher | null> {
  if (!isHlsConfigured()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("Invalid session id for HLS output");

  const directory = join(HLS_ROOT, sessionId);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  const bucket = process.env.R2_BUCKET!;
  const publicBase = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "");
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const uploaded = new Map<string, string>();
  let stopped = false;
  let uploading = false;

  async function sync() {
    if (uploading) return;
    uploading = true;
    try {
      const files = await readdir(directory).catch(() => [] as string[]);
      for (const file of files) {
        if (!file.endsWith(".m3u8") && !file.endsWith(".ts")) continue;
        const path = join(directory, file);
        const info = await stat(path).catch(() => null);
        if (!info) continue;
        const signature = `${info.size}:${info.mtimeMs}`;
        if (uploaded.get(file) === signature) continue;
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `live/${sessionId}/${file}`,
          Body: await readFile(path),
          ContentType: file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t",
          CacheControl: file.endsWith(".m3u8") ? "no-store" : "public, max-age=3600, immutable",
        }));
        uploaded.set(file, signature);
      }
    } finally {
      uploading = false;
    }
  }

  const timer = setInterval(() => void sync().catch((error) => console.error("[hls] upload failed", error)), 1000);
  return {
    playlistPath: join(directory, "index.m3u8"),
    publicUrl: `${publicBase}/live/${sessionId}/index.m3u8`,
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      await new Promise((resolve) => setTimeout(resolve, 750));
      await sync().catch((error) => console.error("[hls] final upload failed", error));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
