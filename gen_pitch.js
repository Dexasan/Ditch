#!/usr/bin/env node
// DITCH — Startcup Lazio 2026 Pitch Deck Generator
// Usage: node gen_pitch.js

const PptxGenJS = require('/tmp/node_modules/pptxgenjs');
const path = require('path');
const fs = require('fs');

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
pres.title = 'DITCH — Startcup Lazio 2026';
pres.subject = 'Stream Once. Reach Everyone. Bring Them Back.';
pres.author = 'DITCH';
pres.company = 'DITCH';

// ─── Brand System ─────────────────────────────────────────────
const C = {
  bg:          '0D1117',
  bgCard:      '161B22',
  bgCardDeep:  '0A0E15',
  bgCardAlt:   '1C2533',
  accent:      '00C2E8',   // electric blue
  accentDark:  '004A5A',   // dark tint for accent
  purple:      '7C5CF5',   // secondary
  purpleDark:  '2A1F60',   // dark tint for purple
  white:       'FFFFFF',
  light:       'E8EEF4',
  muted:       '7A8899',
  dim:         '3D4F63',
  red:         'FF4D6D',
  redDark:     '5A1827',
  green:       '00C98A',
  greenDark:   '003D28',
  orange:      'FFAB00',
  orangeDark:  '4A3200',
};

const LOGO = path.join(__dirname, 'Ditch logo.png');
const HAS_LOGO = fs.existsSync(LOGO);

const W = 13.33;
const H = 7.5;

// ─── Helpers ──────────────────────────────────────────────────
function bg(slide, color) {
  slide.background = { color: color || C.bg };
}

function rect(slide, x, y, w, h, fillColor, lineColor, lineW) {
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fillColor || C.bg },
    line: { color: lineColor || fillColor || C.bg, width: lineW || 0 },
  });
}

function rRect(slide, x, y, w, h, fillColor, radius, lineColor, lineW) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: radius || 0.1,
    fill: { color: fillColor || C.bgCard },
    line: { color: lineColor || C.dim, width: lineW || 1 },
  });
}

function ellipse(slide, x, y, w, h, fillColor, lineColor, lineW) {
  slide.addShape(pres.ShapeType.ellipse, {
    x, y, w, h,
    fill: { color: fillColor || C.accent },
    line: { color: lineColor || fillColor || C.accent, width: lineW || 0 },
  });
}

function line(slide, x, y, w, h, color, width) {
  slide.addShape(pres.ShapeType.line, {
    x, y, w, h,
    line: { color: color || C.dim, width: width || 1 },
  });
}

function txt(slide, text, x, y, w, h, opts) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: 'Calibri',
    wrap: true,
    ...opts,
  });
}

// Top accent bar
function accentBar(slide, color) {
  rect(slide, 0, 0, W, 0.05, color || C.accent, color || C.accent, 0);
}

// Section label (small caps above headline)
function sectionLabel(slide, text, y) {
  txt(slide, text, 0.6, y, 12, 0.35, {
    fontSize: 10,
    bold: true,
    color: C.accent,
    align: 'left',
    charSpacing: 4,
  });
}

// Large headline
function h1(slide, text, y, opts) {
  txt(slide, text, 0.6, y, 12.1, opts?.h || 1.1, {
    fontSize: opts?.size || 38,
    bold: true,
    color: opts?.color || C.white,
    align: opts?.align || 'left',
    valign: 'middle',
    ...opts,
  });
}

// Body copy
function body(slide, text, x, y, w, h, opts) {
  txt(slide, text, x, y, w, h, {
    fontSize: opts?.size || 15,
    color: opts?.color || C.muted,
    align: opts?.align || 'left',
    valign: 'top',
    lineSpacingMultiple: 1.3,
    ...opts,
  });
}

// Metric callout box
function metricBox(slide, value, label, x, y, accentColor) {
  rRect(slide, x, y, 2.6, 1.5, C.bgCard, 0.12, accentColor || C.accent, 1.5);
  txt(slide, value, x, y + 0.15, 2.6, 0.8, {
    fontSize: 32, bold: true, color: accentColor || C.accent,
    align: 'center', valign: 'middle',
  });
  txt(slide, label, x, y + 0.9, 2.6, 0.45, {
    fontSize: 11, color: C.muted, align: 'center',
  });
}

// Icon-style dot
function dot(slide, x, y, r, color) {
  ellipse(slide, x - r, y - r, r * 2, r * 2, color || C.accent, color || C.accent, 0);
}

// Check mark item
function checkItem(slide, text, x, y, color) {
  rRect(slide, x, y + 0.05, 0.28, 0.28, color || C.green, 0.05, C.bgCardDeep, 0);
  txt(slide, '✓', x, y + 0.04, 0.28, 0.3, {
    fontSize: 11, bold: true, color: C.bgCardDeep, align: 'center',
  });
  txt(slide, text, x + 0.38, y, 5.5, 0.36, {
    fontSize: 14, color: C.light, valign: 'middle',
  });
}

// Connector arrow (horizontal)
function arrowH(slide, x, y, length, color) {
  slide.addShape(pres.ShapeType.rightArrow, {
    x, y, w: length, h: 0.32,
    fill: { color: color || C.dim },
    line: { color: color || C.dim, width: 0 },
  });
}

// Step box (numbered)
function stepBox(slide, num, title, desc, x, y, w, accentColor) {
  rRect(slide, x, y, w, 2.8, C.bgCard, 0.12, accentColor || C.accent, 1.5);
  // Number badge
  ellipse(slide, x + 0.25, y + 0.25, 0.55, 0.55, accentColor || C.accent, accentColor || C.accent, 0);
  txt(slide, String(num), x + 0.25, y + 0.25, 0.55, 0.55, {
    fontSize: 18, bold: true, color: C.bg, align: 'center', valign: 'middle',
  });
  txt(slide, title, x + 0.2, y + 0.95, w - 0.4, 0.55, {
    fontSize: 16, bold: true, color: C.white,
  });
  txt(slide, desc, x + 0.2, y + 1.55, w - 0.4, 1.1, {
    fontSize: 12, color: C.muted, lineSpacingMultiple: 1.3,
  });
}

