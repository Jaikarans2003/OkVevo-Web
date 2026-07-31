export const IDLE_STATUS_WORDS = [
  'Focusing',
  'Framing',
  'Sketching',
  'Composing',
  'Layering',
  'Syncing',
  'Polishing',
  'Gathering',
] as const;

export const TOOL_FRIENDLY_LABELS: Record<string, string> = {
  run_command: 'Running a command',
  write_file: 'Saving a file',
  read_file: 'Reading a file',
  search_files: 'Searching files',
  web_search: 'Searching the web',
  web_extract: 'Reading a web page',
  vision_analyze: 'Looking at your image',
  str_replace: 'Editing a file',
  ask_clarification: 'Asking a quick question',
  image_generate: 'Creating your image',
  video_generate: 'Creating your video',
  transcribe_video: 'Listening to your lecture',
  extract_concepts: 'Finding key ideas',
  generate_manim_script: 'Sketching the animation',
  render_manim_clip: 'Rendering the animation',
  plan_segments: 'Planning the video flow',
  scaffold_hf_project: 'Putting it all together',
  render_hyperframes: 'Rendering your video',
};

export function getToolFriendlyLabel(toolName: string): string {
  return TOOL_FRIENDLY_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}
