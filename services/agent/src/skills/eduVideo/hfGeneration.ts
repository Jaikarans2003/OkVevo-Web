// Edu-video Mode B HyperFrames generation helpers — pure functions, no Firebase.

export type RuleEntry = { name: string; path: string; tags: string[] };

export type ModeBArchetype =
  | 'flow'
  | 'dataviz'
  | 'comparison'
  | 'timeline'
  | 'list'
  | 'fallback';

export type BlueprintEntry = {
  id: string;
  roles: string;
  duration: string;
  minDuration: number;
};

const GSAP_EFFECTS = 'rules/gsap-effects.md';
const FLOW_RULES = [
  'rules/center-outward-expansion.md',
  'rules/svg-path-draw.md',
  'rules/avatar-cloud-network.md',
];
const FALLBACK_RULES = [...FLOW_RULES.slice(0, 2), GSAP_EFFECTS];

const CAMERA_RULES = new Set([
  'rules/coordinate-target-zoom.md',
  'rules/multi-phase-camera.md',
  'rules/viewport-change.md',
]);

const ARCHETYPE_BLUEPRINT: Record<ModeBArchetype, string> = {
  flow: 'constellation-hub',
  dataviz: 'dataviz-countup',
  comparison: 'comparison-split',
  timeline: 'spatial-pan-stations',
  list: 'grid-card-assemble',
  fallback: 'grid-card-assemble',
};

const ARCHETYPE_RULES: Record<ModeBArchetype, string[]> = {
  flow: FLOW_RULES,
  dataviz: ['rules/counting-dynamic-scale.md', 'rules/stat-bars-and-fills.md'],
  comparison: ['rules/split-tilt-cards.md', 'rules/scale-swap-transition.md'],
  timeline: ['rules/center-outward-expansion.md', 'rules/svg-path-draw.md'],
  list: ['rules/center-outward-expansion.md', 'rules/stat-bars-and-fills.md'],
  fallback: FALLBACK_RULES,
};

const ARCHETYPE_PATTERNS: { archetype: ModeBArchetype; re: RegExp }[] = [
  {
    archetype: 'dataviz',
    re: /\b(stat|stats|chart|counter|revenue|percent|\$\d|metric|growth rate)\b/i,
  },
  {
    archetype: 'comparison',
    re: /\b(vs\.?|versus|compare|comparison|two sides|split)\b/i,
  },
  {
    archetype: 'timeline',
    re: /\b(timeline|milestone|station|journey map)\b/i,
  },
  {
    archetype: 'list',
    re: /\b(benefits|features|grid|list of|items)\b/i,
  },
  {
    archetype: 'flow',
    re: /\b(step|flow|process|decision|path|diagram|node|→|sequence)\b/i,
  },
];

/** Compact diagram blueprints when preferred shape needs more time than the slot allows. */
const DIAGRAM_FALLBACK_IDS = ['constellation-hub', 'grid-card-assemble'];

export function padSegmentNum(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function buildSegmentId(index: number, mode: 'A' | 'B' | 'C' = 'B'): string {
  return `seg-${padSegmentNum(index)}-${mode.toLowerCase()}`;
}

export function sectionFilename(index: number): string {
  const nn = padSegmentNum(index);
  return `${nn}-segment-${nn}.html`;
}

export function sectionRelativePath(index: number): string {
  return `hf-project/compositions/sections/${sectionFilename(index)}`;
}

export function parseRulesIndex(indexMd: string): RuleEntry[] {
  const rules: RuleEntry[] = [];
  const re = /<([a-z0-9-]+)\s+path="([^"]+)"[^>]*>[\s\S]*?Tags:\s*([^<]+)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(indexMd)) !== null) {
    rules.push({
      name: match[1],
      path: match[2],
      tags: match[3]
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    });
  }
  return rules;
}

function parseDurationMin(durationStr: string): number {
  const m = durationStr.match(/([\d.]+)/);
  return m ? Number.parseFloat(m[1]) : 0;
}

export function parseBlueprintsIndex(indexMd: string): BlueprintEntry[] {
  const entries: BlueprintEntry[] = [];
  const re =
    /<blueprint\s+id="([^"]+)"\s+roles="([^"]*)"\s+duration="([^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(indexMd)) !== null) {
    entries.push({
      id: match[1],
      roles: match[2],
      duration: match[3],
      minDuration: parseDurationMin(match[3]),
    });
  }
  return entries;
}

