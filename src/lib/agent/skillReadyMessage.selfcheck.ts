/**
 * Generated Skills/index.json drives ready-message, upload gate, and listed popup.
 * Run: npx tsx src/lib/agent/skillReadyMessage.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Entry = {
  id: string;
  visibility: string;
  requiresUpload?: boolean;
  readyMessage?: string;
  label?: string;
  name?: string;
};

const indexPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../Skills/index.json'
);
const { skills } = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {
  skills: Entry[];
};
const byId = Object.fromEntries(skills.map((entry) => [entry.id, entry]));
const listed = skills.filter((entry) => entry.visibility === 'listed');

assert.deepEqual(
  listed.map((entry) => entry.id).sort(),
  ['background-generation', 'edu-video', 'talking-head']
);
assert.equal(byId['edu-video']?.label, 'Edu-Video');
assert.equal(byId['edu-video']?.requiresUpload, true);
assert.equal(byId['talking-head']?.requiresUpload, true);
assert.equal(byId['background-generation']?.requiresUpload, false);
assert.equal(byId['hyperframes']?.visibility, 'internal');
assert.equal(byId['edu-video']?.readyMessage, 'Your educational video is ready.');
assert.equal(byId['talking-head']?.readyMessage, 'Your talking-head video is ready.');
