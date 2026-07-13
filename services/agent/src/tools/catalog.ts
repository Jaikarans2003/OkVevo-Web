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
};

export const BASE_ONLY_SKILLS: string[] = [];