// Platform pill
function pill(slide, label, x, y, bg, textColor) {
  rRect(slide, x, y, 1.4, 0.38, bg || C.bgCardAlt, 0.19, C.dim, 1);
  txt(slide, label, x, y, 1.4, 0.38, {
    fontSize: 11, bold: true, color: textColor || C.muted,
    align: 'center', valign: 'middle',
  });
}

// ─── SLIDE 1: TITLE ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'fade' };
  bg(s);

  // BG gradient effect — layered rectangles
  rect(s, 0, 0, W, H, C.bg);
  // Subtle glow top-right
  rect(s, 7, 0, 6.33, 3.5, C.accentDark);
  rect(s, 8.5, 0, 4.83, 2.5, C.bg);  // refine glow
  // Accent bar
  rect(s, 0, 0, W, 0.07, C.accent);

  // Logo or DITCH wordmark
  if (HAS_LOGO) {
    s.addImage({ path: LOGO, x: 0.6, y: 1.3, w: 3.2, h: 1.1, sizing: { type: 'contain', w: 3.2, h: 1.1 } });
  } else {
    txt(s, 'DITCH', 0.6, 1.2, 5, 1.3, {
      fontSize: 72, bold: true, color: C.white,
    });
  }

  // Tagline
  txt(s, 'Stream Once. Reach Everyone.\nBring Them Back.', 0.6, 2.7, 8.5, 1.9, {
    fontSize: 36, bold: true, color: C.white, lineSpacingMultiple: 1.2,
  });

  // Description line
  txt(s, 'The video-first live platform for creators who refuse to choose.', 0.6, 4.75, 9, 0.5, {
    fontSize: 16, color: C.muted,
  });

  // Bottom bar info
  rect(s, 0, 6.9, W, 0.6, C.bgCard);
  txt(s, 'Startcup Lazio 2026', 0.6, 6.92, 5, 0.4, {
    fontSize: 13, color: C.muted, valign: 'middle',
  });
  txt(s, 'ditchlive.app', W - 2.4, 6.92, 1.8, 0.4, {
    fontSize: 13, color: C.accent, valign: 'middle', align: 'right',
  });

  // Right side visual — platform pills stacked
  const plats = [
    ['TWITCH', 'A855F7'], ['YOUTUBE', 'EF4444'], ['TIKTOK', '1D1D1D'],
    ['KICK', '53FC18'], ['DITCH', C.accent],
  ];
  plats.forEach(([name, color], i) => {
    rRect(s, 10.5, 1.4 + i * 0.85, 2.2, 0.62, C.bgCard, 0.08, color, 1.5);
    txt(s, name, 10.5, 1.4 + i * 0.85, 2.2, 0.62, {
      fontSize: 13, bold: true, color: C.light, align: 'center', valign: 'middle',
    });
  });
  txt(s, '→ all at once', 10.5, 5.75, 2.2, 0.4, {
    fontSize: 12, color: C.accent, align: 'center',
  });
}

// ─── SLIDE 2: THE MOMENT ───────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'zoom' };
  bg(s);

  // Split background — left dark, right slightly lighter
  rect(s, 0, 0, W / 2, H, C.bgCardDeep);
  rect(s, W / 2, 0, W / 2, H, C.bg);
  // Vertical divider
  rect(s, W / 2 - 0.015, 0, 0.03, H, C.dim);

  accentBar(s);

  // LEFT SIDE — passive viewer
  txt(s, 'BEFORE', 0.5, 0.5, 6, 0.4, { fontSize: 11, bold: true, color: C.muted, charSpacing: 3 });
  txt(s, 'Watching from\na chat window', 0.5, 1.0, 5.8, 1.6, {
    fontSize: 30, bold: true, color: C.light, lineSpacingMultiple: 1.2,
  });

  // Person icon (simplified with shapes)
  ellipse(s, 2.2, 2.9, 0.7, 0.7, C.dim, C.dim, 0);  // head
  rect(s, 1.7, 3.65, 1.7, 1.3, C.dim);  // body

  // Chat bubbles (passive)
  const chatItems = ['viewer1234: lol', 'xXgamer: hype!', 'anon: 🔥🔥🔥', '...200 more msgs'];
  chatItems.forEach((msg, i) => {
    rRect(s, 0.5, 3.1 + i * 0.56, 4.8, 0.44, C.bgCardAlt, 0.08, C.dim, 1);
    txt(s, msg, 0.7, 3.1 + i * 0.56, 4.5, 0.44, {
      fontSize: 11, color: i === 3 ? C.muted : C.light, valign: 'middle',
      italic: i === 3,
    });
  });

  // RIGHT SIDE — participant
  txt(s, 'WITH DITCH', W / 2 + 0.5, 0.5, 6, 0.4, { fontSize: 11, bold: true, color: C.accent, charSpacing: 3 });
  txt(s, 'On screen, live,\nacross every platform', W / 2 + 0.5, 1.0, 6.2, 1.6, {
    fontSize: 30, bold: true, color: C.white, lineSpacingMultiple: 1.2,
  });

  // Glowing participant box
  rRect(s, W / 2 + 1.0, 2.85, 4.2, 3.0, C.bgCard, 0.15, C.accent, 2.5);
  // Accent glow effect
  rRect(s, W / 2 + 0.9, 2.75, 4.4, 3.2, C.accentDark, 0.18, C.accent, 0.5);
  ellipse(s, W / 2 + 2.5, 3.1, 0.8, 0.8, C.accent, C.accent, 0);  // head
  rect(s, W / 2 + 1.9, 3.95, 2.0, 1.5, C.accent);  // body silhouette

  // Live badge
  rRect(s, W / 2 + 1.15, 2.92, 0.9, 0.32, C.red, 0.1, C.red, 0);
  txt(s, '● LIVE', W / 2 + 1.15, 2.92, 0.9, 0.32, {
    fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle',
  });

  // Platform reach labels
  const plats = ['YouTube', 'Twitch', 'TikTok', 'Kick'];
  plats.forEach((p, i) => {
    txt(s, p, W / 2 + 1.0 + i * 1.07, 6.15, 1.0, 0.3, {
      fontSize: 10, color: C.accent, align: 'center',
    });
    // Dot
    ellipse(s, W / 2 + 1.0 + i * 1.07 + 0.42, 6.0, 0.08, 0.08, C.accent, C.accent, 0);
  });

  // Headline at the bottom
  rect(s, 0, 6.7, W, 0.8, C.bgCard);
  txt(s, '"What if watching wasn\'t enough?"', 0, 6.7, W, 0.8, {
    fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle',
  });
}

