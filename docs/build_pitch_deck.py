"""Build the DITCH Startcup Lazio 2026 pitch deck (10/20/30 rule).

Usage: python3 docs/build_pitch_deck.py
Output: docs/DITCH-Pitch-Deck-SCL2026.pptx

Companion script and speaker notes: docs/startcup-lazio-2026-pitch-deck.md
(the same speaker scripts are embedded in each slide's presenter notes).

Design rules: flat rectangles, one accent per slide, fixed grid, no shape
may overlap another, and no em or en dashes anywhere in slide text.
"""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "DITCH-Pitch-Deck-SCL2026.pptx"

NAVY = RGBColor(0x0B, 0x0B, 0x14)
CARD = RGBColor(0x14, 0x14, 0x1F)
EDGE = RGBColor(0x26, 0x26, 0x36)
MAGENTA = RGBColor(0xFF, 0x1D, 0xB4)
MINT = RGBColor(0x00, 0xD4, 0xAA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
MUTED = RGBColor(0x8B, 0x8B, 0x9E)
RED = RGBColor(0xFF, 0x54, 0x70)

TWITCH = RGBColor(0x91, 0x46, 0xFF)
YOUTUBE = RGBColor(0xFF, 0x00, 0x00)
TIKTOK = RGBColor(0x00, 0xF2, 0xEA)
KICK = RGBColor(0x53, 0xFC, 0x18)

FONT = "Aptos"

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
MARGIN = Inches(0.9)
CONTENT_W = Inches(11.533)


def blank_slide(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = NAVY
    return slide


def set_run(run, text, *, size=30, color=WHITE, bold=False, italic=False, link=None):
    run.text = text
    f = run.font
    f.name = FONT
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    if link:
        run.hyperlink.address = link


def add_text(slide, left, top, width, height, paragraphs, *, align=PP_ALIGN.LEFT,
             anchor=MSO_ANCHOR.TOP, line=1.1, space_after=4):
    """paragraphs: list of paragraphs, each a list of (text, kwargs) runs."""
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, runs in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line
        p.space_after = Pt(space_after)
        for text, kwargs in runs:
            set_run(p.add_run(), text, **kwargs)
    return tf


def rect(slide, left, top, width, height, *, fill=CARD, edge=EDGE, edge_w=1.0):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if edge is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = edge
        shape.line.width = Pt(edge_w)
    shape.shadow.inherit = False
    return shape


def panel(slide, left, top, width, height, *, edge=EDGE):
    shape = rect(slide, left, top, width, height, edge=edge)
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Inches(0.25)
    tf.margin_top = tf.margin_bottom = Inches(0.15)
    return tf


def panel_lines(tf, lines, *, align=PP_ALIGN.CENTER):
    """lines: list of (text, kwargs) tuples, one paragraph each."""
    for i, (text, kwargs) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = 1.1
        p.space_after = Pt(4)
        set_run(p.add_run(), text, **kwargs)


def hairline(slide, top, *, left=MARGIN, width=CONTENT_W):
    rect(slide, left, top, width, Pt(1.4), fill=EDGE, edge=None)


def header(slide, number, kicker, title, *, title_size=44):
    add_text(slide, MARGIN, Inches(0.55), CONTENT_W, Inches(0.35),
             [[(f"{number:02d} · {kicker.upper()}", dict(size=14, color=MUTED, bold=True))]])
    add_text(slide, MARGIN, Inches(0.98), CONTENT_W, Inches(0.85),
             [[(title, dict(size=title_size, color=WHITE, bold=True))]])
    hairline(slide, Inches(1.98))


def footer(slide, number):
    add_text(slide, SLIDE_W - Inches(1.6), SLIDE_H - Inches(0.42), Inches(1.2),
             Inches(0.3), [[(f"DITCH · {number}", dict(size=12, color=MUTED))]],
             align=PP_ALIGN.RIGHT)


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text.strip()


def three_cols():
    w = Inches(3.644)
    gap = Inches(0.3)
    return [(Inches(0.9) + i * (w + gap), w) for i in range(3)]


prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H

# ------------------------------------------------------------------ 1 · TITLE
s = blank_slide(prs)
add_text(s, MARGIN, Inches(2.0), CONTENT_W, Inches(1.9),
         [[("DITCH", dict(size=120, color=WHITE, bold=True)),
           (".", dict(size=120, color=MAGENTA, bold=True))]], align=PP_ALIGN.CENTER)
add_text(s, MARGIN, Inches(4.1), CONTENT_W, Inches(0.7),
         [[("The livestream studio that turns viewers into the show.",
            dict(size=34, color=MUTED))]], align=PP_ALIGN.CENTER)
add_text(s, MARGIN, Inches(5.35), CONTENT_W, Inches(0.6),
         [[("Sandesh Chapagain, Founder and Engineer", dict(size=30, color=WHITE, bold=True))]],
         align=PP_ALIGN.CENTER)
add_text(s, MARGIN, Inches(6.0), CONTENT_W, Inches(0.55),
         [[("ditchlive.app", dict(size=30, color=MINT, bold=True,
                                  link="https://ditchlive.app"))]], align=PP_ALIGN.CENTER)
footer(s, 1)
notes(s, """
I'm Sandesh, founder of DITCH. I'm going to show you why livestreaming is stuck
in 2015, and the product I've built, live in production today, that unsticks it.
""")

# ---------------------------------------------------------------- 2 · PROBLEM
s = blank_slide(prs)
header(s, 2, "The problem", "Livestreams haven't evolved.")
cards = [
    (["OBS"], ["Powerful,", "but complex"], MUTED),
    (["StreamYard,", "Restream"], ["Simple,", "but shallow"], MUTED),
    (["The audience"], ["Locked in", "a chat box"], RED),
]
for (left, w), (titles, body, color) in zip(three_cols(), cards):
    tf = panel(s, left, Inches(2.4), w, Inches(2.4))
    lines = [(t, dict(size=30, color=color, bold=True)) for t in titles]
    lines += [(b, dict(size=30, color=WHITE)) for b in body]
    panel_lines(tf, lines)
add_text(s, MARGIN, Inches(5.2), CONTENT_W, Inches(1.3),
         [[("Creators must choose between production, reach,", dict(size=34, color=WHITE))],
          [("and participation. ", dict(size=34, color=WHITE)),
           ("They should get all three.", dict(size=34, color=MAGENTA, bold=True))]],
         align=PP_ALIGN.CENTER)
footer(s, 2)
notes(s, """
Livestreams haven't evolved. Creators are stuck on one static camera while
audiences just watch in a chat box.

Existing tools force a choice. OBS is powerful but complex: a desktop app with
a learning curve and zero audience features. StreamYard and Restream are simple
but shallow: they distribute pixels and stop there. And none of them let a
viewer become part of the show.

Multistreaming tools solve reach across platforms, but they sacrifice
production quality and interactivity to do it.

And look at the economics from the creator's side: OBS is free but pays you
nothing. StreamYard and Restream charge you every month just to use their
studio. Nobody in this market pays the creator.

So creators are left choosing between distribution, production, and audience
participation, when they should get all three.
""")

# --------------------------------------------------------------- 3 · SOLUTION
s = blank_slide(prs)
header(s, 3, "The solution", "Ditch gives creators all three.")
cards = [
    ("Production", ["Scenes, layouts,", "screenshare, all", "in the browser"], WHITE, EDGE),
    ("Reach", ["Twitch, YouTube,", "TikTok and Kick", "at once"], WHITE, EDGE),
    ("Participation", ["Any viewer can", "join on camera,", "live everywhere"], MINT, MINT),
]
for (left, w), (title, body, tcolor, edge) in zip(three_cols(), cards):
    tf = panel(s, left, Inches(2.35), w, Inches(2.55), edge=edge)
    lines = [(title, dict(size=30, color=tcolor, bold=True))]
    lines += [(b, dict(size=30, color=WHITE if edge is MINT else MUTED)) for b in body]
    panel_lines(tf, lines)
add_text(s, MARGIN, Inches(5.3), CONTENT_W, Inches(1.2),
         [[("A browser studio layer for livestreaming.", dict(size=34, color=WHITE))],
          [("No downloads. We pay you to go live.", dict(size=34, color=MAGENTA, bold=True))]],
         align=PP_ALIGN.CENTER)
footer(s, 3)
notes(s, """
Ditch is a browser based studio layer for livestreaming.

Creators go live straight from their browser, no downloads, and multistream to
every platform at once while running a real production: scenes, screenshare,
layouts.

And here's the part nobody else does: any viewer can be pulled directly into
the broadcast as a guest, on camera, in real time. A flat one camera stream
becomes an interactive show.

One more thing, and it's the headline of our model: we pay creators to go live
in our studio. Sponsored guest slots share revenue with the creator from day
one. And because Ditch streams natively to YouTube and Twitch, creators keep
every euro of their normal platform ad revenue on top. OBS ignores you.
StreamYard charges you. Ditch pays you. I'll show the numbers on the business
model slide.
""")

# ------------------------------------------------------------------ 4 · MAGIC
s = blank_slide(prs)
header(s, 4, "How it works", "We control the origin.")
tf = panel(s, Inches(0.9), Inches(2.5), Inches(3.5), Inches(1.8), edge=MAGENTA)
panel_lines(tf, [("Browser studio", dict(size=30, color=WHITE, bold=True)),
                 ("creator and guests", dict(size=30, color=MUTED)),
                 ("in one frame", dict(size=30, color=MUTED))])
add_text(s, Inches(4.4), Inches(3.05), Inches(0.6), Inches(0.6),
         [[("→", dict(size=36, color=MUTED, bold=True))]], align=PP_ALIGN.CENTER)
tf = panel(s, Inches(5.0), Inches(2.5), Inches(2.8), Inches(1.8))
panel_lines(tf, [("Ditch relay", dict(size=30, color=WHITE, bold=True)),
                 ("RTMP fan out", dict(size=30, color=MUTED)),
                 ("up to 1080p", dict(size=30, color=MUTED))])
add_text(s, Inches(7.8), Inches(3.05), Inches(0.6), Inches(0.6),
         [[("→", dict(size=36, color=MUTED, bold=True))]], align=PP_ALIGN.CENTER)
platforms = [("Twitch", TWITCH), ("YouTube", YOUTUBE), ("TikTok", TIKTOK), ("Kick", KICK)]
for i, (name, color) in enumerate(platforms):
    y = Inches(2.45) + i * Inches(0.5)
    rect(s, Inches(8.6), y + Inches(0.1), Inches(0.22), Inches(0.22), fill=color, edge=None)
    add_text(s, Inches(9.0), y, Inches(3.4), Inches(0.45),
             [[(name, dict(size=30, color=WHITE, bold=True))]])
add_text(s, MARGIN, Inches(4.85), CONTENT_W, Inches(1.9),
         [[("Guests are baked in before any platform sees it.", dict(size=32, color=WHITE))],
          [("No platform can copy this from inside its walls.", dict(size=32, color=MUTED))],
          [("Viewer to on screen everywhere in under 60 seconds.",
            dict(size=32, color=MINT, bold=True))]],
         align=PP_ALIGN.CENTER, line=1.15)
footer(s, 4)
notes(s, """
The hard problem, solved: Ditch composes the entire broadcast, creator, guests
and scenes, inside the browser, with a proprietary compositor that keeps
producing frames even when the tab is in the background. It streams to our
relay, which fans out to every platform over RTMP, at up to 1080p.

Because Ditch is the origin, not a relay bolted between creator and platform,
cross streaming restrictions don't apply, and guests are baked into the frame
every platform receives.

YouTube cannot put a Twitch viewer on screen. Twitch cannot put a TikTok
viewer on screen. Ditch puts both on screen, on both platforms, at the same
time. No platform can replicate that from inside its own ecosystem. The
architecture is the moat.

And for the viewer it's one click, camera permission, and they're live
everywhere in under a minute. No app, no download.
""")

# ----------------------------------------------------------------- 5 · MARKET
s = blank_slide(prs)
header(s, 5, "The market", "A $345B market by 2030.")
stats = [
    ("$345B", ["live streaming", "market by 2030"], "23% CAGR", MAGENTA),
    ("$480B", ["creator economy", "by 2027"], "Goldman Sachs", WHITE),
    ("$32.5B", ["influencer", "marketing spend"], "2025, global", MINT),
]
for (left, w), (big, label, sub, color) in zip(three_cols(), stats):
    add_text(s, left, Inches(2.5), w, Inches(1.0),
             [[(big, dict(size=60, color=color, bold=True))]], align=PP_ALIGN.CENTER)
    paras = [[(ln, dict(size=30, color=WHITE))] for ln in label]
    paras.append([(sub, dict(size=30, color=MUTED))])
    add_text(s, left, Inches(3.6), w, Inches(1.5), paras, align=PP_ALIGN.CENTER)
hairline(s, Inches(5.25))
add_text(s, MARGIN, Inches(5.5), CONTENT_W, Inches(1.2),
         [[("Beachhead: 200K to 500K mid tier creators streaming",
            dict(size=32, color=WHITE))],
          [("on 2+ platforms. ", dict(size=32, color=WHITE)),
           ("1% on Pro is €0.7M to €1.8M ARR.", dict(size=32, color=MINT, bold=True))]],
         align=PP_ALIGN.CENTER)
footer(s, 5)
notes(s, """
The number we pitched before, 6.8 billion, was only the live streaming software
slice. The real platform market was 87 billion dollars in 2023 and is projected
to reach 345 billion by 2030, growing 23 percent a year (Grand View Research).

It sits inside a creator economy Goldman Sachs expects to reach 480 billion
dollars by 2027, with 32.5 billion of influencer marketing spend in 2025 alone.

Our beachhead is mid tier creators, 1K to 100K followers, already on multiple
platforms and feeling the distribution pain every stream. That's 200 to 500
thousand people globally. Just 1 percent of them on our Pro tier is 0.7 to 1.8
million euro ARR, before a single brand euro.
""")

# --------------------------------------------------------- 6 · BUSINESS MODEL
s = blank_slide(prs)
header(s, 6, "Business model", "The studio that pays creators.")
tiers = [
    ("Pro", "€30", "/mo", ["multistream and", "guest slots"], EDGE, WHITE),
    ("Studio", "€70", "/mo", ["full production,", "power creators"], EDGE, WHITE),
    ("Ditch Ads", "60%", "to creator", ["brands sponsor", "guest slots"], MINT, MINT),
]
for (left, w), (name, big, unit, body, edge, tcolor) in zip(three_cols(), tiers):
    tf = panel(s, left, Inches(2.3), w, Inches(2.75), edge=edge)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(6)
    set_run(p.add_run(), name, size=30, color=tcolor, bold=True)
    p = tf.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(6)
    set_run(p.add_run(), big, size=54, color=WHITE, bold=True)
    set_run(p.add_run(), " " + unit, size=30, color=MUTED)
    for ln in body:
        p = tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        set_run(p.add_run(), ln, size=30, color=MUTED)
add_text(s, MARGIN, Inches(5.45), CONTENT_W, Inches(1.2),
         [[("One sponsored evening can pay for the subscription.",
            dict(size=32, color=WHITE))],
          [("We would rather pay creators than charge them.",
            dict(size=32, color=MAGENTA, bold=True))]],
         align=PP_ALIGN.CENTER)
footer(s, 6)
notes(s, """
Two revenue streams.

One: SaaS. Pro at 30 euro a month, Studio at 70 for power creators, priced
under a StreamYard plus Restream stack while doing more than both.

Two: Ditch Ads, the first participatory ad network. A creator designates one
guest slot as sponsored. Brands buy that slot and reach the creator's Twitch,
YouTube and TikTok audiences in a single buy, baked into the stream,
unskippable, unblockable. Target CPM 12 to 18 euro, and the creator keeps 60
percent.

Run the numbers: two sponsored slots an hour at 2,000 combined viewers pays
the creator roughly 36 euro per streamed hour. One evening of streaming can
pay for the monthly subscription.

So a creator on Ditch stacks three incomes: their normal YouTube and Twitch
ad revenue, which keeps flowing because we stream natively to those platforms;
their Ditch Ads share; and the growth loop bringing them more viewers. OBS is
free and pays nothing. StreamYard and Restream charge for their studio. We are
the only studio that pays its users. That makes adoption a rational decision,
not a cost.
""")

# --------------------------------------------------------------- 7 · THE LOOP
s = blank_slide(prs)
header(s, 7, "Go to market", "The audience acquires itself.")
steps = [
    ("1", ["Viewer sees", "a guest on", "stream"]),
    ("2", ["They join", "the Ditch", "channel"]),
    ("3", ["They go live", "on every", "platform"]),
    ("4", ["Their fans", "come watch"]),
]
w = Inches(2.75)
gap = Inches(0.176)
for i, (num, lines) in enumerate(steps):
    left = Inches(0.9) + i * (w + gap)
    tf = panel(s, left, Inches(2.35), w, Inches(2.1),
               edge=MAGENTA if num == "3" else EDGE)
    all_lines = [(num, dict(size=30, color=MINT, bold=True))]
    all_lines += [(ln, dict(size=30, color=WHITE)) for ln in lines]
    panel_lines(tf, all_lines)
add_text(s, MARGIN, Inches(4.75), CONTENT_W, Inches(0.55),
         [[("and the loop repeats", dict(size=32, color=MINT, bold=True))]],
         align=PP_ALIGN.CENTER)
add_text(s, MARGIN, Inches(5.5), CONTENT_W, Inches(1.2),
         [[("Every guest is an advertisement running", dict(size=32, color=WHITE))],
          [("on every platform at once.", dict(size=32, color=WHITE))]],
         align=PP_ALIGN.CENTER)
footer(s, 7)
notes(s, """
Distribution is the entry hook. Creators already search for multistreaming,
and we win that comparison on price and capability. We seed through streaming
communities and talent agencies.

But the real engine is the product itself. Every viewer who appears on stream
is a walking advertisement, visible across every platform at once. They clip
it, they post it, their friends ask how they can do it too, and the loop
repeats.

Viewer acquisition is product led. The creator's existing reach does the work;
we don't buy audiences.
""")

# ------------------------------------------------------------- 8 · COMPETITION
s = blank_slide(prs)
header(s, 8, "Competition", "Everyone else picks two.")
rows = [
    ("", "Production", "Reach", "On stage"),
    ("OBS", "✓", "✗", "✗"),
    ("Restream", "✗", "✓", "✗"),
    ("StreamYard", "~", "✓", "invited only"),
    ("Twitch / YouTube", "~", "✗", "✗"),
    ("DITCH", "✓", "✓", "any viewer"),
]
table_shape = s.shapes.add_table(len(rows), 4, Inches(0.9), Inches(2.3),
                                 Inches(11.53), Inches(3.72))
table = table_shape.table
table.columns[0].width = Inches(3.4)
for c in range(1, 4):
    table.columns[c].width = Inches(2.71)
for r in range(len(rows)):
    table.rows[r].height = Inches(0.62)
for r, row in enumerate(rows):
    is_header = r == 0
    is_ditch = r == len(rows) - 1
    for c, value in enumerate(row):
        cell = table.cell(r, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(0x22, 0x0B, 0x1C) if is_ditch else CARD
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = cell.margin_right = Inches(0.12)
        cell.margin_top = cell.margin_bottom = Inches(0.02)
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
        if value == "✓":
            color = MINT
        elif value == "✗":
            color = RED
        elif value in ("~", "invited only"):
            color = MUTED
        elif is_ditch:
            color = MAGENTA if c == 0 else MINT
        else:
            color = WHITE
        set_run(p.add_run(), value, size=30, color=color, bold=is_header or is_ditch)
add_text(s, MARGIN, Inches(6.3), CONTENT_W, Inches(0.6),
         [[("Only Ditch turns the audience itself into the show.",
            dict(size=30, color=WHITE))]], align=PP_ALIGN.CENTER)
footer(s, 8)
notes(s, """
Every competitor picks two at most. OBS gives you production and nothing else.
Restream gives you reach and nothing else. StreamYard does invited guests:
pre arranged, capped, and their guests don't come from the audience.

Nobody converts the audience itself into the show, across platforms. That
column is empty because it requires owning the stream origin, which is exactly
what Ditch is.
""")

# ---------------------------------------------------------------- 9 · ROADMAP
s = blank_slide(prs)
header(s, 9, "Roadmap", "Live today. Scaling from here.")
milestones = [
    ("Now", "Live in production. Full studio, 1080p, tested to Twitch and YouTube", MINT),
    ("Q4 2026", "Creator beta. Mobile guest journey, first 100 creators", WHITE),
    ("2027", "500 paying creators. Ditch Ads pilot with direct sold brands", WHITE),
    ("2028", "3,000 paying creators. €2M ARR run rate, programmatic Ditch Ads", MAGENTA),
]
line_x = Inches(2.95)
rect(s, line_x, Inches(2.55), Pt(2), Inches(3.6), fill=EDGE, edge=None)
for i, (when, what, color) in enumerate(milestones):
    y = Inches(2.4) + i * Inches(1.0)
    rect(s, line_x - Inches(0.07), y + Inches(0.16), Inches(0.16), Inches(0.16),
         fill=color, edge=None)
    add_text(s, Inches(0.9), y, Inches(1.85), Inches(0.5),
             [[(when, dict(size=30, color=color, bold=True))]])
    add_text(s, Inches(3.35), y, Inches(9.05), Inches(0.9),
             [[(what, dict(size=30, color=WHITE if color is not MUTED else MUTED))]])
footer(s, 9)
notes(s, """
Where this goes.

Today: the product is live in production at ditchlive.app. Full browser
studio, 1080p output, stream startup in 4 to 6 seconds, the complete viewer to
guest journey working end to end, relay tested against Twitch and YouTube.

Q4 2026: creator beta. The mobile guest journey gets polished first, because
most joining viewers are on phones, then we onboard the first 100 creators
through streaming communities and agencies.

2027: 500 paying creators, which is roughly 18 thousand euro MRR, and the
Ditch Ads pilot with direct sold brand deals.

2028: 3,000 creators, a 2 million euro ARR run rate, and Ditch Ads moving to
programmatic. These figures come from the business plan we submitted.
""")

# ---------------------------------------------------------- 10 · TEAM AND CTA
s = blank_slide(prs)
header(s, 10, "The ask", "One founder. Live product.")
add_text(s, Inches(0.9), Inches(2.3), Inches(5.5), Inches(2.6),
         [[("Sandesh Chapagain", dict(size=34, color=WHITE, bold=True))],
          [("Sole founder and engineer", dict(size=30, color=MAGENTA, bold=True))],
          [("Built the whole stack solo:", dict(size=30, color=MUTED))],
          [("compositor, WebRTC, relay, infra, Engineering Sciences, Tor Vergata",
            dict(size=30, color=MUTED))]])
add_text(s, Inches(7.0), Inches(2.3), Inches(5.4), Inches(2.6),
         [[("The ask", dict(size=34, color=MINT, bold=True))],
          [("Mentors in media tech", dict(size=30, color=WHITE))],
          [("Creator and broadcaster network", dict(size=30, color=WHITE))],
          [("Visibility for the creator beta", dict(size=30, color=WHITE))]])
hairline(s, Inches(5.15))
add_text(s, MARGIN, Inches(5.45), CONTENT_W, Inches(0.8),
         [[("See it live today: ", dict(size=40, color=WHITE, bold=True)),
           ("ditchlive.app", dict(size=40, color=MINT, bold=True,
                                  link="https://ditchlive.app"))]],
         align=PP_ALIGN.CENTER)
add_text(s, MARGIN, Inches(6.35), CONTENT_W, Inches(0.6),
         [[("Stream once. Reach everyone. Bring them back.",
            dict(size=30, color=MAGENTA, bold=True, italic=True))]],
         align=PP_ALIGN.CENTER)
footer(s, 10)
notes(s, """
I'm the sole founder and I built all of this myself: the browser compositor,
the WebRTC guest pipeline, the RTMP relay infrastructure, the realtime chat
layer, and the production deployment. I'm an engineering student at Tor
Vergata here in Rome, and I ship daily.

From Startcup Lazio I'm looking for three things: mentorship from people
who've built in media tech or creator platforms; network into creator agencies
and European broadcasters; and the visibility to run the creator beta at scale.

And you don't have to take my word for any of it. Open ditchlive.app right
now, the studio demo runs in the landing page.

Creators are tired of choosing which audience to ignore. Viewers are tired of
watching through a chat window. Ditch ends both, and it's live right now.

Thank you.
""")

prs.save(OUTPUT)
print(f"Wrote {OUTPUT} ({len(prs.slides)} slides)")