export function detectModeBArchetype(
  explanation: string,
  transcriptExcerpt: string
): ModeBArchetype {
  const text = `${explanation} ${transcriptExcerpt}`.toLowerCase();
  for (const { archetype, re } of ARCHETYPE_PATTERNS) {
    if (re.test(text)) return archetype;
  }
  return 'fallback';
}

function pickDiagramFallback(
  durationSeconds: number,
  entries: BlueprintEntry[]
): string | null {
  const candidates = DIAGRAM_FALLBACK_IDS.map((id) => entries.find((e) => e.id === id)).filter(
    (e): e is BlueprintEntry => Boolean(e)
  );
  const fitting = candidates
    .filter((e) => durationSeconds >= e.minDuration)
    .sort((a, b) => b.minDuration - a.minDuration);
  if (fitting.length > 0) return `blueprints/${fitting[0].id}.md`;
  const grid = entries.find((e) => e.id === 'grid-card-assemble');
  return grid ? `blueprints/grid-card-assemble.md` : null;
}

export function selectHfBlueprint(
  archetype: ModeBArchetype,
  durationSeconds: number,
  blueprintsIndexMd: string
): string | null {
  const entries = parseBlueprintsIndex(blueprintsIndexMd);
  const preferredId = ARCHETYPE_BLUEPRINT[archetype];
  const preferred = entries.find((e) => e.id === preferredId);
  if (preferred && durationSeconds >= preferred.minDuration) {
    return `blueprints/${preferred.id}.md`;
  }
  return pickDiagramFallback(durationSeconds, entries);
}

export function parseBlueprintRuleBoosts(blueprintMd: string): string[] {
  const boosts: string[] = [];
  const mapping = blueprintMd.match(/\*\*rule mapping\*\*[\s\S]*?(?=\n\*\*|$)/i);
  if (!mapping) return boosts;
  const re = /`([a-z0-9-]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mapping[0])) !== null) {
    const name = m[1];
    if (name !== 'gsap-effects' && !name.includes('techniques')) {
      boosts.push(`rules/${name}.md`);
    }
  }
  return boosts;
}

export function selectHfRules(
  explanation: string,
  rulesIndexMd: string,
  archetype: ModeBArchetype = 'fallback',
  blueprintMd?: string
): string[] {
  const rules = parseRulesIndex(rulesIndexMd);
  const lower = explanation.toLowerCase();
  const archetypePreferred = new Set(ARCHETYPE_RULES[archetype] ?? FALLBACK_RULES);
  const boosts = blueprintMd ? parseBlueprintRuleBoosts(blueprintMd) : [];

  const penalizeCamera =
    archetype !== 'timeline' &&
    /\b(step|flow|process|decision)\b/i.test(lower);

  const scored = rules
    .map((rule) => {
      let score = 0;
      if (archetypePreferred.has(rule.path)) score += 20;
      else if (boosts.includes(rule.path)) score += 12;
      for (const tag of rule.tags) {
        if (lower.includes(tag)) score += 2;
      }
      if (penalizeCamera && CAMERA_RULES.has(rule.path)) score -= 20;
      return { ...rule, score };
    })
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const rule of scored) {
    if (picked.length >= 2) break;
    if (!picked.includes(rule.path)) picked.push(rule.path);
  }

  if (picked.length === 0) {
    for (const path of ARCHETYPE_RULES[archetype] ?? FALLBACK_RULES) {
      if (picked.length >= 2) break;
      if (!picked.includes(path)) picked.push(path);
    }
  }

  if (!picked.includes(GSAP_EFFECTS)) picked.push(GSAP_EFFECTS);
  return picked;
}

export function maxBeatsForDuration(durationSeconds: number): number {
  if (durationSeconds <= 5) return 3;
  if (durationSeconds <= 9) return 4;
  return 6;
}

function inferVisualNodes(conceptName: string, explanation: string, maxNodes: number): string[] {
  const fromExplanation = explanation.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  const fromConcept = conceptName
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(the|and|of|for)$/i.test(w));
  const candidates = [...fromExplanation, ...fromConcept].map((s) => s.trim()).filter(Boolean);
  if (candidates.length >= 2) return candidates.slice(0, maxNodes);
  return ['Start', 'Action', 'Outcome'].slice(0, maxNodes);
}

export function buildModeBBrief(opts: {
  durationSeconds: number;
  conceptName: string;
  explanation: string;
  transcriptExcerpt: string;
  archetype: ModeBArchetype;
  blueprintPath?: string | null;
}): string {
  const maxNodes = maxBeatsForDuration(opts.durationSeconds);
  const nodeHints = inferVisualNodes(opts.conceptName, opts.explanation, maxNodes);

  const visualShape =
    opts.archetype === 'dataviz'
      ? 'Animated chart, counter, or stat graphic — numbers only if spoken in transcript'
      : opts.archetype === 'comparison'
        ? 'Two-panel split with icons/cards — no sentence captions'
        : opts.archetype === 'timeline'
          ? 'Horizontal stations or path with icons — camera optional if duration allows'
          : opts.archetype === 'list'
            ? 'Icon grid or card assemble — one icon per item, 1–2 word labels max'
            : 'SVG flow diagram: nodes + connector paths/arrows; icons or shapes carry meaning';

  const blueprintHint = opts.blueprintPath
    ? `- Follow blueprint ${opts.blueprintPath} with diagram-first execution (not typography slides)`
    : '- Build a compact SVG diagram with animated reveals';

  return `## Mode B brief

Duration: ${opts.durationSeconds}s — HARD LIMITS:
- Captions already show spoken words — DO NOT repeat transcript sentences or phrases on screen
- Max ${maxNodes} visual nodes/steps with 1–2 word labels each (e.g. ${nodeHints.map((n) => `"${n}"`).join(', ')})
- Primary content = icons, SVG shapes, paths, arrows, cards — not paragraphs or kinetic type
- ${visualShape}
- Animate reveals with GSAP (path draw, node pop-in, connector stroke) — motion explains the idea
${blueprintHint}
- Archetype: ${opts.archetype}
- Transcript is for meaning only — visualize the concept, don't subtitle it`;
}