// ─── SLIDE 3: THE PROBLEM ──────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'slide' };
  bg(s);
  accentBar(s, C.red);

  sectionLabel(s, 'THE PROBLEM', 0.3);
  h1(s, 'Two Problems.\nNobody Has Solved Both.', 0.65, { size: 34, h: 1.3 });

  // LEFT problem card
  rRect(s, 0.5, 2.2, 5.8, 4.7, C.bgCard, 0.12, C.red, 1.5);
  rect(s, 0.5, 2.2, 5.8, 0.55, C.redDark);  // header bg
  txt(s, '01  FRAGMENTATION', 0.7, 2.22, 5.5, 0.5, {
    fontSize: 13, bold: true, color: C.red, valign: 'middle', charSpacing: 2,
  });

  txt(s, 'Creators can\'t stream everywhere', 0.7, 2.9, 5.4, 0.5, {
    fontSize: 17, bold: true, color: C.light,
  });
  txt(s, 'Twitch, YouTube, TikTok and Kick actively restrict\ncross-platform streaming. Every creator is forced to\nchoose one audience and ignore the rest.\n\nTools like Restream distribute pixels — they don\'t fix\nthe interaction experience, and they don\'t aggregate\nthe audience.', 0.7, 3.5, 5.4, 2.6, {
    fontSize: 13, color: C.muted, lineSpacingMultiple: 1.35,
  });

  // Platform icons with X
  const ps = ['TWITCH', 'YOUTUBE', 'TIKTOK', 'KICK'];
  ps.forEach((p, i) => {
    rRect(s, 0.7 + i * 1.38, 5.9, 1.1, 0.7, C.bgCardAlt, 0.08, C.redDark, 1);
    txt(s, p, 0.7 + i * 1.38, 5.9, 1.1, 0.7, { fontSize: 9, bold: true, color: C.muted, align: 'center', valign: 'middle' });
    txt(s, '✕', 0.7 + i * 1.38 + 0.4, 5.82, 0.3, 0.3, { fontSize: 14, bold: true, color: C.red, align: 'center' });
  });

  // RIGHT problem card
  rRect(s, 6.9, 2.2, 5.8, 4.7, C.bgCard, 0.12, C.red, 1.5);
  rect(s, 6.9, 2.2, 5.8, 0.55, C.redDark);
  txt(s, '02  PASSIVE VIEWERS', 7.1, 2.22, 5.5, 0.5, {
    fontSize: 13, bold: true, color: C.red, valign: 'middle', charSpacing: 2,
  });

  txt(s, 'Audiences have nowhere to go', 7.1, 2.9, 5.4, 0.5, {
    fontSize: 17, bold: true, color: C.light,
  });
  txt(s, 'The viewer experience in live streaming is unchanged\nfrom television: one person on screen, thousands\nwatching through a chat window moving too fast to read.\n\nThere is no mechanism for a viewer to be present — to\nmatter — in real time. Chat is noise. It doesn\'t scale.\nAnd nobody has built something better.', 7.1, 3.5, 5.4, 2.6, {
    fontSize: 13, color: C.muted, lineSpacingMultiple: 1.35,
  });

  // Chat bubble visualization
  const msgs = ['viewer_77: 🔥🔥', 'just_here: hi', 'someuser: hype', 'anon: lol w', '...198 unread'];
  msgs.forEach((m, i) => {
    const alpha = i < 4 ? C.bgCardAlt : C.bgCardDeep;
    rRect(s, 7.1, 5.72 + i * 0.14, 4.6, 0.2, alpha, 0.04, C.dim, 0.5);
    txt(s, m, 7.2, 5.72 + i * 0.14, 4.4, 0.2, { fontSize: 8, color: i === 4 ? C.muted : C.dim });
  });
}

