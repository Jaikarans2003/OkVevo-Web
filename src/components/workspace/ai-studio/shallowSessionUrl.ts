/** Same-path session URL sync without Next App Router navigation (Hosting hard-reloads on replace). */
export function replaceSessionUrl(url: string) {
  window.history.replaceState(null, '', url);
}
