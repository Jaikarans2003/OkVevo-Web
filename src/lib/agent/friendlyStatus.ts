import toolMetaJson from './tool-meta.json';

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

type ToolMetaEntry = { friendlyLabel: string; internal: boolean };

const TOOL_META = toolMetaJson as Record<string, ToolMetaEntry>;

export function isInternalTool(toolName: string): boolean {
  return TOOL_META[toolName]?.internal === true;
}

export function getToolFriendlyLabel(toolName: string): string {
  return TOOL_META[toolName]?.friendlyLabel ?? toolName.replace(/_/g, ' ');
}
