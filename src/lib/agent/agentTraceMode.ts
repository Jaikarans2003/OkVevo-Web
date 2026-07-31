export function isAgentDevTrace(): boolean {
  return process.env.NEXT_PUBLIC_AGENT_DEV_TRACE === 'true';
}
