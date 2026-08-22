/**
 * Carry-forward: parent run, not session-latest. Object count = uploadFn keys.
 * Run: npx tsx checks/resolveOrCarryAsset.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  findParentRoleDoc,
  resolveOrCarryAsset,
  sessionMediaObjectPath,
  type AssetIo,
  type CarryAssetDoc,
} from '../src/assets/resolveOrCarryAsset';

const objects = new Map<string, true>();
const docs: CarryAssetDoc[] = [];
let seq = 0;

const io: AssetIo = {
  listDocs: async () => docs.slice(),
  writeAsset: async (_u, _s, _kind, url, fields) => {
    const id = `d${++seq}`;
    docs.push({
      id,
      url,
      contentRole: fields.contentRole,
      runId: fields.runId,
      carriedFromAssetId: fields.carriedFromAssetId,
      metadata: fields.metadata,
    });
    return id;
  },
};

function snapshotDocs(): CarryAssetDoc[] {
  return docs.map((d) => structuredClone(d));
}

async function call(
  contentRole: string,
  runId: string,
  parentRunId: string | null,
  unchanged: boolean,
  objectUrl: string
) {
  let uploads = 0;
  const result = await resolveOrCarryAsset(
    {
      userId: 'u',
      sessionId: 's',
      contentRole,
      unchanged,
      parentRunId,
      runId,
      kind: contentRole,
      skillId: 'edu-video',
      uploadFn: async () => {
        uploads += 1;
        objects.set(objectUrl, true);
        return objectUrl;
      },
    },
    io
  );
  return { ...result, uploads };
}

assert.equal(
  sessionMediaObjectPath('u', 's', 'manim-clip:Foo', 'a.mp4'),
  'users/u/sessions/s/media/manim-clip-Foo/a.mp4'
);

async function main(): Promise<void> {
  // 1. Two helper calls, same parent chain, unchanged on the second → 2 docs, 1 object.
  {
    const v1 = await call('role-a', 'r1', null, false, 'gs://obj/a');
    assert.equal(v1.uploads, 1);
    assert.equal(v1.carriedFromAssetId, null);
    const v2 = await call('role-a', 'r2', 'r1', true, 'gs://obj/a-should-not-write');
    assert.equal(v2.uploads, 0);
    assert.equal(v2.url, 'gs://obj/a');
    assert.equal(v2.carriedFromAssetId, v1.assetId);
    assert.equal(docs.filter((d) => d.contentRole === 'role-a').length, 2);
    assert.equal(objects.size, 1);
  }

  // 2. Three versions in a row, unchanged after the first → v3 origin is v1, never v2.
  {
    const v1 = docs.find((d) => d.contentRole === 'role-a' && d.runId === 'r1')!;
    const v3 = await call('role-a', 'r3', 'r2', true, 'gs://obj/nope');
    assert.equal(v3.uploads, 0);
    assert.equal(v3.carriedFromAssetId, v1.id);
    const v2 = docs.find((d) => d.contentRole === 'role-a' && d.runId === 'r2')!;
    assert.notEqual(v3.carriedFromAssetId, v2.id);
  }

  // 3. parentRunId === null (or unchanged with no parent role doc) → uploadFn runs.
  {
    const n = objects.size;
    const fresh = await call('role-b', 'r1', null, true, 'gs://obj/b');
    assert.equal(fresh.uploads, 1);
    assert.equal(fresh.carriedFromAssetId, null);
    assert.equal(objects.size, n + 1);

    const missingParent = await call('role-c', 'r2', 'r1', true, 'gs://obj/c');
    assert.equal(missingParent.uploads, 1);
    assert.equal(missingParent.carriedFromAssetId, null);
  }

  // 4. Branch: v1 five clips → v2 clip2 changed → v3 clip1 changed → v4 from v2 edits clip3.
  {
    const clip = (n: number) => `manim-clip:clip${n}`;
    const url = (run: string, n: number) => `gs://clips/${run}/c${n}`;

    const v1ids: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const r = await call(clip(n), 'v1', null, false, url('v1', n));
      assert.equal(r.uploads, 1);
      v1ids[n] = r.assetId;
    }
    const assetA = v1ids[3];
    const urlA = url('v1', 3);

    for (let n = 1; n <= 5; n++) {
      const changed = n === 2;
      await call(clip(n), 'v2', 'v1', !changed, changed ? url('v2', 2) : url('v1', n));
    }
    const v2clip3 = findParentRoleDoc(docs, clip(3), 'v2')!;
    assert.equal(v2clip3.url, urlA);
    assert.equal(v2clip3.carriedFromAssetId, assetA);

    for (let n = 1; n <= 5; n++) {
      const changed = n === 1;
      await call(clip(n), 'v3', 'v2', !changed, changed ? url('v3', 1) : url('v1', n));
    }
    const v3clip3 = findParentRoleDoc(docs, clip(3), 'v3')!;
    assert.equal(v3clip3.url, urlA);
    assert.equal(v3clip3.carriedFromAssetId, assetA);

    const beforeV4 = snapshotDocs();

    for (let n = 1; n <= 5; n++) {
      const changed = n === 3;
      await call(clip(n), 'v4', 'v2', !changed, changed ? url('v4', 3) : url('v1', n));
    }

    const v4clip3 = findParentRoleDoc(docs, clip(3), 'v4')!;
    assert.notEqual(v4clip3.url, urlA);
    assert.equal(v4clip3.carriedFromAssetId, null);
    assert.notEqual(v4clip3.id, assetA);

    for (const n of [1, 4, 5]) {
      const v4 = findParentRoleDoc(docs, clip(n), 'v4')!;
      const v2 = findParentRoleDoc(docs, clip(n), 'v2')!;
      const v3 = findParentRoleDoc(docs, clip(n), 'v3')!;
      assert.equal(v4.url, url('v1', n));
      assert.equal(v4.carriedFromAssetId, v1ids[n]);
      assert.equal(v4.url, v2.url);
      assert.notEqual(v4.carriedFromAssetId, v3.id);
      if (n === 1) assert.notEqual(v4.url, url('v3', 1));
    }

    const v4clip2 = findParentRoleDoc(docs, clip(2), 'v4')!;
    assert.equal(v4clip2.url, url('v2', 2));

    const afterIds = new Set(docs.map((d) => d.id));
    for (const prior of beforeV4) {
      const now = docs.find((d) => d.id === prior.id);
      assert.deepEqual(now, prior);
      afterIds.delete(prior.id);
    }
    assert.equal(afterIds.size, 5);
  }

  console.log('resolveOrCarryAsset.selfcheck: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
