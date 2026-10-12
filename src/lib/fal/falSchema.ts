/**
 * Fal request contract. Source of truth: Fal's OpenAPI input schema per
 * endpoint id, pinned in ./schemas (scripts/pin-fal-schemas.ts) and mirrored
 * byte-identical in hermes-agent/okvevo/fal-schemas/ for the drama adapter.
 *
 * The submit guard validates the FINAL Fal body (after media resolution)
 * against the pinned schema before any hold. Fal's schemas leave
 * additionalProperties open, so objects are closed here: a field the schema
 * does not declare is an error, not something Fal silently ignores.
 */

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

import { canonicalBodyHash } from '@/lib/fal/idempotency';

import seedance20Text from './schemas/bytedance__seedance-2.0__text-to-video.json';
import seedance20Image from './schemas/bytedance__seedance-2.0__image-to-video.json';
import seedance20Ref from './schemas/bytedance__seedance-2.0__reference-to-video.json';
import seedance25Text from './schemas/bytedance__seedance-2.5__text-to-video.json';
import seedance25Image from './schemas/bytedance__seedance-2.5__image-to-video.json';
import seedance25Ref from './schemas/bytedance__seedance-2.5__reference-to-video.json';
import h3Text from './schemas/minimax__h3-max__text-to-video.json';
import h3Image from './schemas/minimax__h3-max__image-to-video.json';
import h3Ref from './schemas/minimax__h3-max__reference-to-video.json';
import wanText from './schemas/alibaba__wan-3.0-prime__text-to-video.json';
import wanImage from './schemas/alibaba__wan-3.0-prime__image-to-video.json';
import wanRef from './schemas/alibaba__wan-3.0-prime__reference-to-video.json';
import gptImage from './schemas/openai__gpt-image-2.json';
import gptEdit from './schemas/openai__gpt-image-2__edit.json';
import music3 from './schemas/minimax__music-3.json';
import speech02 from './schemas/fal-ai__minimax__speech-02-hd.json';
import voiceClone from './schemas/fal-ai__minimax__voice-clone.json';

export type PinnedSchema = {
  endpoint_id: string;
  source: string;
  fetched_at: string;
  openapi: OpenApiDoc;
};

type JsonSchema = Record<string, unknown>;
type OpenApiDoc = {
  paths: Record<string, unknown>;
  components: { schemas: Record<string, JsonSchema> };
};

export const PINNED_SCHEMAS: Record<string, PinnedSchema> = Object.fromEntries(
  [
    seedance20Text, seedance20Image, seedance20Ref,
    seedance25Text, seedance25Image, seedance25Ref,
    h3Text, h3Image, h3Ref,
    wanText, wanImage, wanRef,
    gptImage, gptEdit, music3, speech02, voiceClone,
  ].map((p) => [p.endpoint_id, p as unknown as PinnedSchema])
);

export function falSchemaUrl(endpoint: string): string {
  return `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${endpoint}`;
}

/** Component name of the endpoint's POST request body. */
export function inputSchemaName(doc: OpenApiDoc, endpoint: string): string {
  const post = (doc.paths[`/${endpoint}`] as { post?: Record<string, unknown> } | undefined)?.post;
  const ref = (post?.requestBody as {
    content?: { 'application/json'?: { schema?: { $ref?: string } } };
  } | undefined)?.content?.['application/json']?.schema?.$ref;
  if (!ref) throw new Error(`no request body schema for ${endpoint}`);
  return ref.split('/').pop() as string;
}

function closed(schemas: Record<string, JsonSchema>): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    out[name] =
      schema.properties && schema.additionalProperties === undefined
        ? { ...schema, additionalProperties: false }
        : schema;
  }
  return out;
}

const ajv = new Ajv({ allErrors: true, strict: false });
const compiled = new Map<string, ValidateFunction>();

function validatorFor(endpoint: string): ValidateFunction | null {
  const pinned = PINNED_SCHEMAS[endpoint];
  if (!pinned) return null;
  let validate = compiled.get(endpoint);
  if (!validate) {
    const doc = pinned.openapi;
    validate = ajv.compile({
      $ref: `#/components/schemas/${inputSchemaName(doc, endpoint)}`,
      components: { schemas: closed(doc.components.schemas) },
    });
    compiled.set(endpoint, validate);
  }
  return validate;
}

export type FieldError = { field: string; message: string };

