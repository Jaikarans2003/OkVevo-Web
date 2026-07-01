const pattern =
  /^class\s+(\w+)\s*\(\s*(Scene|ThreeDScene|MovingCameraScene|ZoomedScene)\s*\)/gm;

/**
 * @param {string} scriptContent
 * @returns {string[]}
 */
export function detectScenes(scriptContent) {
  return [...scriptContent.matchAll(pattern)].map((m) => m[1]);
}
