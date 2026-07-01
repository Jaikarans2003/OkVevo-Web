import { config } from "../config.js";

/**
 * Async semaphore for limiting concurrent renders (ECS / Docker friendly).
 */
export function createRenderSemaphore() {
  let active = 0;
  const waiters: Array<() => void> = [];

  async function acquire(): Promise<() => void> {
    while (active >= config.maxConcurrentRenders) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    }
    active += 1;
    return () => {
      active -= 1;
      const next = waiters.shift();
      if (next) next();
    };
  }

  function stats() {
    return { active, queued: waiters.length, max: config.maxConcurrentRenders };
  }

  return { acquire, stats };
}