// ─── SLIDE 4: THE SOLUTION ─────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'fade' };
  bg(s);
  accentBar(s, C.accent);

  sectionLabel(s, 'THE SOLUTION', 0.3);
  h1(s, 'One Stream. Every Platform.\nEvery Viewer, Present.', 0.65, { size: 34, h: 1.3 });

  // Three feature cards
  const features = [
    {
      num: '01', color: C.accent, darkBg: C.accentDark,
      title: 'Multi-Stream Gateway',
      desc: 'Go live once on DITCH. Your stream fans out simultaneously to Twitch, YouTube, TikTok, and Kick.\n\nDITCH is the RTMP origin — so platform cross-streaming restrictions simply don\'t apply.',
      tag: 'Stream everywhere',
    },
    {
      num: '02', color: C.purple, darkBg: C.purpleDark,
      title: 'Participation Engine',
      desc: 'Any viewer on any connected platform can click a link, allow camera access, and appear live on your stream in under 60 seconds.\n\nNot in chat. On screen. Visible to every audience at once.',
      tag: 'Viewers go live',
    },
    {
      num: '03', color: C.green, darkBg: C.greenDark,
      title: 'Unified Chat',
      desc: 'Chat messages from Twitch, YouTube, TikTok, and Kick are normalized and aggregated into a single real-time view.\n\nOne conversation. Not five windows.',
      tag: 'One chat to rule them',
    },
  ];

  features.forEach((f, i) => {
    const cx = 0.5 + i * 4.28;
    rRect(s, cx, 2.2, 4.0, 4.9, C.bgCard, 0.12, f.color, 1.5);
    // Top color accent
    rect(s, cx, 2.2, 4.0, 0.06, f.color);
    // Number
    txt(s, f.num, cx + 0.25, 2.35, 0.55, 0.55, {
      fontSize: 22, bold: true, color: f.color, align: 'center', valign: 'middle',
    });
    txt(s, f.title, cx + 0.2, 3.05, 3.6, 0.65, {
      fontSize: 17, bold: true, color: C.white,
    });
    txt(s, f.desc, cx + 0.2, 3.75, 3.6, 2.7, {
      fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.35,
    });
    // Tag pill at bottom
    rRect(s, cx + 0.2, 6.6, 3.6, 0.35, f.darkBg, 0.15, f.color, 1);
    txt(s, f.tag, cx + 0.2, 6.6, 3.6, 0.35, {
      fontSize: 11, bold: true, color: f.color, align: 'center', valign: 'middle',
    });
  });
}

// ─── SLIDE 5: HOW IT WORKS ─────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'slide' };
  bg(s);
  accentBar(s);

  sectionLabel(s, 'HOW IT WORKS', 0.3);
  h1(s, 'From Creator\'s Browser to Every\nPlatform in Under 60 Seconds', 0.65, { size: 32, h: 1.3 });

  const steps = [
    {
      n: 1, color: C.purple,
      title: 'Creator Goes Live',
      desc: 'Full browser-based studio. Camera, mic, scene layout, screenshare. No software to install. No hardware encoder needed.',
    },
    {
      n: 2, color: C.accent,
      title: 'DITCH Fans Out',
      desc: 'Composite stream is relayed to every connected platform via RTMP. Twitch, YouTube, TikTok, Kick — all simultaneously.',
    },
    {
      n: 3, color: C.green,
      title: 'Viewer Joins Live',
      desc: 'Viewer on any platform clicks the DITCH link → allows camera → appears live on stream in under 60 seconds. Cross-platform.',
    },
  ];

  steps.forEach((step, i) => {
    stepBox(s, step.n, step.title, step.desc, 0.5 + i * 4.28, 2.2, 3.9, step.color);
  });

  // Arrows between steps
  arrowH(s, 4.42, 3.3, 0.36, C.accent);
  arrowH(s, 8.7, 3.3, 0.36, C.accent);

  // Bottom technical detail
  rect(s, 0, 6.55, W, 0.95, C.bgCard);
  txt(s, '⚙  Technical: Canvas compositor (browser) → MediaRecorder → WebSocket → Relay ffmpeg → RTMP fan-out to all destinations', 0.5, 6.6, 12.3, 0.4, {
    fontSize: 11.5, color: C.muted, valign: 'middle',
  });
  txt(s, 'Stream startup: 4–6 seconds', 0.5, 6.92, 4, 0.35, {
    fontSize: 11, color: C.green, bold: true,
  });
  txt(s, 'Compositor: stable 30fps (background-tab safe)', 4.5, 6.92, 6, 0.35, {
    fontSize: 11, color: C.accent, bold: true,
  });
}

