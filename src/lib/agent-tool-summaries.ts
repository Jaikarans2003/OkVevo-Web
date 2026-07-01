type ToolLikePart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export function getToolNameFromPart(part: ToolLikePart): string {
  if (part.type === 'dynamic-tool' && part.toolName) {
    return part.toolName;
  }
  if (part.type.startsWith('tool-')) {
    return part.type.slice('tool-'.length);
  }
  return part.type;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function conceptNeedsAnimation(concept: unknown): boolean {
  const item = asRecord(concept);
  if (!item) return false;
  return item.needs_animation === true || item.needsAnimation === true;
}

export function summarizeToolPart(part: ToolLikePart): string {
  const name = getToolNameFromPart(part);
  const input = asRecord(part.input);
  const output = asRecord(part.output);

  switch (name) {
    case 'transcribe_video': {
      const text = output?.transcript_text;
      if (typeof text === 'string') {
        return `Transcribed lecture (${text.length.toLocaleString()} chars)`;
      }
      return 'Transcribed lecture';
    }
    case 'extract_concepts': {
      const concepts = output?.concepts;
      if (Array.isArray(concepts)) {
        const animationCount = concepts.filter(conceptNeedsAnimation).length;
        return `Found ${concepts.length} concepts · ${animationCount} need animation`;
      }
      return 'Extracted concepts';
    }
    case 'generate_manim_script': {
      const conceptName =
        (typeof output?.concept_name === 'string' && output.concept_name) ||
        (typeof input?.concept_name === 'string' && input.concept_name) ||
        'concept';
      return `Generated Manim scene for "${conceptName}"`;
    }
    case 'render_manim_clips': {
      const conceptName =
        (typeof output?.concept_name === 'string' && output.concept_name) ||
        (typeof input?.concept_name === 'string' && input.concept_name) ||
        'concept';
      if (output?.clip_url) {
        return `Rendered clip for "${conceptName}"`;
      }
      const error =
        (typeof output?.error === 'string' && output.error) ||
        part.errorText ||
        'Render failed';
      return `Clip failed for "${conceptName}" — ${error}`;
    }
    case 'scaffold_hf_project':
      return 'Scaffolded HyperFrames project';
    case 'render_hyperframes':
      return 'Rendered draft video';
    case 'run_command': {
      const command = typeof input?.command === 'string' ? input.command : 'command';
      const exitCode = output?.exit_code;
      const exitSuffix =
        typeof exitCode === 'number' ? ` (exit ${exitCode})` : '';
      return `$ ${command}${exitSuffix}`;
    }
    case 'write_file': {
      const filePath = typeof output?.path === 'string' ? output.path : 'file';
      const bytes = output?.bytes_written;
      const sizeSuffix = typeof bytes === 'number' ? ` (${bytes} bytes)` : '';
      return `Wrote ${filePath}${sizeSuffix}`;
    }
    case 'read_file': {
      const error =
        typeof output?.error === 'string' ? output.error : undefined;
      if (error) {
        return `Read failed — ${error}`;
      }
      const filePath = typeof output?.path === 'string' ? output.path : 'file';
      const bytes = output?.bytes;
      const truncated = output?.truncated === true ? ' (truncated)' : '';
      const sizeSuffix = typeof bytes === 'number' ? ` (${bytes} bytes${truncated})` : '';
      return `Read ${filePath}${sizeSuffix}`;
    }
    case 'search_files': {
      const directory =
        typeof output?.directory === 'string' ? output.directory : 'directory';
      const matchCount = Array.isArray(output?.matches) ? output.matches.length : 0;
      return `Searched ${directory} — ${matchCount} matches`;
    }
    default:
      return name.replace(/_/g, ' ');
  }
}

export function isToolActivityPart(part: { type: string }): boolean {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

export function isPartInFlight(part: { state?: string }): boolean {
  return part.state === 'input-streaming' || part.state === 'input-available';
}
