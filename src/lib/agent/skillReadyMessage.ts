import eduVideo from '../../../Skills/edu-video/skill.json';
import talkingHead from '../../../Skills/talking-head/skill.json';

const BY_ID: Record<string, string | undefined> = {
  [eduVideo.id]: (eduVideo as { readyMessage?: string }).readyMessage,
  [talkingHead.id]: (talkingHead as { readyMessage?: string }).readyMessage,
};

export function skillReadyMessage(skillId?: string | null): string {
  const msg = skillId ? BY_ID[skillId] : undefined;
  return msg || 'Your video is ready.';
}