// ─── SLIDE 6: WHY DEFENSIBLE ───────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'fade' };
  bg(s);
  accentBar(s, C.purple);

  sectionLabel(s, 'THE MOAT', 0.3);
  h1(s, 'We Control the Origin.\nNobody Else Can.', 0.65, { size: 34, h: 1.3 });

  // Competitive 2x2 matrix
  const cx = 3.7, cy = 2.3, mw = 5.4, mh = 4.4;

  // Quadrant backgrounds
  rect(s, cx, cy, mw / 2, mh / 2, C.bgCardDeep);
  rect(s, cx + mw / 2, cy, mw / 2, mh / 2, C.bgCardDeep);
  rect(s, cx, cy + mh / 2, mw / 2, mh / 2, C.bgCardDeep);
  // DITCH quadrant — highlighted
  rRect(s, cx + mw / 2, cy + mh / 2, mw / 2, mh / 2, C.accentDark, 0.08, C.accent, 2);

  // Axes
  rect(s, cx, cy + mh / 2, mw, 0.03, C.dim);  // x axis
  rect(s, cx + mw / 2, cy, 0.03, mh, C.dim);  // y axis
  // Axis labels
  txt(s, 'Multi-stream Distribution', cx, cy + mh + 0.12, mw, 0.4, {
    fontSize: 12, bold: true, color: C.muted, align: 'center',
  });
  txt(s, '→ LOW', cx + 0.1, cy + mh + 0.08, mw / 2, 0.35, { fontSize: 10, color: C.dim });
  txt(s, 'HIGH →', cx + mw / 2 + 0.1, cy + mh + 0.08, mw / 2, 0.35, { fontSize: 10, color: C.muted });

  // Y axis label (rotated text workaround: manual positioning)
  txt(s, 'Viewer Participation', cx - 1.55, cy + mh / 2 - 0.2, 1.4, mh, {
    fontSize: 12, bold: true, color: C.muted, align: 'center', valign: 'top',
    rotate: 270,
  });
  txt(s, '↑ HIGH', cx - 1.45, cy + 0.1, 1.2, 0.35, { fontSize: 10, color: C.muted, align: 'center' });
  txt(s, '↓ LOW', cx - 1.45, cy + mh - 0.35, 1.2, 0.35, { fontSize: 10, color: C.dim, align: 'center' });

  // Players
  ellipse(s, cx + 0.65, cy + mh / 2 + 0.4, 0.55, 0.55, C.bgCardAlt, C.dim, 1.5);
  txt(s, 'Restream\nCastr', cx + 0.1, cy + mh / 2 + 0.55, 1.6, 0.7, { fontSize: 10, color: C.muted, align: 'center' });

  ellipse(s, cx + 0.65, cy + 0.35, 0.55, 0.55, C.bgCardAlt, C.dim, 1.5);
  txt(s, 'No one', cx + 0.1, cy + 0.5, 1.6, 0.4, { fontSize: 10, color: C.dim, align: 'center' });

  ellipse(s, cx + mw / 2 + 0.65, cy + mh / 2 + 0.4, 0.55, 0.55, C.bgCardAlt, C.dim, 1.5);
  txt(s, 'StreamYard\nOBS', cx + mw / 2 + 0.1, cy + mh / 2 + 0.55, 1.6, 0.7, { fontSize: 10, color: C.muted, align: 'center' });

  // DITCH — top right (best position)
  ellipse(s, cx + mw / 2 + 1.3, cy + 0.65, 0.9, 0.9, C.accent, C.accent, 0);
  txt(s, 'DITCH', cx + mw / 2 + 0.85, cy + 0.7, 1.8, 0.9, {
    fontSize: 16, bold: true, color: C.bg, align: 'center', valign: 'middle',
  });

  // Right side explanation
  rRect(s, 9.5, 2.3, 3.3, 1.65, C.bgCard, 0.12, C.accent, 1.5);
  txt(s, 'DITCH is the only product that does both simultaneously.', 9.7, 2.45, 3.0, 1.3, {
    fontSize: 13.5, bold: true, color: C.white, lineSpacingMultiple: 1.3,
  });

  rRect(s, 9.5, 4.1, 3.3, 1.25, C.bgCard, 0.12, C.purple, 1.5);
  txt(s, 'Architecture is the moat', 9.7, 4.2, 3.0, 0.4, { fontSize: 13, bold: true, color: C.purple });
  txt(s, 'We build the composite frame before it reaches any platform. YouTube can\'t put a Twitch viewer on screen. DITCH can.', 9.7, 4.62, 3.0, 0.65, {
    fontSize: 11, color: C.muted, lineSpacingMultiple: 1.3,
  });

  rRect(s, 9.5, 5.5, 3.3, 1.25, C.bgCard, 0.12, C.green, 1.5);
  txt(s, 'Cannot be replicated', 9.7, 5.6, 3.0, 0.4, { fontSize: 13, bold: true, color: C.green });
  txt(s, 'No single platform can broadcast a competitor\'s viewer simultaneously. DITCH can put any viewer on any platform at once.', 9.7, 6.0, 3.0, 0.65, {
    fontSize: 11, color: C.muted, lineSpacingMultiple: 1.3,
  });
}

// ─── SLIDE 7: GROWTH LOOP ──────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'zoom' };
  bg(s);
  accentBar(s, C.purple);

  sectionLabel(s, 'GROWTH ENGINE', 0.3);
  h1(s, 'The Audience Acquires Itself.', 0.65, { size: 36, h: 0.95, color: C.white });

  // Flywheel — 4 node diamond layout
  const fcx = 5.4, fcy = 4.5, fr = 2.1;
  const nodes = [
    { angle: -90, label: 'Creator streams\nto all platforms', color: C.purple },
    { angle:   0, label: 'Viewer sees\nparticipant on screen', color: C.accent },
    { angle:  90, label: 'Viewer enters\nDITCH channel', color: C.green },
    { angle: 180, label: 'Viewer goes live\nacross all platforms', color: C.orange },
  ];

  const nodeW = 2.4, nodeH = 0.85;

  // Center label
  ellipse(s, fcx - 0.9, fcy - 0.9, 1.8, 1.8, C.bgCard, C.dim, 1.5);
  txt(s, 'SELF-\nFUELING', fcx - 0.9, fcy - 0.9, 1.8, 1.8, {
    fontSize: 12, bold: true, color: C.muted, align: 'center', valign: 'middle', lineSpacingMultiple: 1.2,
  });

  // Draw connector arrows first (behind nodes)
  nodes.forEach((node, i) => {
    const next = nodes[(i + 1) % nodes.length];
    const a1 = node.angle * Math.PI / 180;
    const a2 = next.angle * Math.PI / 180;
    const x1 = fcx + fr * Math.cos(a1);
    const y1 = fcy + fr * Math.sin(a1);
    const x2 = fcx + fr * Math.cos(a2);
    const y2 = fcy + fr * Math.sin(a2);
    // Draw a simple line
    slide_line(s, x1, y1, x2, y2, C.dim, 1.5);
  });

  function slide_line(sl, x1, y1, x2, y2, color, w) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    sl.addShape(pres.ShapeType.line, {
      x: x1, y: y1, w: dx, h: dy,
      line: { color: color || C.dim, width: w || 1 },
    });
  }

  nodes.forEach((node, i) => {
    const a = node.angle * Math.PI / 180;
    const nx = fcx + fr * Math.cos(a) - nodeW / 2;
    const ny = fcy + fr * Math.sin(a) - nodeH / 2;
    rRect(s, nx, ny, nodeW, nodeH, C.bgCard, 0.1, node.color, 1.5);
    txt(s, node.label, nx, ny, nodeW, nodeH, {
      fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle', lineSpacingMultiple: 1.2,
    });
  });

  // Right side — why this matters
  rRect(s, 9.0, 2.2, 3.8, 1.5, C.bgCard, 0.12, C.purple, 1.5);
  txt(s, 'Zero Paid Acquisition', 9.2, 2.3, 3.5, 0.45, { fontSize: 14, bold: true, color: C.purple });
  txt(s, 'Every participant is a walking ad. They clip it, post it. Their friends ask "how do I do that?"', 9.2, 2.75, 3.5, 0.8, { fontSize: 12, color: C.muted, lineSpacingMultiple: 1.3 });

  rRect(s, 9.0, 3.85, 3.8, 1.5, C.bgCard, 0.12, C.accent, 1.5);
  txt(s, 'Creator Reach Works For Us', 9.2, 3.95, 3.5, 0.45, { fontSize: 14, bold: true, color: C.accent });
  txt(s, 'A creator with 50K on YouTube + 30K on Twitch becomes a walking DITCH demo — on both platforms at once.', 9.2, 4.4, 3.5, 0.8, { fontSize: 12, color: C.muted, lineSpacingMultiple: 1.3 });

  rRect(s, 9.0, 5.5, 3.8, 1.5, C.bgCard, 0.12, C.green, 1.5);
  txt(s, 'No Other Platform Can Replicate', 9.2, 5.6, 3.5, 0.45, { fontSize: 14, bold: true, color: C.green });
  txt(s, 'The loop only works because DITCH controls the composite origin. It\'s structural, not operational.', 9.2, 6.05, 3.5, 0.8, { fontSize: 12, color: C.muted, lineSpacingMultiple: 1.3 });
}

