import {
  commandTargetsOwnedEditFile,
  OWNED_EDIT_SHELL_STDERR,
} from './tools/lib/ownedEditFiles';

/** True when a shell command reads a process environment block. */
export function referencesProcEnviron(command: string): boolean {
  return /\/proc\/[^/\s'"]+\/environ\b/.test(command);
}

/**
 * True when a command string or file path names a credential / secret file.
 * Filename heuristics only — not a full secret scanner.
 */
export function looksLikeCredentialPath(s: string): boolean {
  if (!s) return false;
  const n = s.replace(/\\/g, '/');
  if (/(?:^|\/|\s|'|")\.env(?:\.[A-Za-z0-9_-]+)?(?=$|\/|\s|'|")/.test(n)) return true;
  if (/\.aws\/(?:credentials|config)(?=$|\/|\s|'|")/.test(n)) return true;
  if (/(?:^|\/|\s|'|")credentials(?=$|\/|\s|'|")/.test(n)) return true;
  if (/service-account[^/\s'"]*\.json/i.test(n)) return true;
  if (/(?:^|\/)[^/\s'"]*credentials[^/\s'"]*\.json/i.test(n)) return true;
  if (/(?:^|\/|\s|'|"|~)\/?\.ssh(?:$|\/)/.test(n)) return true;
  if (/\.(?:pem|key)(?=$|\/|\s|'|"|\?)/.test(n)) return true;
  if (/(?:^|\/|\s|'|")id_rsa(?:$|\.|\s|'|")/.test(n)) return true;
  if (/(?:^|\/|\s|'|")id_ed25519(?:$|\.|\s|'|")/.test(n)) return true;
  return false;
}

export type FloorDeny = {
  tool: string | readonly string[];
  reason: string;
  matches: (args: Record<string, unknown>) => boolean;
};

function commandArg(args: Record<string, unknown>): string {
  return typeof args.command === 'string' ? args.command : '';
}

function pathArg(args: Record<string, unknown>): string {
  return typeof args.path === 'string' ? args.path : '';
}

function ruleApplies(rule: FloorDeny, toolName: string): boolean {
  return Array.isArray(rule.tool)
    ? rule.tool.includes(toolName)
    : rule.tool === toolName;
}

const CREDENTIAL_TOOLS = ['run_command', 'read_file', 'write_file'] as const;

/**
 * Harness-global, non-overridable denies. Skill permissions can tighten
 * behavior, never loosen these. Add new floor rules here — not inline in tools.
 */
export const FLOOR_DENIES: readonly FloorDeny[] = Object.freeze([
  {
    tool: 'run_command',
    reason: 'Reading process environments is not allowed.',
    matches: (args) => referencesProcEnviron(commandArg(args)),
  },
  {
    tool: 'run_command',
    reason: OWNED_EDIT_SHELL_STDERR,
    matches: (args) => commandTargetsOwnedEditFile(commandArg(args)),
  },
  {
    tool: CREDENTIAL_TOOLS,
    reason: 'Reading or writing credential files is not allowed.',
    matches: (args) =>
      looksLikeCredentialPath(commandArg(args)) ||
      looksLikeCredentialPath(pathArg(args)),
  },
]);

export function floorDenyReason(
  toolName: string,
  args: Record<string, unknown>
): string | null {
  for (const rule of FLOOR_DENIES) {
    if (ruleApplies(rule, toolName) && rule.matches(args)) return rule.reason;
  }
  return null;
}
