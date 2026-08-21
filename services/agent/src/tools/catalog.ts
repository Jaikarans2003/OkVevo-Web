export const BASE_TOOLS: string[] = [
  'run_command',
  'write_file',
  'read_file',
  'search_files',
  'web_search',
  'web_extract',
  'vision_analyze',
  'str_replace',
  'ask_clarification',
  'image_generate',
  'video_generate',
];

export const SKILL_TOOLS: Record<string, string[]> = {
  'edu-video': [
    'transcribe_video',
    'extract_concepts',
    'generate_manim_script',
    'render_manim_clip',
    'plan_segments',
    'scaffold_hf_project',
    'restore_generation',
    'render_hyperframes',
  ],
  'talking-head': [
    'transcribe_video',
    'scaffold_talking_head_project',
    'render_hyperframes',
  ],
  'manim-video': ['generate_manim_script', 'render_manim_clip'],
  'hyperframes': ['render_hyperframes'],
};

/**
 * Focused skills that must not get the full base toolbox (especially run_command),
 * otherwise the model improvises with rembg/opencv/shell instead of the skill tool.
 */
export const SKILL_BASE_OVERRIDES: Record<string, string[]> = {
  'background-generation': [
    'ask_clarification',
    'image_generate',
    'video_generate',
  ],
  // Same mechanism as background-generation (replace base), not the same tool set.
  'talking-head': BASE_TOOLS.filter((t) => t !== 'run_command'),
};

export const BASE_ONLY_SKILLS: string[] = ['background-generation'];

/**
 * Optional argv allowlist for run_command when the skill still exposes it.
 * Missing key → unrestricted (edu-video). Empty → reject all. Non-empty →
 * first token / known binary must be in the list.
 */
export const SKILL_COMMAND_PREFIXES: Record<string, string[]> = {};
