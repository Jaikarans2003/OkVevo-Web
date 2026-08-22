# Talking Head Recut — Style HTML References

Source: `Skills/hyperframes/talking-head-recut/references/styles`

All HTML below is copied as-is from the original files.

## Contents

- [academic.html](#academichtml)
- [editorial.html](#editorialhtml)
- [minimal.html](#minimalhtml)
- [swiss.html](#swisshtml)
- [terminal.html](#terminalhtml)
- [whiteboard.html](#whiteboardhtml)
- [xhs.html](#xhshtml)

---

## academic.html

```html
<!--
  Style: academic — warm paper · serif · blue highlight · coral annotation
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg     #f1ead8   (warm paper)
    ink    #1a1d2b
    muted  #5b5749
    accent #2557a7   (blue, used for kicker chip + text highlight)
    accent2#c14d2c   (coral, used for dashed quote box)
  Fonts
    headline & body — serif. Falls back to "ui-serif, 'Songti SC', serif"
    mono — "ui-monospace, monospace"
  Best with
    layouts: split, stack, pip
    frames:  clean, hairline
    content: 访谈反思 / 学术总结 / 长视频拆解
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · academic</title>
    <style>
      /* preview wrapper — NOT part of the card fragment */
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-academic">
          <style>
            .card[data-card-id="ref-academic"] .root {
              --bg: #f1ead8;
              --ink: #1a1d2b;
              --muted: #5b5749;
              --accent: #2557a7;
              --accent2: #c14d2c;
              --font-head: ui-serif, "Songti SC", "Times New Roman", serif;
              --font-body: ui-serif, "Songti SC", "Times New Roman", serif;
              --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background-color: var(--bg);
              background-image:
                linear-gradient(rgba(91, 87, 73, 0.2) 1px, transparent 1px),
                linear-gradient(90deg, rgba(91, 87, 73, 0.2) 1px, transparent 1px),
                radial-gradient(120% 80% at 50% 0%, #fff8e9 0%, transparent 60%);
              background-size:
                28px 28px,
                28px 28px,
                100% 100%;
              padding: 32px 40px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 16px;
              color: var(--ink);
              font-family: var(--font-body);
            }
            .card[data-card-id="ref-academic"] .meta {
              display: flex;
              align-items: baseline;
              gap: 14px;
            }
            .card[data-card-id="ref-academic"] .kicker {
              padding: 7px 14px;
              background: var(--accent);
              color: #fff;
              font: 700 16px/1 var(--font-mono);
              letter-spacing: 0.16em;
            }
            .card[data-card-id="ref-academic"] .time {
              font: 15px/1 var(--font-mono);
              color: var(--muted);
              letter-spacing: 0.1em;
            }
            .card[data-card-id="ref-academic"] .title {
              margin: 0;
              font: 700 92px/1.05 var(--font-head);
              color: var(--ink);
              letter-spacing: 0.01em;
              display: inline;
              background: linear-gradient(
                transparent 62%,
                rgba(37, 87, 167, 0.2) 62%,
                rgba(37, 87, 167, 0.2) 92%,
                transparent 92%
              );
              -webkit-box-decoration-break: clone;
              box-decoration-break: clone;
              padding: 0 8px;
            }
            .card[data-card-id="ref-academic"] .detail {
              margin: 0;
              font: 30px/1.5 var(--font-body);
              color: var(--muted);
              max-width: 94%;
            }
            .card[data-card-id="ref-academic"] .hl {
              background: linear-gradient(transparent 60%, rgba(37, 87, 167, 0.25) 60%);
              padding: 0 4px;
            }
            .card[data-card-id="ref-academic"] .quote {
              align-self: flex-start;
              padding: 10px 18px;
              border: 1.5px dashed var(--accent2);
              color: var(--accent2);
              font: italic 600 24px/1 var(--font-head);
              transform: rotate(-1deg);
            }
          </style>

          <div class="root">
            <div class="meta">
              <span class="kicker" data-anim="fade-in" data-anim-at="0.05" data-anim-duration="0.4"
                >TAKEAWAY</span
              >
              <span class="time">00:18 → 00:46</span>
            </div>

            <h2
              class="title"
              data-anim="kinetic-chars"
              data-anim-at="0.25"
              data-anim-duration="0.55"
              data-anim-stagger="0.04"
              data-anim-pattern="pop"
            >
              <span class="char">少</span><span class="char">即</span><span class="char">是</span>
              <span class="char">多</span>
            </h2>

            <p class="detail" data-anim="fade-in" data-anim-at="0.7" data-anim-duration="0.45">
              复杂的解释往往是<span class="hl">未经压缩的思考</span
              >。当你能用最少的词说清最重要的点时， 你也就真正想明白了这件事。
            </p>

            <div class="quote" data-anim="scale-pop" data-anim-at="1.05" data-anim-duration="0.5">
              "Compression is comprehension."
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

---



## editorial.html

```html
<!--
  Style: editorial — cream · coral block · big italic quote · Playfair-like serif
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg      #f1e8d5   (cream)
    ink     #0e1018
    muted   #6b6353
    accent  #ff3a2d   (coral red — used as block accents + italic quote color)
    accent2 #1f6bff   (blue — used for ring/circle outline)
    accent3 #f2cf3a   (yellow dot)
  Fonts
    headline — Playfair Display fallback: ui-serif, "Songti SC", serif
    body     — ui-serif, serif
  Best with
    layouts: overlay, pip, stack
    frames:  clean, polaroid
    content: 产品发布 / 编辑专栏 / 大字宣言
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · editorial</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-editorial">
          <style>
            .card[data-card-id="ref-editorial"] .root {
              --bg: #f1e8d5;
              --ink: #0e1018;
              --muted: #6b6353;
              --accent: #ff3a2d;
              --accent2: #1f6bff;
              --accent3: #f2cf3a;
              /* IMPORTANT — this skill only ships Caveat / LXGW WenKai TC / Inter / Virgil.
         Playfair Display is NOT bundled; if you list it first the font resolver
         can't load it and you'll get inconsistent rendering across machines.
         The editorial look uses italic-bold serif at large size — ui-serif on
         macOS resolves to Times/New York which is close enough; for a real
         Playfair you'd need to add the woff2 to public/fonts/. */
              --font-head: ui-serif, "Songti SC", "Times New Roman", serif;
              --font-body: ui-serif, "Songti SC", serif;
              --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background: var(--bg);
              padding: 56px 64px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 24px;
              color: var(--ink);
              font-family: var(--font-body);
            }
            .card[data-card-id="ref-editorial"] .kicker {
              align-self: flex-start;
              padding: 8px 16px;
              background: var(--ink);
              color: var(--bg);
              font: 700 16px/1 var(--font-mono);
              letter-spacing: 0.22em;
            }
            .card[data-card-id="ref-editorial"] .title {
              margin: 0;
              font: italic 800 132px/0.95 var(--font-head);
              color: var(--ink);
              letter-spacing: -0.01em;
              max-width: 92%;
            }
            .card[data-card-id="ref-editorial"] .first {
              font-style: italic;
              color: var(--accent);
            }
            .card[data-card-id="ref-editorial"] .quote-mark {
              font: 800 220px/0.5 var(--font-head);
              color: var(--accent);
              position: absolute;
              top: 24px;
              right: 64px;
              opacity: 0.9;
            }
            .card[data-card-id="ref-editorial"] .detail {
              margin: 0;
              font: 28px/1.5 var(--font-body);
              color: var(--muted);
              max-width: 78%;
            }
            .card[data-card-id="ref-editorial"] .hl {
              background: linear-gradient(transparent 62%, rgba(255, 58, 45, 0.22) 62%);
              color: var(--ink);
              padding: 0 4px;
            }
            .card[data-card-id="ref-editorial"] .accents {
              position: absolute;
            }
            .card[data-card-id="ref-editorial"] .block-coral {
              top: 64px;
              right: 88px;
              width: 96px;
              height: 96px;
              background: var(--accent);
              transform: rotate(12deg);
            }
            .card[data-card-id="ref-editorial"] .dot-yellow {
              top: 200px;
              right: 60px;
              width: 36px;
              height: 36px;
              background: var(--accent3);
              border-radius: 50%;
            }
            .card[data-card-id="ref-editorial"] .ring-blue {
              bottom: 80px;
              right: 80px;
              width: 80px;
              height: 80px;
              border: 4px solid var(--accent2);
              border-radius: 50%;
            }
          </style>

          <div class="root">
            <span
              class="accents block-coral"
              data-anim="scale-pop"
              data-anim-at="0.15"
              data-anim-duration="0.5"
            ></span>
            <span
              class="accents dot-yellow"
              data-anim="fade-in"
              data-anim-at="0.35"
              data-anim-duration="0.4"
            ></span>
            <span
              class="accents ring-blue"
              data-anim="fade-in"
              data-anim-at="0.55"
              data-anim-duration="0.4"
            ></span>

            <span class="kicker" data-anim="fade-in" data-anim-at="0.05" data-anim-duration="0.4"
              >TAKEAWAY</span
            >

            <h1 class="title" data-anim="fade-in" data-anim-at="0.3" data-anim-duration="0.6">
              <span class="first">真</span>正的创造，从拒绝套路开始。
            </h1>

            <p class="detail" data-anim="fade-in" data-anim-at="0.8" data-anim-duration="0.45">
              停止模仿、停止套模板，把每一个想法都当作<span class="hl">第一次表达</span>。
              只有这样，作品才会带上你的体温。
            </p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

---



## minimal.html

```html
<!--
  Style: minimal — pure black on white · huge type · generous space
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg     #ffffff
    ink    #000000
    muted  #6b7280
    accent #000000  (no color; weight & size do the work)
  Fonts
    headline & body — Inter, ui-sans-serif, system-ui, sans-serif
  Best with
    layouts: split, stack, overlay
    frames:  clean, hairline
    content: 极简陈述 / 数据揭示 / 大字标题
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · minimal</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-minimal">
          <style>
            .card[data-card-id="ref-minimal"] .root {
              --bg: #ffffff;
              --ink: #000000;
              --muted: #6b7280;
              --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background: var(--bg);
              color: var(--ink);
              padding: 80px 96px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 56px;
              font-family: var(--font-sans);
            }
            .card[data-card-id="ref-minimal"] .kicker {
              font: 600 14px/1 var(--font-sans);
              letter-spacing: 0.32em;
              color: var(--ink);
              text-transform: uppercase;
            }
            .card[data-card-id="ref-minimal"] .title {
              margin: 0;
              font: 900 132px/0.95 var(--font-sans);
              color: var(--ink);
              letter-spacing: -0.04em;
            }
            .card[data-card-id="ref-minimal"] .detail {
              margin: 0;
              font: 400 36px/1.4 var(--font-sans);
              color: var(--muted);
              max-width: 82%;
              letter-spacing: -0.005em;
            }
            .card[data-card-id="ref-minimal"] .rule {
              width: 0;
              height: 4px;
              background: var(--ink);
            }
          </style>

          <div class="root">
            <span class="kicker" data-anim="fade-in" data-anim-at="0.05" data-anim-duration="0.4"
              >TAKEAWAY</span
            >

            <h1
              class="title"
              data-anim="kinetic-chars"
              data-anim-at="0.3"
              data-anim-duration="0.6"
              data-anim-stagger="0.05"
              data-anim-pattern="pop"
            >
              <span class="char">五</span><span class="char">秒</span><span class="char">决</span
              ><span class="char">定</span> <span class="char">一</span><span class="char">切</span>
            </h1>

            <div
              class="rule"
              data-anim="grow-x"
              data-anim-at="0.9"
              data-anim-duration="0.5"
              data-anim-target-w="240"
            ></div>

            <p class="detail" data-anim="fade-in" data-anim-at="1.05" data-anim-duration="0.45">
              用户给一个新界面的时间不超过五秒。这意味着第一屏不需要解释，需要让人立刻知道这是什么、为什么有用。
            </p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

---



## swiss.html

```html
<!--
  Style: swiss — pure white · Helvetica · strict double rules · red accent slab
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg     #ffffff
    ink    #111111
    muted  #555555
    accent #e8190f   (signal red — slab + number)
  Fonts
    headline & body — Helvetica / Inter / system sans
  Best with
    layouts: split, stack, overlay
    frames:  clean, hairline
    content: 严肃陈述 / 排版主导 / 文化机构 / 极简数据
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · swiss</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-swiss">
          <style>
            .card[data-card-id="ref-swiss"] .root {
              --bg: #ffffff;
              --ink: #111111;
              --muted: #555555;
              --accent: #e8190f;
              --font-sans:
                "Helvetica Neue", Helvetica, "Inter", ui-sans-serif, system-ui, sans-serif;
              --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background: var(--bg);
              color: var(--ink);
              font-family: var(--font-sans);
              padding: 48px 64px;
              box-sizing: border-box;
              display: grid;
              grid-template-rows: auto 1fr auto;
              gap: 24px;
            }
            .card[data-card-id="ref-swiss"] .top-rule {
              height: 4px;
              background: var(--ink);
            }
            .card[data-card-id="ref-swiss"] .top-meta {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              padding-top: 12px;
              font: 700 14px/1 var(--font-mono);
              letter-spacing: 0.26em;
              color: var(--ink);
              text-transform: uppercase;
            }
            .card[data-card-id="ref-swiss"] .top-meta .num {
              color: var(--accent);
            }
            .card[data-card-id="ref-swiss"] .body {
              display: grid;
              grid-template-columns: 1fr 320px;
              gap: 56px;
              align-items: end;
            }
            .card[data-card-id="ref-swiss"] .title {
              margin: 0;
              font: 700 116px/0.95 var(--font-sans);
              color: var(--ink);
              letter-spacing: -0.025em;
            }
            .card[data-card-id="ref-swiss"] .title .red {
              color: var(--accent);
            }
            .card[data-card-id="ref-swiss"] .detail {
              margin: 0;
              font: 400 24px/1.45 var(--font-sans);
              color: var(--muted);
            }
            .card[data-card-id="ref-swiss"] .slab {
              background: var(--accent);
              color: #fff;
              padding: 24px 28px;
              font: 700 56px/1 var(--font-sans);
              letter-spacing: -0.02em;
              align-self: end;
            }
            .card[data-card-id="ref-swiss"] .slab small {
              display: block;
              font: 600 14px/1 var(--font-mono);
              letter-spacing: 0.18em;
              margin-top: 6px;
              color: rgba(255, 255, 255, 0.85);
            }
            .card[data-card-id="ref-swiss"] .bottom-rule {
              height: 1px;
              background: var(--ink);
            }
            .card[data-card-id="ref-swiss"] .bottom-meta {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              padding-top: 12px;
              font: 600 13px/1 var(--font-mono);
              letter-spacing: 0.22em;
              color: var(--muted);
            }
          </style>

          <div class="root">
            <div>
              <div
                class="top-rule"
                data-anim="grow-x"
                data-anim-at="0.05"
                data-anim-duration="0.45"
                data-anim-target-w="1792"
              ></div>
              <div
                class="top-meta"
                data-anim="fade-in"
                data-anim-at="0.3"
                data-anim-duration="0.35"
              >
                <span>V—TAKE / TAKEAWAY</span>
                <span class="num">№ 09</span>
              </div>
            </div>

            <div class="body">
              <h2 class="title" data-anim="fade-in" data-anim-at="0.45" data-anim-duration="0.55">
                <span class="red">设计</span>不是装饰，<br />而是结构。
              </h2>
              <div
                class="slab"
                data-anim="slide-in"
                data-anim-at="0.55"
                data-anim-duration="0.45"
                data-anim-from="right"
                data-anim-distance="120"
              >
                92<small>STRUCTURE INDEX</small>
              </div>
            </div>

            <div>
              <div class="bottom-rule"></div>
              <div class="bottom-meta">
                <span>RATIO 1 : 1.618</span>
                <span>00:42 → 01:14</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

---



## terminal.html

```html
<!--
  Style: terminal — dark · JetBrains Mono · ASCII border · prompt · multi-color highlight
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg     #0d1117   (deep terminal)
    ink    #e6edf3
    muted  #7d8590
    accent #4ade80   (green — primary output)
    accent2#fbbf24   (amber — string/warn)
    accent3#f472b6   (magenta — variable)
    accent4#60a5fa   (blue — function/path)
  Fonts
    mono (everything) — ui-monospace, "SF Mono", Menlo, monospace
    (Real JetBrains Mono would need a woff2 ship; mono fallback fine.)
  Best with
    layouts: split, pip
    frames:  hairline, clean
    content: 技术分析 / 代码片段 / 性能数据 / 工程思考
  Notes
    - "Blinking cursor" must be a CSS animation, NOT a data-anim. Allowed
      because pure CSS @keyframes on a single visual indicator is harmless.
    - For animated reveal of lines, use data-anim="fade-in" per line.
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · terminal</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-terminal">
          <style>
            .card[data-card-id="ref-terminal"] .root {
              --bg: #0d1117;
              --ink: #e6edf3;
              --muted: #7d8590;
              --green: #4ade80;
              --amber: #fbbf24;
              --magenta: #f472b6;
              --blue: #60a5fa;
              --font-mono: ui-monospace, "SF Mono", Menlo, "Courier New", monospace;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background: var(--bg);
              color: var(--ink);
              padding: 36px 48px;
              box-sizing: border-box;
              font: 28px/1.55 var(--font-mono);
            }
            .card[data-card-id="ref-terminal"] .ascii-frame {
              position: absolute;
              inset: 16px;
              border: 2px solid #2c333e;
              border-radius: 6px;
              box-shadow:
                inset 0 0 0 1px #1a1f27,
                0 0 0 1px #06080c;
            }
            .card[data-card-id="ref-terminal"] .titlebar {
              position: absolute;
              left: 36px;
              top: 12px;
              padding: 0 8px;
              background: var(--bg);
              font: 600 14px/1 var(--font-mono);
              color: var(--muted);
              letter-spacing: 0.12em;
            }
            .card[data-card-id="ref-terminal"] .content {
              position: relative;
              padding: 18px 12px;
              display: flex;
              flex-direction: column;
              gap: 14px;
            }
            .card[data-card-id="ref-terminal"] .prompt {
              color: var(--green);
            }
            .card[data-card-id="ref-terminal"] .line .blue {
              color: var(--blue);
            }
            .card[data-card-id="ref-terminal"] .line .amber {
              color: var(--amber);
            }
            .card[data-card-id="ref-terminal"] .line .pink {
              color: var(--magenta);
            }
            .card[data-card-id="ref-terminal"] .line .green {
              color: var(--green);
            }
            .card[data-card-id="ref-terminal"] .line .muted {
              color: var(--muted);
            }
            .card[data-card-id="ref-terminal"] .kicker {
              color: var(--muted);
              font: 600 16px/1 var(--font-mono);
              letter-spacing: 0.22em;
              margin-bottom: 4px;
            }
            .card[data-card-id="ref-terminal"] .headline {
              font: 700 56px/1.15 var(--font-mono);
              color: var(--ink);
              margin: 4px 0 14px;
            }
            .card[data-card-id="ref-terminal"] .headline .hl {
              background: rgba(74, 222, 128, 0.18);
              color: var(--green);
              padding: 0 6px;
            }
            .card[data-card-id="ref-terminal"] .cursor {
              display: inline-block;
              width: 14px;
              height: 28px;
              background: var(--green);
              margin-left: 4px;
              vertical-align: -4px;
              animation: ref-term-blink 1s steps(1) infinite;
            }
            @keyframes ref-term-blink {
              50% {
                opacity: 0;
              }
            }
          </style>

          <div class="root">
            <div class="ascii-frame"></div>
            <span class="titlebar">~/notes/takeaway-007.md</span>

            <div class="content">
              <div class="kicker" data-anim="fade-in" data-anim-at="0.05" data-anim-duration="0.3">
                $ cat takeaway
              </div>

              <h2
                class="headline"
                data-anim="fade-in"
                data-anim-at="0.25"
                data-anim-duration="0.45"
              >
                缓存命中率提升到 <span class="hl">92%</span>
              </h2>

              <div class="line" data-anim="fade-in" data-anim-at="0.55" data-anim-duration="0.35">
                <span class="prompt">$</span> bench --tier <span class="amber">"hot"</span>
                <span class="muted">--n 10k</span>
              </div>
              <div class="line" data-anim="fade-in" data-anim-at="0.8" data-anim-duration="0.35">
                <span class="muted">→</span> <span class="blue">p50</span>=<span class="green"
                  >12ms</span
                >
                <span class="blue">p99</span>=<span class="green">38ms</span>
                <span class="pink">hit</span>=<span class="green">92.4%</span>
              </div>
              <div class="line" data-anim="fade-in" data-anim-at="1.05" data-anim-duration="0.35">
                <span class="muted">// before this change: hit=63%, p99=210ms</span>
              </div>
              <div class="line" data-anim="fade-in" data-anim-at="1.35" data-anim-duration="0.3">
                <span class="prompt">$</span><span class="cursor"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

---



## whiteboard.html

```html
<!--
  Style: whiteboard — paper · Caveat handwriting · sketched borders · marker highlight
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg     #fdf6e3   (warm paper)
    ink    #1a1a1a
    muted  #6e6a5b
    accent #ff6b35   (orange marker)
    accent2#2557a7   (blue pen — annotations)
    accent3#ffe066   (yellow highlighter)
  Fonts
    headline & body — Caveat (handwriting); falls back to "ui-serif, cursive"
    annotations    — Caveat
  Best with
    layouts: pip, overlay, split
    frames:  polaroid, clean
    content: 教程 / 解构 / 草图思考 / 灵感整理
  Notes
    - SVG strokes have subtle path jitter to look hand-drawn.
    - data-anim "draw-path" is ideal for the sketched border + highlights.
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · whiteboard</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-whiteboard">
          <style>
            .card[data-card-id="ref-whiteboard"] .root {
              --bg: #fdf6e3;
              --ink: #1a1a1a;
              --muted: #6e6a5b;
              --accent: #ff6b35;
              --accent2: #2557a7;
              --accent3: #ffe066;
              --font-hand: "Caveat", "LXGW WenKai TC", ui-serif, cursive;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background-color: var(--bg);
              background-image:
                radial-gradient(circle at 30% 20%, rgba(0, 0, 0, 0.025) 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.02) 0%, transparent 50%);
              padding: 48px 56px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 26px;
              color: var(--ink);
              font-family: var(--font-hand);
            }
            .card[data-card-id="ref-whiteboard"] .sketch-border {
              position: absolute;
              inset: 16px;
              pointer-events: none;
            }
            .card[data-card-id="ref-whiteboard"] .sketch-border path {
              stroke: var(--ink);
              stroke-width: 3;
              fill: none;
              stroke-linecap: round;
              stroke-linejoin: round;
            }
            .card[data-card-id="ref-whiteboard"] .kicker {
              align-self: flex-start;
              font: 700 32px/1 var(--font-hand);
              color: var(--accent);
              transform: rotate(-2deg);
              padding-left: 8px;
            }
            .card[data-card-id="ref-whiteboard"] .title {
              margin: 0;
              font: 700 120px/1 var(--font-hand);
              color: var(--ink);
            }
            .card[data-card-id="ref-whiteboard"] .marker {
              position: relative;
              display: inline-block;
              padding: 0 8px;
              color: var(--ink);
            }
            .card[data-card-id="ref-whiteboard"] .marker::before {
              content: "";
              position: absolute;
              left: 0;
              right: 0;
              top: 30%;
              bottom: 18%;
              background: var(--accent3);
              z-index: -1;
              transform: skewX(-4deg);
            }
            .card[data-card-id="ref-whiteboard"] .detail {
              margin: 0;
              font: 400 40px/1.4 var(--font-hand);
              color: var(--muted);
              max-width: 92%;
            }
            .card[data-card-id="ref-whiteboard"] .note {
              align-self: flex-start;
              padding: 6px 12px;
              font: 600 28px/1 var(--font-hand);
              color: var(--accent2);
              border-bottom: 3px wavy var(--accent2);
              transform: rotate(-1deg);
            }
          </style>

          <div class="root">
            <svg class="sketch-border" viewBox="0 0 1888 1048" preserveAspectRatio="none">
              <path
                d="M 12 12 L 1876 16 L 1872 1036 L 16 1032 Z"
                data-anim="draw-path"
                data-anim-at="0.05"
                data-anim-duration="0.8"
              />
            </svg>

            <span class="kicker" data-anim="fade-in" data-anim-at="0.1" data-anim-duration="0.4">
              ✎ TAKEAWAY
            </span>

            <h2 class="title" data-anim="fade-in" data-anim-at="0.4" data-anim-duration="0.5">
              把复杂问题<span class="marker">画出来</span>。
            </h2>

            <p class="detail" data-anim="fade-in" data-anim-at="0.85" data-anim-duration="0.45">
              文字让人争辩，图让人对齐。当所有人都在白板前看同一张图，分歧自然消失。
            </p>

            <span class="note" data-anim="fade-in" data-anim-at="1.2" data-anim-duration="0.4">
              ← 试试每次会议都画
            </span>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

---



## xhs.html

```html
<!--
  Style: xhs (小红书) — cream + hot pink · chips · #hashtags · ❤️💬 row
  ─────────────────────────────────────────────────────────────────────
  Tokens
    bg     #fff5e9   (warm cream)
    ink    #1d1418
    muted  #8a7a78
    accent #ff2e63   (hot pink — chip + interaction icon)
    accent2#ff8a4c   (orange — tag)
    accent3#f0c419   (yellow — pin)
  Fonts
    headline & body — Noto Sans SC fallback: ui-sans-serif, system-ui, "PingFang SC", sans-serif
  Best with
    layouts: overlay, stack (especially in portrait/9:16)
    frames:  clean, polaroid
    content: 社交剪辑 / 生活方式 / 种草 / 短视频高光
-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>style · xhs (小红书)</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .stage {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        transform: scale(0.5);
        overflow: hidden;
      }
      .card-host {
        position: absolute;
        left: 0;
        top: 0;
        width: 1920px;
        height: 1080px;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="card-host">
        <div class="card" data-card-id="ref-xhs">
          <style>
            .card[data-card-id="ref-xhs"] .root {
              --bg: #fff5e9;
              --ink: #1d1418;
              --muted: #8a7a78;
              --accent: #ff2e63;
              --accent2: #ff8a4c;
              --accent3: #f0c419;
              --font-sans: ui-sans-serif, system-ui, "PingFang SC", "Hiragino Sans GB", sans-serif;

              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background: var(--bg);
              color: var(--ink);
              font-family: var(--font-sans);
              padding: 36px 44px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              gap: 22px;
            }
            .card[data-card-id="ref-xhs"] .user-row {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .card[data-card-id="ref-xhs"] .avatar {
              width: 56px;
              height: 56px;
              border-radius: 50%;
              background: linear-gradient(135deg, #ff2e63, #ff8a4c);
              box-shadow:
                0 0 0 3px #fff,
                0 0 0 4px rgba(255, 46, 99, 0.3);
            }
            .card[data-card-id="ref-xhs"] .user-info {
              flex: 1;
            }
            .card[data-card-id="ref-xhs"] .user-name {
              font: 700 22px/1.1 var(--font-sans);
              color: var(--ink);
            }
            .card[data-card-id="ref-xhs"] .user-sub {
              font: 400 16px/1.3 var(--font-sans);
              color: var(--muted);
            }
            .card[data-card-id="ref-xhs"] .follow {
              padding: 8px 20px;
              border-radius: 999px;
              background: var(--accent);
              color: #fff;
              font: 700 16px/1 var(--font-sans);
            }
            .card[data-card-id="ref-xhs"] .title {
              margin: 0;
              font: 800 84px/1.1 var(--font-sans);
              color: var(--ink);
              letter-spacing: -0.01em;
            }
            .card[data-card-id="ref-xhs"] .title .heart {
              color: var(--accent);
            }
            .card[data-card-id="ref-xhs"] .detail {
              margin: 0;
              font: 500 28px/1.5 var(--font-sans);
              color: var(--ink);
              max-width: 94%;
            }
            .card[data-card-id="ref-xhs"] .tags {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .card[data-card-id="ref-xhs"] .tag {
              padding: 8px 18px;
              border-radius: 999px;
              background: rgba(255, 46, 99, 0.12);
              color: var(--accent);
              font: 600 18px/1 var(--font-sans);
            }
            .card[data-card-id="ref-xhs"] .tag.orange {
              background: rgba(255, 138, 76, 0.16);
              color: var(--accent2);
            }
            .card[data-card-id="ref-xhs"] .tag.yellow {
              background: rgba(240, 196, 25, 0.18);
              color: #a98209;
            }
            .card[data-card-id="ref-xhs"] .interactions {
              display: flex;
              gap: 28px;
              margin-top: auto;
              padding-top: 14px;
              border-top: 1px solid rgba(0, 0, 0, 0.06);
              font: 700 22px/1 var(--font-sans);
              color: var(--ink);
            }
            .card[data-card-id="ref-xhs"] .interactions span {
              display: inline-flex;
              align-items: center;
              gap: 8px;
            }
            .card[data-card-id="ref-xhs"] .interactions .heart-ic {
              color: var(--accent);
              font-size: 26px;
            }
          </style>

          <div class="root">
            <div class="user-row" data-anim="fade-in" data-anim-at="0.05" data-anim-duration="0.4">
              <div class="avatar"></div>
              <div class="user-info">
                <div class="user-name">@小研究员</div>
                <div class="user-sub">关注我，看我每天拆一段视频 · 18分钟前</div>
              </div>
              <div class="follow">+ 关注</div>
            </div>

            <h2 class="title" data-anim="fade-in" data-anim-at="0.3" data-anim-duration="0.5">
              亲测有效！<span class="heart">♥</span> 30 秒抓住注意力的小技巧
            </h2>

            <p class="detail" data-anim="fade-in" data-anim-at="0.7" data-anim-duration="0.45">
              开头别废话——直接抛结论。听众的大脑在前 3 秒就决定要不要继续，
              这是平台算法之外，最朴素也最重要的事实。
            </p>

            <div class="tags" data-anim="fade-in" data-anim-at="1.0" data-anim-duration="0.4">
              <span class="tag">#内容创作</span>
              <span class="tag orange">#播客剪辑</span>
              <span class="tag yellow">#开头技巧</span>
            </div>

            <div
              class="interactions"
              data-anim="fade-in"
              data-anim-at="1.25"
              data-anim-duration="0.4"
            >
              <span><span class="heart-ic">♥</span> 12.4k</span>
              <span>💬 386</span>
              <span>⭐ 891</span>
              <span
                style="margin-left: auto; color: var(--muted); font-weight: 400; font-size: 18px"
                >📤 分享</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

