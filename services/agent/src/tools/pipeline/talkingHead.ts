// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import {
  canvasForOrientation,
  DEFAULT_HYPERFRAMES_JSON,
  downloadFile,
  execCommand,
  getSessionWorkdir,
  loadSessionTranscript,
  SPEAKER_MAX_BYTES,
  SPEAKER_NORMALIZE_CRF,
  SPEAKER_NORMALIZE_PRESET,
  SPEAKER_NORMALIZE_VF,
  type VideoOrientation,
} from '../lib/utils';
import { resolveCompositionDuration } from '../lib/resolveCompositionDuration';
import {
  formatDuration,
  getSessionOrientation,
  persistOrientation,
} from '../../checkpoint';
import { assertTaggedUrlAllowed } from '../../taggedAssets';
import {
  listSessionAssetUrls,
  uploadDirectoryToStorage,
  uploadToStorage,
  writeAssetUrl,
} from '../../storage';
import { SKILLS_DIR } from '../../skills';
import type { ToolCtx } from '../index';

export type Rect = { left: number; top: number; width: number; height: number };

type LayoutEntry = {
  zone: string;
  chrome?: string;
  horizontal: { video: Rect; card: Rect };
  vertical: { video: Rect; card: Rect };
};

type LayoutsFile = { layouts: Record<string, LayoutEntry> };

type StoryboardCard = {
  id: string;
  startSec: number;
  endSec: number;
  zone?: string;
  layout?: string;
};

type Storyboard = {
  cards: StoryboardCard[];
  layout?: string;
  durationSeconds?: number;
};

const FPS = 30;
const ENTER_DUR = 0.4;
const EXIT_DUR = 0.35;
const VIDEO_TWEEN_DUR = 0.6;

