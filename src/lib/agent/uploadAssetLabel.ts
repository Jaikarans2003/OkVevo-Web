export const UPLOADED_VIDEO_PREFIX = 'Uploaded Video' as const;
export const UPLOADED_PHOTO_PREFIX = 'Uploaded Photo' as const;
export type UploadLabelPrefix =
  | typeof UPLOADED_VIDEO_PREFIX
  | typeof UPLOADED_PHOTO_PREFIX;

/** Next Uploaded Video N / Uploaded Photo N label from existing labels of that prefix. */
export function nextUploadLabel(
  existingLabels: Iterable<string>,
  prefix: UploadLabelPrefix
): string {
  const re = new RegExp(`^${prefix} (\\d+)$`);
  let max = 0;
  for (const label of existingLabels) {
    const match = re.exec(label);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix} ${max + 1}`;
}