export function stripHtmlFences(text: string): string {
  return text.replace(/```(?:html|xml)?\n?/g, '').replace(/```\n?/g, '').trim();
}

function countStepPatterns(html: string): number {
  const stepClass = (html.match(/class="[^"]*step[-_]/gi) ?? []).length;
  const stepId = (html.match(/id="step\d+/gi) ?? []).length;
  const numbered = (html.match(/class="[^"]*step-num/gi) ?? []).length;
  return Math.max(stepClass, stepId, numbered);
}

export function hasDiagramVisual(html: string): boolean {
  if (/<svg[\s>]/i.test(html)) return true;
  if (/class="[^"]*\b(node|flow-node|hub|connector|card-|icon-|flow-)/i.test(html)) return true;
  if (/\b(path|circle|rect|line|polyline)\b[^>]*\bd=["']/i.test(html)) return true;
  return false;
}

function visibleTextContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function captionEchoError(html: string, transcriptExcerpt: string): string | null {
  const text = visibleTextContent(html);
  const words = transcriptExcerpt.toLowerCase().replace(/\s+/g, ' ').trim().split(/\s+/);
  if (words.length < 4) return null;
  for (let len = Math.min(8, words.length); len >= 4; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (text.includes(phrase)) {
        return `Caption echo: on-screen text repeats transcript ("${phrase}") — use diagram/icons only; captions carry spoken words`;
      }
    }
  }
  return null;
}

function usesSystemUiOnly(html: string): boolean {
  const families = html.match(/font-family:\s*([^;}{]+)/gi) ?? [];
  if (families.length === 0) return false;
  return families.every(
    (f) =>
      /system-ui|apple-system|sans-serif/i.test(f) &&
      !/Archivo|League|Bebas|Oswald|Montserrat|Poppins|Inter|Gothic/i.test(f)
  );
}

