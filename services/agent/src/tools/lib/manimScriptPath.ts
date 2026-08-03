import path from 'path';
import { getSessionWorkdir } from './utils';

/** Session path generate_manim_script writes; used when render omits script_path. */
export function defaultSessionManimScriptPath(sessionId: string, className: string): string {
  const safeName = className.replace('Scene', '');
  return path.join(getSessionWorkdir(sessionId), 'manim_scripts', `${safeName}.py`);
}
