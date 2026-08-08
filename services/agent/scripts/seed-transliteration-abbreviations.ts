/**
 * Seed Firestore abbreviation dictionary for Kannada.
 * Run: npx tsx scripts/seed-transliteration-abbreviations.ts (from services/agent)
 *
 * Idempotent merge — safe to re-run. Not a CI gate.
 */
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../src/firebase';
import {
  abbreviationDictionaryPath,
  BUNDLED_ABBREVIATIONS,
} from '../src/tools/lib/transliteration/abbreviationDictionary';

async function main() {
  const entries = BUNDLED_ABBREVIATIONS.kn;
  const path = abbreviationDictionaryPath('kn');
  await db.doc(path).set(
    {
      entries,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`seeded ${path} with ${Object.keys(entries).length} entries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