function fieldOf(err: ErrorObject): string {
  const params = err.params as Record<string, unknown>;
  const leaf =
    typeof params.missingProperty === 'string'
      ? params.missingProperty
      : typeof params.additionalProperty === 'string'
        ? params.additionalProperty
        : '';
  const base = err.instancePath.replace(/^\//, '').replaceAll('/', '.');
  return [base, leaf].filter(Boolean).join('.') || '(body)';
}

function messageOf(err: ErrorObject): string {
  if (err.keyword === 'additionalProperties') return 'is not a field in the Fal schema';
  if (err.keyword === 'required') return 'is required';
  if (err.keyword === 'enum') {
    return `must be one of ${JSON.stringify((err.params as { allowedValues: unknown[] }).allowedValues)}`;
  }
  return err.message ?? err.keyword;
}

/**
 * Field errors for a final Fal body, or [] when it matches the pinned schema.
 * An endpoint with no pinned schema is itself an error (fail closed).
 */
export function falBodyErrors(endpoint: string, body: Record<string, unknown>): FieldError[] {
  const validate = validatorFor(endpoint);
  if (!validate) return [{ field: '(endpoint)', message: `no pinned Fal schema for ${endpoint}` }];
  if (validate(body)) return [];
  const seen = new Set<string>();
  const out: FieldError[] = [];
  for (const err of validate.errors ?? []) {
    if (err.keyword === 'anyOf' || err.keyword === 'oneOf') continue;
    const row = { field: fieldOf(err), message: messageOf(err) };
    const key = `${row.field} ${row.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

export function fieldErrorText(endpoint: string, errors: FieldError[]): string {
  return `Fal request does not match the ${endpoint} schema: ${errors
    .map((e) => `${e.field} ${e.message}`)
    .join('; ')}`;
}

export type SchemaDriftLine = { endpoint: string; level: 'HIGH' | 'INFO'; note: string };

/**
 * required/enum facts reachable from the input schema, keyed by field path,
 * plus the reachable component names (for the non-breaking diff).
 */
function contractFacts(doc: OpenApiDoc, endpoint: string) {
  const facts = new Map<string, string>();
  const reached = new Set<string>();
  const schemas = doc.components.schemas;
  const visit = (node: unknown, at: string) => {
    if (!node || typeof node !== 'object') return;
    const s = node as JsonSchema;
    if (typeof s.$ref === 'string') {
      const name = s.$ref.split('/').pop() as string;
      if (reached.has(name)) return;
      reached.add(name);
      visit(schemas[name], at);
      return;
    }
    if (Array.isArray(s.required)) facts.set(`required ${at}`, JSON.stringify([...s.required].sort()));
    if (Array.isArray(s.enum)) facts.set(`enum ${at}`, JSON.stringify([...s.enum].map(String).sort()));
    for (const [k, v] of Object.entries((s.properties as Record<string, unknown>) ?? {})) {
      visit(v, at ? `${at}.${k}` : k);
    }
    for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
      if (Array.isArray(s[key])) for (const v of s[key] as unknown[]) visit(v, at);
    }
    if (s.items) visit(s.items, `${at}[]`);
  };
  visit({ $ref: `#/components/schemas/${inputSchemaName(doc, endpoint)}` }, '');
  const subgraph = Object.fromEntries([...reached].sort().map((n) => [n, schemas[n]]));
  return { facts, hash: canonicalBodyHash(subgraph) };
}

/**
 * Pinned vs live input schema. A required-field or enum change is HIGH (the
 * pinned contract would build or accept bodies Fal now rejects). Any other
 * input-schema change is INFO. Identical → [].
 */
export function schemaDrift(endpoint: string, pinned: OpenApiDoc, live: OpenApiDoc): SchemaDriftLine[] {
  const a = contractFacts(pinned, endpoint);
  const b = contractFacts(live, endpoint);
  const lines: SchemaDriftLine[] = [];
  for (const key of new Set([...a.facts.keys(), ...b.facts.keys()])) {
    const was = a.facts.get(key);
    const now = b.facts.get(key);
    if (was === now) continue;
    const [kind, ...rest] = key.split(' ');
    lines.push({
      endpoint,
      level: 'HIGH',
      note: `${kind} changed at ${rest.join(' ') || '(root)'}: ${was ?? 'none'} -> ${now ?? 'none'}`,
    });
  }
  if (!lines.length && a.hash !== b.hash) {
    lines.push({ endpoint, level: 'INFO', note: 'input schema changed (no required/enum change); re-pin' });
  }
  return lines;
}
