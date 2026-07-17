// Lays out a Markdown subset as canvas draw ops (fillText / fillRect).
//
// Everything is rendered natively on the compositor canvas - no HTML, no SVG.
// The obvious alternative (markdown -> HTML -> SVG foreignObject -> drawImage)
// TAINTS the canvas in Chromium, which silently breaks VideoFrame creation and
// freezes the composite stream. Native text ops can never taint.
//
// Supported: # ## ### headings, **bold**, *italic*, `code`, - and 1. lists,
// > quotes, ``` code blocks, --- rules, [text](url) rendered as styled text.

export type MdOp =
  | { op: "text"; text: string; x: number; y: number; font: string; fill: string }
  | { op: "rect"; x: number; y: number; w: number; h: number; fill: string };

export interface MarkdownOpts {
  fontSizePx: number;
  color: string;
  /** Reserve padding for the backdrop card (drawn by the compositor). */
  bg: boolean;
}

type Seg = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

const ACCENT = "#FF1DB4";
const CODE_COLOR = "#FFD1EE";

function parseInline(raw: string): Seg[] {
  // Links become plain styled text - nothing is clickable on a video frame
  const s = raw.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const out: Seg[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith("`")) out.push({ text: tok.slice(1, -1), code: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

export function layoutMarkdown(
  ctx: CanvasRenderingContext2D,
  md: string,
  width: number,
  height: number,
  opts: MarkdownOpts,
): MdOp[] {
  const fs = opts.fontSizePx || 24;
  const color = opts.color || "#FFFFFF";
  const pad = opts.bg ? Math.round(fs * 0.9) : 2;
  const maxRight = width - pad;
  const ops: MdOp[] = [];
  let y = pad;

  const overflow = () => y > height - pad - fs;

  function fontFor(seg: Seg, size: number, weight: number): string {
    const style = seg.italic ? "italic " : "";
    const w = seg.bold ? Math.max(weight, 800) : weight;
    const family = seg.code ? "Consolas, monospace" : "Arial, sans-serif";
    return `${style}${w} ${size}px ${family}`;
  }

  // Emits one wrapped run of styled segments; advances y past the last line.
  function emitSegments(segs: Seg[], size: number, weight: number, indent: number, fill: string) {
    const lineH = Math.round(size * 1.4);
    let x = pad + indent;
    for (const seg of segs) {
      const font = fontFor(seg, size, weight);
      ctx.font = font;
      for (const word of seg.text.split(/(\s+)/)) {
        if (!word) continue;
        const wWidth = ctx.measureText(word).width;
        if (word.trim() && x + wWidth > maxRight && x > pad + indent) {
          x = pad + indent;
          y += lineH;
          if (overflow()) return;
        }
        if (word.trim()) {
          ops.push({ op: "text", text: word, x, y, font, fill: seg.code ? CODE_COLOR : fill });
        }
        x += wWidth;
      }
    }
    y += lineH;
  }

  const lines = md.split("\n");
  let listIndex = 0;
  let inCode = false;

  for (const raw of lines) {
    if (overflow()) break;

    if (raw.trim().startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) {
      const size = Math.round(fs * 0.85);
      ops.push({
        op: "rect", x: pad, y: y - 2,
        w: width - pad * 2, h: Math.round(size * 1.4) + 4,
        fill: "rgba(255,255,255,0.08)",
      });
      ops.push({
        op: "text", text: raw, x: pad + Math.round(fs * 0.4), y,
        font: `400 ${size}px Consolas, monospace`, fill: CODE_COLOR,
      });
      y += Math.round(size * 1.4) + 4;
      continue;
    }

    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const scale = [1.8, 1.45, 1.2][h[1].length - 1];
      y += Math.round(fs * 0.2);
      emitSegments(parseInline(h[2]), Math.round(fs * scale), 800, 0, color);
      y += Math.round(fs * 0.15);
      listIndex = 0;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      y += Math.round(fs * 0.3);
      ops.push({ op: "rect", x: pad, y, w: width - pad * 2, h: 1, fill: "rgba(255,255,255,0.25)" });
      y += Math.round(fs * 0.5);
      listIndex = 0;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      ctx.font = `700 ${fs}px Arial, sans-serif`;
      ops.push({ op: "text", text: "•", x: pad + Math.round(fs * 0.2), y, font: ctx.font, fill: ACCENT });
      emitSegments(parseInline(ul[1]), fs, 400, Math.round(fs * 1.1), color);
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      listIndex += 1;
      ctx.font = `700 ${fs}px Arial, sans-serif`;
      ops.push({ op: "text", text: `${listIndex}.`, x: pad, y, font: ctx.font, fill: ACCENT });
      emitSegments(parseInline(ol[1]), fs, 400, Math.round(fs * 1.3), color);
      continue;
    }
    listIndex = 0;

    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      const barTop = y;
      emitSegments(parseInline(q[1]), fs, 400, Math.round(fs * 0.7), color);
      ops.push({ op: "rect", x: pad, y: barTop, w: 3, h: y - barTop - Math.round(fs * 0.2), fill: ACCENT });
      continue;
    }

    if (!line.trim()) { y += Math.round(fs * 0.5); continue; }
    emitSegments(parseInline(line), fs, 400, 0, color);
  }

  return ops;
}

export function markdownCacheKey(
  cfg: Record<string, unknown>,
  width: number,
  height: number,
): string {
  return [
    cfg["markdown"] ?? "",
    Number(cfg["fontSizePx"]) || 24,
    cfg["color"] ?? "#FFFFFF",
    cfg["bg"] ? 1 : 0,
    Math.round(width),
    Math.round(height),
  ].join("|");
}