// ─── SLIDE 8: BUSINESS MODEL ───────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'fade' };
  bg(s);
  accentBar(s);

  sectionLabel(s, 'BUSINESS MODEL', 0.3);
  h1(s, 'SaaS Today. Ad Network Tomorrow.', 0.65, { size: 34 });

  // LEFT: SaaS card
  rRect(s, 0.5, 2.0, 5.9, 5.2, C.bgCard, 0.12, C.accent, 1.5);
  txt(s, 'REVENUE STREAM 1', 0.75, 2.1, 5.4, 0.4, {
    fontSize: 11, bold: true, color: C.accent, charSpacing: 2,
  });
  txt(s, 'Creator Subscriptions', 0.75, 2.52, 5.4, 0.6, {
    fontSize: 22, bold: true, color: C.white,
  });
  txt(s, 'SaaS — monthly and annual tiers by stream destinations\nand concurrent live participants.', 0.75, 3.15, 5.4, 0.7, {
    fontSize: 13, color: C.muted, lineSpacingMultiple: 1.3,
  });

  // Pricing table
  const tiers = [
    { name: 'Starter', price: '€15/mo', dest: '2 platforms', part: '2 participants' },
    { name: 'Pro',     price: '€39/mo', dest: '5 platforms', part: '6 participants' },
    { name: 'Studio',  price: '€99/mo', dest: 'Unlimited',   part: '12 participants' },
  ];
  tiers.forEach((t, i) => {
    const rowBg = i === 1 ? C.accentDark : C.bgCardAlt;
    const rowBorder = i === 1 ? C.accent : C.dim;
    rRect(s, 0.65, 4.05 + i * 0.9, 5.6, 0.82, rowBg, 0.08, rowBorder, i === 1 ? 1.5 : 0.5);
    txt(s, t.name, 0.85, 4.1 + i * 0.9, 1.3, 0.72, { fontSize: 14, bold: true, color: i === 1 ? C.accent : C.light, valign: 'middle' });
    txt(s, t.price, 2.15, 4.1 + i * 0.9, 1.2, 0.72, { fontSize: 14, bold: true, color: i === 1 ? C.accent : C.light, valign: 'middle', align: 'center' });
    txt(s, t.dest, 3.35, 4.1 + i * 0.9, 1.4, 0.72, { fontSize: 12, color: C.muted, valign: 'middle', align: 'center' });
    txt(s, t.part, 4.75, 4.1 + i * 0.9, 1.4, 0.72, { fontSize: 12, color: C.muted, valign: 'middle', align: 'center' });
  });

  txt(s, '→ Primary revenue driver in Year 1', 0.75, 6.82, 5.4, 0.32, {
    fontSize: 12, color: C.muted, italic: true,
  });

  // RIGHT: DITCH Ads card
  rRect(s, 6.93, 2.0, 5.9, 5.2, C.bgCard, 0.12, C.orange, 1.5);
  txt(s, 'REVENUE STREAM 2', 7.18, 2.1, 5.4, 0.4, {
    fontSize: 11, bold: true, color: C.orange, charSpacing: 2,
  });
  txt(s, 'DITCH Ads', 7.18, 2.52, 5.4, 0.6, {
    fontSize: 22, bold: true, color: C.white,
  });
  txt(s, 'First live participatory ad network. One creator slot.\nBrand plays in that slot every ~30 min — baked into\nthe composite stream, unskippable, unblockable.', 7.18, 3.15, 5.4, 0.9, {
    fontSize: 13, color: C.muted, lineSpacingMultiple: 1.3,
  });

  // CPM comparison
  const rows = [
    { label: 'Single-platform CPM',   val: '€3–6',    color: C.dim },
    { label: 'DITCH Ads CPM (target)', val: '€12–18',  color: C.orange },
  ];
  rows.forEach((r, i) => {
    rRect(s, 7.08, 4.2 + i * 1.0, 5.6, 0.82, C.bgCardAlt, 0.08, i === 1 ? C.orange : C.dim, i === 1 ? 1.5 : 0.5);
    txt(s, r.label, 7.28, 4.25 + i * 1.0, 3.8, 0.72, { fontSize: 13, color: C.muted, valign: 'middle' });
    txt(s, r.val, 11.08, 4.25 + i * 1.0, 1.4, 0.72, { fontSize: 16, bold: true, color: r.color, align: 'right', valign: 'middle' });
  });

  txt(s, '3–4× effective reach of a single-platform buy', 7.18, 6.15, 5.4, 0.4, { fontSize: 13, bold: true, color: C.orange });
  txt(s, '60% creator / 40% DITCH revenue split', 7.18, 6.55, 5.4, 0.35, { fontSize: 12, color: C.muted });
  txt(s, '→ Launches Month 6+ after creator network reaches scale', 7.18, 6.82, 5.4, 0.32, {
    fontSize: 12, color: C.muted, italic: true,
  });
}

