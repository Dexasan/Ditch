// WebGL-based chroma key processor.
// Uses YCbCr colour space for the distance check - luminance-independent so
// any brightness of the key colour is removed, not just the exact shade.

export interface ChromaKeyConfig {
  type: "chromaKey";
  enabled: boolean;
  color: string;       // hex #rrggbb - the colour to remove
  similarity: number;  // 0..1 - threshold; higher = remove more of the key colour
  smoothness: number;  // 0..1 - feather width around the threshold edge
  spill: number;       // 0..1 - spill suppression (desaturates subject edges)
}

export const DEFAULT_CHROMA_KEY: ChromaKeyConfig = {
  type: "chromaKey",
  enabled: false,
  color: "#00ff00",
  similarity: 0.35,
  smoothness: 0.08,
  spill: 0.1,
};

// ── Store helpers ─────────────────────────────────────────────────────────────

export function getChromaKeyEffect(effects: Record<string, unknown>[]): ChromaKeyConfig | null {
  const e = effects.find((e) => e["type"] === "chromaKey");
  return e ? (e as unknown as ChromaKeyConfig) : null;
}

export function withChromaKey(
  effects: Record<string, unknown>[],
  patch: Partial<Omit<ChromaKeyConfig, "type">>,
): Record<string, unknown>[] {
  const existing = getChromaKeyEffect(effects) ?? { ...DEFAULT_CHROMA_KEY };
  const updated = { ...existing, ...patch };
  return [
    ...effects.filter((e) => e["type"] !== "chromaKey"),
    updated as unknown as Record<string, unknown>,
  ];
}

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = vec2((aPos.x + 1.0) * 0.5, (1.0 - aPos.y) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uKey;
uniform float uSim;
uniform float uSmooth;
uniform float uSpill;
varying vec2 vUV;

vec3 rgb2ycbcr(vec3 c) {
  return vec3(
     0.2990 * c.r + 0.5870 * c.g + 0.1140 * c.b,
    -0.1687 * c.r - 0.3313 * c.g + 0.5000 * c.b + 0.5,
     0.5000 * c.r - 0.4187 * c.g - 0.0813 * c.b + 0.5
  );
}

void main() {
  vec4 col      = texture2D(uTex, vUV);
  vec3 ycbcr    = rgb2ycbcr(col.rgb);
  vec3 keyYCbCr = rgb2ycbcr(uKey);
  float dist    = distance(ycbcr.yz, keyYCbCr.yz);
  float mask    = smoothstep(uSim - uSmooth, uSim + uSmooth, dist);
  vec3 rgb      = col.rgb;
  if (uSpill > 0.0) {
    float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = mix(rgb, vec3(gray), (1.0 - mask) * uSpill);
  }
  // Premultiplied output - the 2D compositor canvas blends with source-over,
  // which expects premultiplied alpha
  gl_FragColor = vec4(rgb * mask, mask);
}`;

// ── Processor ─────────────────────────────────────────────────────────────────

function mkShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(s) ?? "no info log"}`);
  }
  return s;
}

function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16 & 0xff) / 255, (n >> 8 & 0xff) / 255, (n & 0xff) / 255];
}

export class ChromaKeyProcessor {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private tex: WebGLTexture;
  private ulocs: {
    uKey:    WebGLUniformLocation;
    uSim:    WebGLUniformLocation;
    uSmooth: WebGLUniformLocation;
    uSpill:  WebGLUniformLocation;
  };

  constructor() {
    this.canvas = document.createElement("canvas");
    // premultipliedAlpha: true (WebGL default) - drawImage into a 2D canvas
    // assumes premultiplied pixels; the shader multiplies rgb by mask to match.
    const gl = this.canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER,   VERT_SRC));
    gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog) ?? "no info log"}`);
    }
    gl.useProgram(prog);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = tex;
    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
    gl.clearColor(0, 0, 0, 0);

    this.ulocs = {
      uKey:    gl.getUniformLocation(prog, "uKey")!,
      uSim:    gl.getUniformLocation(prog, "uSim")!,
      uSmooth: gl.getUniformLocation(prog, "uSmooth")!,
      uSpill:  gl.getUniformLocation(prog, "uSpill")!,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process(source: any, w: number, h: number, cfg: ChromaKeyConfig): HTMLCanvasElement {
    const { gl, canvas, ulocs, tex } = this;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return canvas;
    }
    const [r, g, b] = hexToRgb01(cfg.color);
    gl.uniform3f(ulocs.uKey,    r, g, b);
    gl.uniform1f(ulocs.uSim,    cfg.similarity);
    gl.uniform1f(ulocs.uSmooth, cfg.smoothness);
    gl.uniform1f(ulocs.uSpill,  cfg.spill);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  }

  dispose() {
    try { this.gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
  }
}
