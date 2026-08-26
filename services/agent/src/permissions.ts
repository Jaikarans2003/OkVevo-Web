import { floorDenyReason } from './policies';

/**
 * Declarative skill permissions: allow/deny/ask rules with optional
 * `tool(prefix:*)` argument matchers (Claude Code's Bash(git:*) pattern).
 * Only run_command carries an argument matcher today — it is the one tool
 * whose arguments are shell commands.
 */
export type SkillPermissions = {
  allow?: string[];
  deny?: string[];
  ask?: string[];
};

export type ToolMatcher = {
  tool: string;
  /** Present when the rule is `tool(inner)` — inner without a trailing `:*`. */
  commandExact?: string;
  /** Present when the rule is `tool(inner:*)` — command must start with inner. */
  commandPrefix?: string;
};

export function parseToolMatcher(rule: string): ToolMatcher {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\((.*)\))?$/.exec(rule.trim());
  if (!m) throw new Error(`invalid permission rule: '${rule}'`);
  const tool = m[1]!;
  const inner = m[2];
  if (inner === undefined) return { tool };
  if (inner.endsWith(':*')) return { tool, commandPrefix: inner.slice(0, -2) };
  return { tool, commandExact: inner };
}

/** Strip leading env assignments (FOO=bar cmd ...) before matching. */
function stripEnvAssignments(command: string): string {
  return command.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '');
}

function commandMatches(matcher: ToolMatcher, command: string): boolean {
  const stripped = stripEnvAssignments(command).replace(/^['"]/, '');
  if (matcher.commandExact !== undefined) return stripped === matcher.commandExact;
  const prefix = matcher.commandPrefix!;
  // Boundary match: prefix must be followed by whitespace or end of string.
  return (
    stripped.startsWith(prefix) &&
    (stripped.length === prefix.length || /\s/.test(stripped[prefix.length]!))
  );
}

function ruleMatches(
  rule: string,
  toolName: string,
  command: string | null
): boolean {
  const matcher = parseToolMatcher(rule);
  if (matcher.tool !== toolName) return false;
  if (matcher.commandExact === undefined && matcher.commandPrefix === undefined) {
    return true;
  }
  return command !== null && commandMatches(matcher, command);
}

export type PermissionVerdict = {
  verdict: 'allow' | 'deny' | 'ask';
  reason?: string;
};

export function evaluateToolCall(
  permissions: SkillPermissions | undefined,
  toolName: string,
  args: unknown
): PermissionVerdict {
  const argsObj =
    args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  const floorReason = floorDenyReason(toolName, argsObj);
  if (floorReason) return { verdict: 'deny', reason: floorReason };
  if (!permissions) return { verdict: 'allow' };

  const command =
    toolName === 'run_command' && typeof argsObj.command === 'string'
      ? argsObj.command
      : null;

  if (permissions.deny?.some((rule) => ruleMatches(rule, toolName, command))) {
    return {
      verdict: 'deny',
      reason: `${toolName} is denied by this skill's permissions.`,
    };
  }

  if (toolName === 'run_command') {
    const allowRules = (permissions.allow ?? [])
      .map(parseToolMatcher)
      .filter((m) => m.tool === 'run_command');
    const unrestricted = allowRules.some(
      (m) => m.commandExact === undefined && m.commandPrefix === undefined
    );
    const matchers = allowRules.filter(
      (m) => m.commandExact !== undefined || m.commandPrefix !== undefined
    );
    // Permissions present + no bare run_command + zero matchers = deny-all.
    // Skills with no permissions block stay unrestricted except floor.
    if (!unrestricted && matchers.length === 0) {
      return {
        verdict: 'deny',
        reason: 'Command not allowed by this skill\'s permissions.',
      };
    }
    if (!unrestricted && matchers.length > 0) {
      const ok = command !== null && matchers.some((m) => commandMatches(m, command));
      if (!ok) {
        return {
          verdict: 'deny',
          reason: 'Command not allowed by this skill\'s permissions.',
        };
      }
    }
  }

  if (permissions.ask?.some((rule) => ruleMatches(rule, toolName, command))) {
    return { verdict: 'ask' };
  }

  return { verdict: 'allow' };
}