export function loadTalkingHeadLayouts(): LayoutsFile {
  const p = path.join(SKILLS_DIR, 'talking-head', 'references', 'layouts.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as LayoutsFile;
}

/** Map layout key → zone + video/card rects for orientation. */
export function resolveLayoutBounds(
  layoutKey: string,
  orientation: VideoOrientation,
  layouts = loadTalkingHeadLayouts()
): { zone: string; chrome?: string; video: Rect; card: Rect } {
  const entry = layouts.layouts[layoutKey];
  if (!entry) {
    throw new Error(
      `Unknown layout "${layoutKey}". Use split|stack|pip|overlay (see Skills/talking-head/references/layouts.json).`
    );
  }
  const orient = orientation === 'vertical' ? entry.vertical : entry.horizontal;
  return {
    zone: entry.zone,
    ...(entry.chrome ? { chrome: entry.chrome } : {}),
    video: orient.video,
    card: orient.card,
  };
}

/** Zone name → pixel card bounds via the layout that owns that zone. */
export function zoneToCardBounds(
  zone: string,
  orientation: VideoOrientation,
  layouts = loadTalkingHeadLayouts()
): Rect {
  for (const entry of Object.values(layouts.layouts)) {
    if (entry.zone === zone) {
      return orientation === 'vertical' ? entry.vertical.card : entry.horizontal.card;
    }
  }
  throw new Error(`No layout maps to zone "${zone}"`);
}

export function layoutKeyForZone(
  zone: string,
  layouts = loadTalkingHeadLayouts()
): string {
  for (const [key, entry] of Object.entries(layouts.layouts)) {
    if (entry.zone === zone) return key;
  }
  throw new Error(`No layout maps to zone "${zone}"`);
}

export function quantizeSec(sec: number, fps = FPS): number {
  return Math.round(sec * fps) / fps;
}

export function speakerNormalizeGopCommand(
  inputPath: string,
  outputPath: string
): string {
  // Dense GOP so HeyGen seek does not freeze. Match shared normalizeSpeakerVideo quoting.
  return (
    `ffmpeg -y -i "${inputPath}" -vf "${SPEAKER_NORMALIZE_VF}"` +
    ` -an -c:v libx264 -crf ${SPEAKER_NORMALIZE_CRF}` +
    ` -preset ${SPEAKER_NORMALIZE_PRESET}` +
    ` -g 30 -keyint_min 30` +
    ` -pix_fmt yuv420p -movflags +faststart` +
    ` "${outputPath}"`
  );
}

async function normalizeSpeakerVideoDenseGop(
  inputPath: string,
  outputPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const cmd = speakerNormalizeGopCommand(inputPath, outputPath);
  const ffmpeg = await execCommand(cmd, { timeoutSeconds: 600 });
  if (!ffmpeg.success) {
    throw new Error(ffmpeg.stderr || 'ffmpeg speaker normalize (GOP) failed');
  }
}

async function assertSessionNotRendering(sessionId: string): Promise<void> {
  // Lazy: keeps selfcheck free of Firebase init.
  const { db } = await import('../../firebase');
  const snap = await db.collection('sessions').doc(sessionId).get();
  if (snap.data()?.renderStatus === 'RUNNING') {
    throw new Error(
      'A render is already in progress for this session. Wait for it to finish before scaffolding or restoring — do not wipe the project mid-flight.'
    );
  }
}

function escapeSel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

type DataAnimAttrs = {
  kind: string;
  at: number;
  duration: number;
  stagger?: number;
  from?: string;
  distance?: number;
  targetW?: number;
  targetH?: number;
  direction?: string;
  id?: string;
};

/** Pull data-anim-* declarations from card HTML (no DOM parser — regex is enough). */
export function extractDataAnims(cardHtml: string): DataAnimAttrs[] {
  const out: DataAnimAttrs[] = [];
  const tagRe = /<([a-zA-Z0-9]+)([^>]*\bdata-anim=['"][^'"]+['"][^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(cardHtml))) {
    const attrs = m[2];
    const get = (name: string): string | undefined => {
      const am = attrs.match(new RegExp(`data-anim-${name}=['"]([^'"]*)['"]`));
      if (am) return am[1];
      if (name === 'kind') {
        const km = attrs.match(/data-anim=['"]([^'"]+)['"]/);
        return km?.[1];
      }
      return undefined;
    };
    const kind = get('kind');
    if (!kind) continue;
    const idMatch = attrs.match(/\bid=['"]([^'"]+)['"]/);
    out.push({
      kind,
      at: Number(get('at') ?? 0),
      duration: Number(get('duration') ?? 0.4),
      stagger: get('stagger') != null ? Number(get('stagger')) : undefined,
      from: get('from'),
      distance: get('distance') != null ? Number(get('distance')) : undefined,
      targetW: get('target-w') != null ? Number(get('target-w')) : undefined,
      targetH: get('target-h') != null ? Number(get('target-h')) : undefined,
      direction: get('direction'),
      id: idMatch?.[1],
    });
  }
  return out;
}

export function compileDataAnimStatement(
  cardId: string,
  anim: DataAnimAttrs,
  absSec: number
): string {
  const T = quantizeSec(absSec);
  const D = anim.duration;
  const idPart = anim.id ? `#${escapeSel(anim.id)}` : `[data-anim="${escapeSel(anim.kind)}"]`;
  const SEL = `'.card[data-card-id="${escapeSel(cardId)}"] ${idPart}'`;

  switch (anim.kind) {
    case 'fade-in':
      return `tl.fromTo(${SEL},{opacity:0},{opacity:1,duration:${D},ease:'power2.out'},${T});`;
    case 'fade-out':
      return `tl.to(${SEL},{opacity:0,duration:${D},ease:'power2.in'},${T});`;
    case 'slide-in': {
      const dist = anim.distance ?? 80;
      const from = anim.from ?? 'left';
      const x =
        from === 'right' ? dist : from === 'left' ? -dist : 0;
      const y =
        from === 'top' ? -dist : from === 'bottom' ? dist : 0;
      return `tl.fromTo(${SEL},{opacity:0,x:${x},y:${y}},{opacity:1,x:0,y:0,duration:${D},ease:'power2.out'},${T});`;
    }
    case 'kinetic-chars': {
      const S = anim.stagger ?? 0.04;
      return `tl.from(${SEL}+' .char',{opacity:0,y:8,scale:0.8,duration:${D},ease:'power2.out',stagger:${S}},${T});`;
    }
    case 'grow-x': {
      const W = anim.targetW ?? 240;
      return `tl.fromTo(${SEL},{width:0},{width:${W},duration:${D},ease:'power2.out'},${T});`;
    }
    case 'grow-y': {
      const H = anim.targetH ?? 240;
      return `tl.fromTo(${SEL},{height:0},{height:${H},duration:${D},ease:'power2.out'},${T});`;
    }
    case 'scale-pop':
      return `tl.fromTo(${SEL},{opacity:0,scale:0.6},{opacity:1,scale:1,duration:${D},ease:'back.out(1.6)'},${T});`;
    case 'blur-in':
      return `tl.fromTo(${SEL},{opacity:0,filter:'blur(12px)'},{opacity:1,filter:'blur(0px)',duration:${D},ease:'power2.out'},${T});`;
    case 'draw-path':
      return `(function(){const el=document.querySelector(${SEL});if(el&&el.getTotalLength){const L=el.getTotalLength();tl.set(${SEL},{strokeDasharray:L,strokeDashoffset:L},${T});tl.to(${SEL},{strokeDashoffset:0,duration:${D},ease:'power2.inOut'},${T});}})();`;
    case 'mask-reveal': {
      const dir = anim.direction ?? 'left';
      const inset =
        dir === 'right'
          ? 'inset(0 0 0 100%)'
          : dir === 'top'
            ? 'inset(100% 0 0 0)'
            : dir === 'bottom'
              ? 'inset(0 0 100% 0)'
              : 'inset(0 100% 0 0)';
      return `tl.fromTo(${SEL},{clipPath:'${inset}'},{clipPath:'inset(0 0 0 0)',duration:${D},ease:'power2.inOut'},${T});`;
    }
    default:
      return `/* unsupported data-anim="${escapeSel(anim.kind)}" */`;
  }
}

function rectCss(r: Rect): string {
  return `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
}

function stripCardShell(html: string): string {
  // Prefer inner .card fragment; fall back to full file body.
  const cardMatch = html.match(/<div\s+class="card"[^>]*>[\s\S]*<\/div>\s*<\/div>\s*<\/div>\s*<\/body>/i);
  if (cardMatch) {
    // Too fragile — extract from first .card to matching close via simple scan
  }
  const start = html.search(/<div\s+class="card"[^>]*>/i);
  if (start < 0) {
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return (body?.[1] ?? html).trim();
  }
  // Find matching closing div for .card by depth from the opening tag.
  const openTagEnd = html.indexOf('>', start) + 1;
  let depth = 1;
  let i = openTagEnd;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, nextClose + 6);
      }
      i = nextClose + 6;
    }
  }
  return html.slice(start);
}

function rewriteCardId(cardHtml: string, cardId: string): string {
  return cardHtml
    .replace(/data-card-id="[^"]*"/g, `data-card-id="${cardId}"`)
    .replace(/\.card\[data-card-id="[^"]*"\]/g, `.card[data-card-id="${cardId}"]`);
}

function loadStoryboard(workdir: string): Storyboard {
  const p = path.join(workdir, 'storyboard.json');
  if (!fs.existsSync(p)) {
    throw new Error('storyboard.json not found. Write it via write_file before scaffolding.');
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Storyboard;
  if (!Array.isArray(raw.cards) || raw.cards.length === 0) {
    throw new Error('storyboard.json must include a non-empty cards array.');
  }
  return raw;
}

function resolveCardLayoutKey(card: StoryboardCard, fallback: string): string {
  if (card.layout && typeof card.layout === 'string') return card.layout;
  if (card.zone) {
    try {
      return layoutKeyForZone(card.zone);
    } catch {
      /* fall through */
    }
  }
  return fallback;
}

function buildIndexHtml(opts: {
  width: number;
  height: number;
  duration: number;
  orientation: VideoOrientation;
  cards: Array<{
    id: string;
    startSec: number;
    endSec: number;
    layoutKey: string;
    cardHtml: string;
    cardRect: Rect;
    videoRect: Rect;
    chrome?: string;
  }>;
}): string {
  const { width, height, duration, cards } = opts;
  const first = cards[0];
  const initialVideo = first.videoRect;
  const initialClass =
    first.chrome === 'pip-pill' ? 'video-wrapper pip-pill' : 'video-wrapper';

  const hosts = cards
    .map((c, i) => {
      const dur = Math.max(0.01, c.endSec - c.startSec);
      const inner = rewriteCardId(stripCardShell(c.cardHtml), c.id);
      return `      <div class="card-host clip" data-card-id="${c.id}" data-start="${quantizeSec(c.startSec).toFixed(4)}" data-duration="${quantizeSec(dur).toFixed(4)}" data-track-index="${2 + i}" style="${rectCss(c.cardRect)};visibility:hidden;opacity:0;">
        ${inner}
      </div>`;
    })
    .join('\n');

  const scriptLines: string[] = [
    `const tl = window.gsap.timeline({ paused: true });`,
    `tl.set('#video-wrap', { left: ${initialVideo.left}, top: ${initialVideo.top}, width: ${initialVideo.width}, height: ${initialVideo.height}, className: '${initialClass}' }, 0);`,
  ];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const start = quantizeSec(c.startSec);
    const end = quantizeSec(c.endSec);
    const exitAt = Math.max(start, quantizeSec(end - EXIT_DUR));
    const hostSel = `'.card-host[data-card-id="${escapeSel(c.id)}"]'`;

    if (i > 0) {
      const prev = cards[i - 1];
      const tweenAt = quantizeSec(Math.max(0, c.startSec - VIDEO_TWEEN_DUR));
      const sameRect =
        prev.videoRect.left === c.videoRect.left &&
        prev.videoRect.top === c.videoRect.top &&
        prev.videoRect.width === c.videoRect.width &&
        prev.videoRect.height === c.videoRect.height &&
        prev.chrome === c.chrome;
      if (!sameRect) {
        const cls =
          c.chrome === 'pip-pill' ? 'video-wrapper pip-pill' : 'video-wrapper';
        scriptLines.push(
          `tl.set('#video-wrap', { className: '${cls}' }, ${tweenAt});`,
          `tl.to('#video-wrap', { left: ${c.videoRect.left}, top: ${c.videoRect.top}, width: ${c.videoRect.width}, height: ${c.videoRect.height}, duration: ${VIDEO_TWEEN_DUR}, ease: 'power2.inOut' }, ${tweenAt});`
        );
      }
    }

    scriptLines.push(
      `tl.set(${hostSel}, { visibility: 'visible' }, ${start});`,
      `tl.fromTo(${hostSel}, { opacity: 0 }, { opacity: 1, duration: ${ENTER_DUR}, ease: 'power2.out' }, ${start});`
    );

    for (const anim of extractDataAnims(c.cardHtml)) {
      scriptLines.push(
        compileDataAnimStatement(c.id, anim, c.startSec + anim.at)
      );
    }

    scriptLines.push(
      `tl.to(${hostSel}, { opacity: 0, duration: ${EXIT_DUR}, ease: 'power2.in' }, ${exitAt});`,
      `tl.set(${hostSel}, { visibility: 'hidden' }, ${end});`
    );
  }

  scriptLines.push(
    `window.__timelines = window.__timelines || {};`,
    `window.__timelines["talking-head"] = tl;`
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>talking-head</title>
    <style>
      html, body {
        margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
        background: #0a0c12;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      #stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: #0a0c12; }
      .video-wrapper {
        position: absolute; overflow: hidden; border-radius: 0; box-shadow: none;
      }
      .video-wrapper video { width: 100%; height: 100%; object-fit: cover; }
      .video-wrapper.pip-pill {
        border-radius: 14px;
        box-shadow:
          0 24px 60px -20px rgba(0,0,0,.45),
          0 0 0 4px rgba(255,255,255,.7),
          0 0 0 5px rgba(0,0,0,.18);
        overflow: hidden;
        z-index: 5;
      }
      .card-host { position: absolute; pointer-events: none; overflow: hidden; }
      .card-host .card { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .card-host .char { display: inline-block; visibility: visible; }
    </style>
  </head>
  <body>
    <div id="stage" data-composition-id="talking-head" data-start="0" data-duration="${duration}" data-fps="${FPS}" data-width="${width}" data-height="${height}">
      <div class="${initialClass}" id="video-wrap" style="${rectCss(initialVideo)};">
        <video id="bg-video" src="assets/speaker_noaudio.mp4" muted playsinline data-start="0" data-duration="${duration}" data-track-index="1"></video>
      </div>
${hosts}
      <audio id="bg-audio" src="assets/audio.mp3" data-start="0" data-duration="${duration}" data-track-index="0"></audio>
      <script src="vendor/gsap.min.js"></script>
      <script>
        (function () {
          ${scriptLines.join('\n          ')}
        })();
      </script>
    </div>
  </body>
</html>
`;
}

async function runScaffoldTalkingHead(
  ctx: ToolCtx,
  args: { speaker_video_url: string; orientation?: VideoOrientation }
) {
  await assertSessionNotRendering(ctx.sessionId);

  const sessionAssetUrls = await listSessionAssetUrls(ctx.userId, ctx.sessionId);
  const allowlist = [
    ...ctx.taggedArtifacts,
    ...ctx.restoreAllowlistUrls.map((u) => ({ url: u })),
    ...sessionAssetUrls.map((u) => ({ url: u })),
  ];
  assertTaggedUrlAllowed(args.speaker_video_url, allowlist);

  const orientation: VideoOrientation =
    args.orientation ?? (await getSessionOrientation(ctx.sessionId));
  await persistOrientation(ctx.sessionId, orientation);
  const { width, height } = canvasForOrientation(orientation);

  const workdir = getSessionWorkdir(ctx.sessionId);
  const storyboard = loadStoryboard(workdir);
  const defaultLayout = storyboard.layout ?? 'split';
  const layouts = loadTalkingHeadLayouts();

  const projectDir = path.join(workdir, 'hf-project');
  fs.rmSync(projectDir, { recursive: true, force: true });
  const assetsDir = path.join(projectDir, 'assets');
  const vendorDir = path.join(projectDir, 'vendor');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(vendorDir, { recursive: true });

  const gsapSrc = path.join(
    SKILLS_DIR,
    'talking-head',
    'assets',
    'vendor',
    'gsap.min.js'
  );
  if (!fs.existsSync(gsapSrc)) {
    throw new Error('Bundled gsap.min.js missing under Skills/talking-head/assets/vendor/');
  }
  fs.copyFileSync(gsapSrc, path.join(vendorDir, 'gsap.min.js'));

  const speakerRawPath = path.join(assetsDir, 'speaker_raw.mp4');
  const speakerVideoPath = path.join(assetsDir, 'speaker_noaudio.mp4');
  const audioPath = path.join(assetsDir, 'audio.mp3');

  await downloadFile(args.speaker_video_url, speakerRawPath);

  const audioExtract = await execCommand(
    `ffmpeg -y -i "${speakerRawPath}" -vn -acodec mp3 "${audioPath}"`,
    { timeoutSeconds: 120 }
  );
  if (!audioExtract.success) {
    throw new Error(audioExtract.stderr || 'ffmpeg audio extraction failed');
  }

  await normalizeSpeakerVideoDenseGop(speakerRawPath, speakerVideoPath);
  fs.unlinkSync(speakerRawPath);

  const ffprobe = await execCommand(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${speakerVideoPath}"`,
    { timeoutSeconds: 60 }
  );
  const probedDuration = Number.parseFloat(ffprobe.stdout.trim()) || 0;

  const transcript = loadSessionTranscript(ctx.sessionId);
  const words = transcript?.words ?? [];
  const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
  const effectiveDuration = resolveCompositionDuration({
    lastWordEnd,
    transcriptDuration:
      transcript?.duration_seconds ?? storyboard.durationSeconds ?? probedDuration,
    audioProbe: probedDuration,
    videoProbe: probedDuration,
  });

  if (probedDuration > effectiveDuration + 0.05) {
    for (const mediaPath of [speakerVideoPath, audioPath]) {
      const tmp = `${mediaPath}.trim${path.extname(mediaPath)}`;
      const trim = await execCommand(
        `ffmpeg -y -i "${mediaPath}" -t ${effectiveDuration} -c copy "${tmp}"`,
        { timeoutSeconds: 120 }
      );
      if (!trim.success) {
        fs.rmSync(tmp, { force: true });
        throw new Error(trim.stderr || `ffmpeg trim failed: ${mediaPath}`);
      }
      fs.renameSync(tmp, mediaPath);
    }
  }

  const speakerBytes = fs.statSync(speakerVideoPath).size;
  if (speakerBytes > SPEAKER_MAX_BYTES) {
    throw new Error('Speaker video is too long to upload after 1080p normalization');
  }

  const resolvedCards = [];
  for (const card of storyboard.cards) {
    const endSec = Math.min(card.endSec, effectiveDuration);
    const startSec = Math.min(card.startSec, endSec);
    if (endSec <= startSec) continue;

    const layoutKey = resolveCardLayoutKey(card, defaultLayout);
    const bounds = resolveLayoutBounds(layoutKey, orientation, layouts);
    const cardPath = path.join(workdir, 'cards', `${card.id}.html`);
    if (!fs.existsSync(cardPath)) {
      throw new Error(`Missing card HTML: cards/${card.id}.html`);
    }
    const cardHtml = fs.readFileSync(cardPath, 'utf-8');
    resolvedCards.push({
      id: card.id,
      startSec,
      endSec,
      layoutKey,
      cardHtml,
      cardRect: bounds.card,
      videoRect: bounds.video,
      chrome: bounds.chrome,
    });
  }

  if (resolvedCards.length === 0) {
    throw new Error('No cards remain after clamping to media duration.');
  }

  const indexHtml = buildIndexHtml({
    width,
    height,
    duration: effectiveDuration,
    orientation,
    cards: resolvedCards,
  });
  fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml, 'utf-8');
  fs.writeFileSync(path.join(projectDir, 'hyperframes.json'), DEFAULT_HYPERFRAMES_JSON);
  fs.writeFileSync(
    path.join(projectDir, 'meta.json'),
    JSON.stringify(
      {
        id: `th-${ctx.sessionId.slice(0, 8)}`,
        total_duration: effectiveDuration,
        width,
        height,
        fps: FPS,
        orientation,
      },
      null,
      2
    ),
    'utf-8'
  );

  const compositionStoragePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/composition.html`;
  const indexUrl = await uploadToStorage(
    path.join(projectDir, 'index.html'),
    compositionStoragePath
  );
  await writeAssetUrl(ctx.userId, ctx.sessionId, 'composition', indexUrl);

  const hfProjectPrefix = `users/${ctx.userId}/sessions/${ctx.sessionId}/hf-project`;
  const { prefixUrl } = await uploadDirectoryToStorage(projectDir, hfProjectPrefix);
  await writeAssetUrl(ctx.userId, ctx.sessionId, 'hf_project', prefixUrl);

  return {
    project_dir: projectDir,
    composition_url: indexUrl,
    orientation,
    width,
    height,
    duration: formatDuration(effectiveDuration),
    card_count: resolvedCards.length,
  };
}

export function createTalkingHeadTools(ctx: ToolCtx) {
  return {
    scaffold_talking_head_project: tool({
      description: `Scaffold a talking-head HyperFrames project from session storyboard.json + cards/*.html: normalize speaker (dense GOP), compile layout GSAP + data-anim into index.html, copy bundled GSAP, upload hf-project. Call after writing storyboard and cards; then call render_hyperframes.`,
      inputSchema: z.object({
        speaker_video_url: z
          .string()
          .describe('Firebase Storage URL of the source talking-head video'),
        orientation: z
          .enum(['horizontal', 'vertical'])
          .optional()
          .describe('Canvas orientation — reads session when omitted; defaults horizontal'),
      }),
      execute: async ({ speaker_video_url, orientation }) => {
        try {
          return await runScaffoldTalkingHead(ctx, {
            speaker_video_url,
            orientation,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Talking-head scaffold failed: ${message}`);
        }
      },
    }),
  };
}
