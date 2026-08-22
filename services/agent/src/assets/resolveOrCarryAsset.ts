export type CarryAssetDoc = {
  id: string;
  url: string;
  contentRole?: string;
  runId?: string;
  carriedFromAssetId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ResolveOrCarryOpts = {
  userId: string;
  sessionId: string;
  contentRole: string;
  unchanged: boolean;
  uploadFn: () => Promise<string>;
  parentRunId: string | null;
  runId: string;
  kind: string;
  skillId: string;
  label?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export type AssetIo = {
  listDocs: (userId: string, sessionId: string) => Promise<CarryAssetDoc[]>;
  writeAsset: (
    userId: string,
    sessionId: string,
    kind: string,
    url: string,
    fields: {
      contentRole: string;
      carriedFromAssetId: string | null;
      runId: string;
      skillId: string;
      label?: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    }
  ) => Promise<string>;
};

export function findParentRoleDoc(
  docs: CarryAssetDoc[],
  contentRole: string,
  parentRunId: string | null
): CarryAssetDoc | null {
  if (!parentRunId) return null;
  return docs.find((d) => d.contentRole === contentRole && d.runId === parentRunId) ?? null;
}

export function roleSourceUrl(doc: CarryAssetDoc | null): string | undefined {
  if (!doc) return undefined;
  const s = doc.metadata?.sourceUrl;
  return typeof s === 'string' && s ? s : doc.url;
}

export function roleDuration(doc: CarryAssetDoc | null): number | undefined {
  const d = doc?.metadata?.duration;
  return typeof d === 'number' && Number.isFinite(d) ? d : undefined;
}

export function sessionMediaObjectPath(
  userId: string,
  sessionId: string,
  contentRole: string,
  filename: string
): string {
  return `users/${userId}/sessions/${sessionId}/media/${contentRole.replace(/:/g, '-')}/${filename}`;
}

export async function listCarryAssetDocs(
  userId: string,
  sessionId: string
): Promise<CarryAssetDoc[]> {
  const { db } = await import('../firebase.js');
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .get();
  const docs: CarryAssetDoc[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const url = data?.url;
    if (typeof url !== 'string' || !url) continue;
    docs.push({
      id: doc.id,
      url,
      contentRole: typeof data.contentRole === 'string' ? data.contentRole : undefined,
      runId: typeof data.runId === 'string' ? data.runId : undefined,
      carriedFromAssetId:
        data.carriedFromAssetId === undefined
          ? undefined
          : (data.carriedFromAssetId as string | null),
      metadata:
        data.metadata && typeof data.metadata === 'object'
          ? (data.metadata as Record<string, unknown>)
          : undefined,
    });
  }
  return docs;
}

async function defaultWriteAsset(
  userId: string,
  sessionId: string,
  kind: string,
  url: string,
  fields: Parameters<AssetIo['writeAsset']>[4]
): Promise<string> {
  const { writeAssetUrl } = await import('../storage.js');
  return writeAssetUrl(userId, sessionId, kind, url, fields);
}

const firestoreIo: AssetIo = {
  listDocs: listCarryAssetDocs,
  writeAsset: defaultWriteAsset,
};

export async function resolveOrCarryAsset(
  opts: ResolveOrCarryOpts,
  io: AssetIo = firestoreIo
): Promise<{ url: string; assetId: string; carriedFromAssetId: string | null }> {
  const docs = await io.listDocs(opts.userId, opts.sessionId);
  const prior = findParentRoleDoc(docs, opts.contentRole, opts.parentRunId);
  const carry = opts.unchanged === true && !!prior;
  const url = carry ? prior.url : await opts.uploadFn();
  const carriedFromAssetId = carry ? (prior.carriedFromAssetId ?? prior.id) : null;
  const assetId = await io.writeAsset(opts.userId, opts.sessionId, opts.kind, url, {
    contentRole: opts.contentRole,
    carriedFromAssetId,
    runId: opts.runId,
    skillId: opts.skillId,
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    ...(opts.mimeType !== undefined ? { mimeType: opts.mimeType } : {}),
    ...(opts.metadata !== undefined ? { metadata: opts.metadata } : {}),
  });
  return { url, assetId, carriedFromAssetId };
}