export function validateHfSubcomposition(
  html: string,
  segmentId: string,
  durationSeconds: number,
  transcriptExcerpt?: string
): { ok: true; warnings?: string[] } | { ok: false; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const templateId = `${segmentId}-template`;
  const attrScopeRe = new RegExp(
    `\\[data-composition-id=["']${segmentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\]`
  );

  if (!html.includes(`id="${templateId}"`) && !html.includes(`id='${templateId}'`)) {
    errors.push(`Missing <template id="${templateId}">`);
  }

  if (!html.includes(`data-composition-id="${segmentId}"`)) {
    errors.push(`Missing data-composition-id="${segmentId}" on root div`);
  }

  if (!html.includes(`id="${segmentId}"`)) {
    errors.push(
      `Root div must have id="${segmentId}" (HyperFrames Pitfall 3 — style via #id, not attribute selector)`
    );
  }

  if (!html.includes(`#${segmentId}`)) {
    errors.push(`CSS must style root with #${segmentId} { position: absolute; inset: 0; ... }`);
  }

  if (attrScopeRe.test(html)) {
    errors.push(
      `Do not use [data-composition-id="${segmentId}"] in CSS — HyperFrames double-scopes it and styles break. Use #${segmentId} for root and plain class selectors for descendants (.node, .flow-path, etc.)`
    );
  }

  if (/\bgetElementById\s*\(/.test(html) || /\bdocument\.querySelector/.test(html)) {
    errors.push(
      'Do not use getElementById or document.querySelector — GSAP targets must be string selectors resolved at seek time (e.g. tl.from("#node-1", ...))'
    );
  }

  if (/gsap\.set\([^)]*#[\w-]+[^)]*autoAlpha\s*:\s*0/.test(html) && /\.from\(['"]#[\w-]+/.test(html)) {
    errors.push(
      'Do not gsap.set(autoAlpha:0) on a parent container that holds .from() children — it hides descendants even after child tweens run'
    );
  }

  if (/opacity:\s*0\s*;/.test(html)) {
    errors.push(
      'Do not set opacity: 0 in CSS — use gsap.from() / gsap.set() only so elements are visible if the timeline fails'
    );
  }

  if (!hasDiagramVisual(html)) {
    errors.push(
      'Mode B must include diagram visuals (SVG nodes, icons, paths, or cards) — captions already show spoken words; kinetic typography alone is not allowed'
    );
  }

  const visibleWords = visibleTextContent(html).split(/\s+/).filter(Boolean).length;
  const maxLabels = maxBeatsForDuration(durationSeconds) * 3;
  if (visibleWords > maxLabels) {
    errors.push(
      `Too much on-screen text (${visibleWords} words) — max ~${maxLabels} words of short labels; captions carry the narration`
    );
  }

  if (transcriptExcerpt) {
    const echo = captionEchoError(html, transcriptExcerpt);
    if (echo) errors.push(echo);

    const invented = html.match(/\$[\d,]+(?:\s*[–-]\s*\$?[\d,]+)?/g) ?? [];
    for (const amount of invented) {
      if (!transcriptExcerpt.includes(amount.replace(/\$/g, ''))) {
        warnings.push(`Invented currency "${amount}" not in transcript — remove or use transcript words only`);
      }
    }
  }

  if (usesSystemUiOnly(html) && visibleWords > 0) {
    errors.push(
      'Use an embedded Google Font for any labels — system-ui alone reads as generic web UI'
    );
  }

  const maxBeats = maxBeatsForDuration(durationSeconds);
  const stepCount = countStepPatterns(html);
  if (stepCount > maxBeats) {
    errors.push(
      `Too many numbered step elements (${stepCount}) for ${durationSeconds}s — max ${maxBeats} visual nodes`
    );
  }

  const durationMatch = html.match(/data-duration="([^"]+)"/);
  if (!durationMatch) {
    errors.push('Missing data-duration attribute');
  } else {
    const found = Number.parseFloat(durationMatch[1]);
    if (Math.abs(found - durationSeconds) > 0.05) {
      errors.push(
        `data-duration ${found} does not match requested ${durationSeconds} (±0.05s)`
      );
    }
  }

  if (
    !html.includes(`window.__timelines['${segmentId}']`) &&
    !html.includes(`window.__timelines["${segmentId}"]`)
  ) {
    errors.push(`Missing window.__timelines['${segmentId}'] registration`);
  }

  if (!/tl\.set\(\s*\{\s*\}\s*,\s*\{\s*\}\s*,/.test(html)) {
    errors.push('Missing tl.set({}, {}, DURATION) padding at end of timeline');
  }

  if (!html.includes('cdn.jsdelivr.net/npm/gsap')) {
    errors.push('Missing GSAP CDN script');
  }

  if (/repeat:\s*-1/.test(html) || /repeat:\s*Infinity/.test(html)) {
    errors.push('Infinite repeat detected (repeat: -1 or repeat: Infinity)');
  }

  if (/\b(video|audio)\.play\s*\(/.test(html)) {
    errors.push('Imperative video.play() or audio.play() not allowed');
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  return warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}