// ─── SLIDE 9: MARKET ───────────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'slide' };
  bg(s);
  accentBar(s, C.accent);

  sectionLabel(s, 'MARKET OPPORTUNITY', 0.3);
  h1(s, '$6.8B Market. No Product\nDoes What We Do.', 0.65, { size: 34, h: 1.3 });

  // Funnel / TAM SAM SOM pyramid (drawn as nested rects)
  const funnelX = 0.5, funnelY = 2.2;

  // TAM
  rRect(s, funnelX, funnelY, 7.2, 1.35, C.accentDark, 0.08, C.accent, 1.5);
  txt(s, 'TAM', funnelX + 0.2, funnelY, 1.2, 1.35, { fontSize: 14, bold: true, color: C.accent, valign: 'middle' });
  txt(s, 'Global Live Streaming Market', funnelX + 1.4, funnelY + 0.15, 4.0, 0.45, { fontSize: 14, bold: true, color: C.white });
  txt(s, '$6.8B by 2030  ·  24% CAGR', funnelX + 1.4, funnelY + 0.62, 4.0, 0.4, { fontSize: 13, color: C.muted });
  txt(s, '$6.8B', funnelX + 5.4, funnelY, 1.5, 1.35, { fontSize: 22, bold: true, color: C.accent, align: 'right', valign: 'middle' });

  // SAM
  rRect(s, funnelX + 0.4, funnelY + 1.5, 6.4, 1.35, C.bgCard, 0.08, C.purple, 1.5);
  txt(s, 'SAM', funnelX + 0.6, funnelY + 1.5, 1.2, 1.35, { fontSize: 14, bold: true, color: C.purple, valign: 'middle' });
  txt(s, 'Creator Tools + Influencer Marketing', funnelX + 1.8, funnelY + 1.65, 3.6, 0.45, { fontSize: 14, bold: true, color: C.white });
  txt(s, '$4.2B creator tools  +  $24B influencer market', funnelX + 1.8, funnelY + 2.12, 3.6, 0.4, { fontSize: 13, color: C.muted });
  txt(s, '$28B', funnelX + 5.0, funnelY + 1.5, 1.1, 1.35, { fontSize: 22, bold: true, color: C.purple, align: 'right', valign: 'middle' });

  // SOM
  rRect(s, funnelX + 0.8, funnelY + 3.0, 5.6, 1.35, C.bgCard, 0.08, C.green, 1.5);
  txt(s, 'SOM', funnelX + 1.0, funnelY + 3.0, 1.2, 1.35, { fontSize: 14, bold: true, color: C.green, valign: 'middle' });
  txt(s, '200K–500K mid-tier multi-platform creators', funnelX + 2.2, funnelY + 3.15, 3.2, 0.45, { fontSize: 13, bold: true, color: C.white });
  txt(s, '1% conversion × €39/mo  =  €1M+ ARR', funnelX + 2.2, funnelY + 3.62, 3.2, 0.4, { fontSize: 13, color: C.muted });
  txt(s, '€94M+', funnelX + 4.4, funnelY + 3.0, 1.2, 1.35, { fontSize: 20, bold: true, color: C.green, align: 'right', valign: 'middle' });

  // Right side stat boxes
  const stats = [
    { val: '50M+',  label: 'Active live streamers globally', color: C.accent },
    { val: '2M+',   label: 'Creators earning from live content', color: C.purple },
    { val: '29%',   label: 'Influencer market growth in 2024', color: C.green },
    { val: '$24B',  label: 'Creator economy ad spend (2024)', color: C.orange },
  ];
  stats.forEach((st, i) => {
    metricBox(s, st.val, st.label, 8.3 + (i % 2) * 2.8, 2.1 + Math.floor(i / 2) * 1.85, st.color);
  });

  // Bottom positioning statement
  rect(s, 0, 6.6, W, 0.9, C.accentDark);
  txt(s, 'DITCH\'s beachhead: mid-tier creators (1K–100K followers) who are already on multiple platforms and feel the distribution problem every single stream.', 0.5, 6.65, 12.3, 0.75, {
    fontSize: 13.5, color: C.light, valign: 'middle', lineSpacingMultiple: 1.2,
  });
}

// ─── SLIDE 10: TRACTION ────────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'fade' };
  bg(s);
  accentBar(s, C.green);

  sectionLabel(s, 'TRACTION', 0.3);
  h1(s, 'Live in Production.\nNot a Mockup.', 0.65, { size: 38, h: 1.3, color: C.white });

  // Left checklist
  const items = [
    { text: 'Full browser-based studio — camera, mic, scene switching, screenshare', color: C.green },
    { text: 'Multi-stream relay: live and tested to Twitch and YouTube via RTMP', color: C.green },
    { text: 'Participant flow end-to-end: request → approve → on screen', color: C.green },
    { text: 'Unified chat aggregation across all connected platforms', color: C.green },
    { text: 'Canvas compositor: background-tab safe at stable 30fps', color: C.green },
    { text: 'Deployed: Vercel (frontend) · Railway (API, relay, realtime) · Supabase', color: C.green },
    { text: 'First successful YouTube RTMP stream confirmed in production', color: C.accent },
    { text: 'Auto-reconnect on relay failure (5-attempt backoff)', color: C.accent },
  ];

  items.forEach((item, i) => {
    checkItem(s, item.text, 0.5, 2.25 + i * 0.54, item.color);
  });

  // Right metric callouts
  metricBox(s, '4–6s', 'Stream startup latency', 9.3, 2.15, C.green);
  metricBox(s, '30fps', 'Stable with tab\nbackgrounded', 9.3, 3.85, C.accent);
  metricBox(s, 'H264', 'Zero re-encode\ncodec path', 9.3, 5.55, C.purple);

  // URL callout
  rect(s, 0, 6.6, W, 0.9, C.greenDark);
  txt(s, 'Live now at  ditchlive.app  →  frontend on Vercel · API + relay on Railway · DB on Supabase', 0, 6.6, W, 0.9, {
    fontSize: 15, bold: true, color: C.green, align: 'center', valign: 'middle',
  });
}

