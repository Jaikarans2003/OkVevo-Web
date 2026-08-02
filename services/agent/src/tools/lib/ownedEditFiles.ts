/**
 * True when a shell command string references composition/script files that
 * must be edited via write_file/str_replace — not via sed/python rewrite.
 * Asset ingestion under capture/assets or assets is allowed.
 */

// ponytail: string match on command text; upgrade to argv parse if models start obfuscating paths.
const OWNED_PATH =
  /(?:^|[\s"'`=/])(?:(?:\.?\.?\/)*(?:[^\s'"`]*\/)?)?(?:hf-project\/(?:index\.html|compositions\/[^\s'"`]*\.html|COMPOSITION_MANIFEST\.json)|manim_scripts\/[^\s'"`]*\.py)\b/i;

export function commandTargetsOwnedEditFile(command: string): boolean {
  // Ignore asset-ingestion paths so they cannot satisfy the owned check.
  const scrubbed = command
    .replace(/hf-project\/capture\/assets\/[^\s'"`]*/gi, '')
    .replace(/hf-project\/assets\/[^\s'"`]*/gi, '');
  return OWNED_PATH.test(scrubbed);
}

export const OWNED_EDIT_SHELL_STDERR =
  'Shell edits of composition/script files are not allowed. Use write_file or str_replace on hf-project index/compositions/COMPOSITION_MANIFEST or manim_scripts/*.py. Asset pulls under hf-project/capture/assets or hf-project/assets remain allowed via shell.';
