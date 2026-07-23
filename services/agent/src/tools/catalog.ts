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
    'render_hyperframes',
  ],
  'manim-video': ['generate_manim_script', 'render_manim_clip'],
  'hyperframes': ['render_hyperframes'],
  'remove-background': ['remove_background'],
  'background-generator': ['image_generate'],
  'background-video-generator': ['video_generate'],
  'composite-subject': ['composite_subject'],
};

/**
 * Focused skills that must not get the full base toolbox (especially run_command),
 * otherwise the model improvises with rembg/opencv/shell instead of the skill tool.
 */
export const SKILL_BASE_OVERRIDES: Record<string, string[]> = {
  'remove-background': ['ask_clarification'],
  'background-generator': ['ask_clarification'],
  'background-video-generator': ['ask_clarification'],
  'composite-subject': ['ask_clarification'],
};

export const BASE_ONLY_SKILLS: string[] = [];