// ─── SLIDE 11: TEAM ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'slide' };
  bg(s);
  accentBar(s, C.purple);

  sectionLabel(s, 'THE TEAM', 0.3);
  h1(s, 'Built by People Who Know\nWhy This Is Hard.', 0.65, { size: 34, h: 1.3 });

  // Member cards
  const members = [
    {
      name: 'Sandesh Chapagain',
      role: 'Co-Founder · Engineering',
      bio: 'Engineering Sciences @ Università Tor Vergata, Rome. Built the full DITCH stack — canvas compositor, RTMP relay, WebRTC pipeline, API, realtime server. Knows exactly where the hard problems are.',
      tag: 'Full-stack · WebRTC · Infra',
      color: C.accent,
    },
    {
      name: 'Dex',
      role: 'Co-Founder · Product & Strategy',
      bio: 'Product architecture and go-to-market strategy for DITCH. Defined the three-layer product (multi-stream · participation · DITCH Ads). Built the business model, pitch, and content strategy.',
      tag: 'Product · GTM · Business',
      color: C.purple,
    },
  ];

  members.forEach((m, i) => {
    const cx = 1.0 + i * 6.2;
    rRect(s, cx, 2.15, 5.5, 4.9, C.bgCard, 0.12, m.color, 1.5);
    // Avatar placeholder
    ellipse(s, cx + 2.0, 2.35, 1.0, 1.0, m.color, m.color, 0);
    txt(s, m.name[0], cx + 2.0, 2.35, 1.0, 1.0, { fontSize: 28, bold: true, color: C.bg, align: 'center', valign: 'middle' });

    txt(s, m.name, cx + 0.2, 3.55, 5.1, 0.55, { fontSize: 19, bold: true, color: C.white, align: 'center' });
    txt(s, m.role, cx + 0.2, 4.1, 5.1, 0.4, { fontSize: 13, color: m.color, align: 'center' });
    txt(s, m.bio, cx + 0.3, 4.58, 4.9, 1.7, { fontSize: 12, color: C.muted, lineSpacingMultiple: 1.35, align: 'center' });
    rRect(s, cx + 0.6, 6.5, 4.3, 0.38, C.bgCardAlt, 0.15, m.color, 1);
    txt(s, m.tag, cx + 0.6, 6.5, 4.3, 0.38, { fontSize: 11, color: m.color, align: 'center', valign: 'middle' });
  });

  // Why DITCH is uniquely theirs
  rRect(s, 0.5, 7.1, 12.3, 0.0, C.bgCard, 0.08, C.dim, 1);  // invisible — just spacing
  txt(s, 'The hardest technical problem in DITCH (background-tab-safe canvas compositor) was built, shipped, and tested in production before pitching anyone.', 0.6, 7.1, 12.0, 0.0, {
    fontSize: 12, color: C.dim, italic: true,
  });
}

// ─── SLIDE 12: THE ASK + CLOSE ─────────────────────────────────
{
  const s = pres.addSlide();
  s.transition = { type: 'fade' };
  bg(s);

  // Dramatic background
  rect(s, 0, 0, W, H, C.bg);
  rect(s, 0, 0, W, H / 2, C.accentDark);
  rect(s, 0, 0, W, 0.07, C.accent);
  rect(s, 0, H - 0.07, W, 0.07, C.accent);

  if (HAS_LOGO) {
    s.addImage({ path: LOGO, x: 0.6, y: 0.4, w: 2.4, h: 0.85, sizing: { type: 'contain', w: 2.4, h: 0.85 } });
  } else {
    txt(s, 'DITCH', 0.6, 0.35, 4, 0.9, { fontSize: 36, bold: true, color: C.white });
  }

  txt(s, 'Stream Once. Reach Everyone.\nBring Them Back.', 0.6, 1.45, 9, 1.6, {
    fontSize: 40, bold: true, color: C.white, lineSpacingMultiple: 1.15,
  });

  txt(s, 'Creators are tired of choosing which audience to ignore.\nViewers are tired of watching through a chat window.\nWe built the product that ends both — and it\'s live right now.', 0.6, 3.2, 9, 1.4, {
    fontSize: 16, color: C.light, lineSpacingMultiple: 1.4,
  });

  // Ask bullets
  rect(s, 0, 4.85, W, 2.0, C.bgCard);
  txt(s, 'What We\'re Looking For', 0.6, 4.95, 8, 0.45, { fontSize: 15, bold: true, color: C.accent });

  const asks = [
    { icon: '◆', text: 'Mentorship from advisors with experience in media tech, creator platforms, or ad networks' },
    { icon: '◆', text: 'Network into European broadcaster relationships, creator agencies, and brand partnerships' },
    { icon: '◆', text: 'Visibility to accelerate our creator beta launch and early brand conversations' },
  ];
  asks.forEach((a, i) => {
    txt(s, a.icon, 0.6, 5.45 + i * 0.42, 0.3, 0.38, { fontSize: 10, color: C.accent, valign: 'middle' });
    txt(s, a.text, 1.0, 5.45 + i * 0.42, 11.5, 0.38, { fontSize: 13.5, color: C.light, valign: 'middle' });
  });

  // Bottom
  rect(s, 0, 6.9, W, 0.6, C.bgCardDeep);
  txt(s, 'ditchlive.app', 0.6, 6.92, 4, 0.4, { fontSize: 14, bold: true, color: C.accent, valign: 'middle' });
  txt(s, 'Startcup Lazio 2026', W - 3.2, 6.92, 2.8, 0.4, { fontSize: 13, color: C.muted, align: 'right', valign: 'middle' });
}

// ─── Save ──────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'DITCH_Pitch_Startcup_Lazio_2026.pptx');
pres.writeFile({ fileName: outPath }).then(() => {
  console.log('✓ Saved:', outPath);
}).catch(err => {
  console.error('Error:', err);
});
