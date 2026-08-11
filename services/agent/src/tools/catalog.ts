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
};

export const BASE_ONLY_SKILLS: string[] = ['background-generation'];
