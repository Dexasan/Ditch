// Em dashes and en dashes are banned across the website: copy, headings,
// meta tags, alt text, aria labels, JSON-LD, UI strings, and (to keep this
// check blunt and reliable) comments too. Rewrite with a period, comma,
// colon, or restructure; plain hyphens in compound words are fine.
// Runs as part of `build` (so every Vercel deploy enforces it) and `lint`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TARGETS = ["src", "public"];
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".md", ".mdx",
  ".json", ".svg", ".txt", ".html", ".xml",
]);
const BANNED = /[–—]/;

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!TEXT_EXTENSIONS.has(extname(entry.name))) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (BANNED.test(line)) {
        offenders.push(`${relative(ROOT, full)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const target of TARGETS) {
  const dir = join(ROOT, target);
  if (existsSync(dir)) walk(dir);
}

if (offenders.length > 0) {
  console.error("check-dashes: em/en dashes are banned on this site. Found:");
  for (const offender of offenders) console.error("  " + offender);
  process.exit(1);
}

console.log("check-dashes: clean");
