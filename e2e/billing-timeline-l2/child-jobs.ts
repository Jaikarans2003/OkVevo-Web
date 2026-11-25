/**
 * One chat, one search, one cheapest image, one shortest video on the child
 * org. A submitted Fal job that does not settle throws. A missing vendor key
 * is recorded and not retried.
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { browserJson, COST_PATH } from './session'

export type Leg = {
  endpoint?: string
  model?: string
  credits?: number | null
  quoteCredits?: number | null
  usd?: number | null
  settled?: boolean
  skipped?: string
  reason?: string
}

export type VendorCost = {
  chat?: Leg
  search?: Leg
  image?: Leg
  video?: Leg
  jobs?: { modelLabel: string; jobType: string; credits: number; status: string }[]
  missingKeys: string[]
  stopped?: string
}

type JobItem = { modelLabel: string; jobType: string; credits: number; status: string }

const MISSING = ['OPENROUTER_API_KEY', 'TAVILY_API_KEY', 'FAL_KEY'] as const

function missingKey(json: unknown): string | null {
  const text = JSON.stringify(json ?? '')
  for (const name of MISSING) {
    if (text.includes(`${name} missing`)) return name
  }
  return null
}

function noteMissing(cost: VendorCost, json: unknown): string | null {
  const key = missingKey(json)
  if (key && !cost.missingKeys.includes(key)) cost.missingKeys.push(key)
  return key
}

function short(json: unknown): string {
  const text = JSON.stringify(json ?? '')
  if (/postgres(?:ql)?:\/\//i.test(text)) return 'redacted'
  return text.slice(0, 240)
}

type ModelRow = {
  id?: string
  context_length?: number
  supported_parameters?: string[]
  pricing?: { prompt?: string; completion?: string }
}

async function cheapestChatModel(): Promise<{ id: string } | { missing: string } | { error: string }> {
  const key = (process.env.OPENROUTER_API_KEY ?? '').trim()
  const headers: Record<string, string> = {}
  if (key) headers.authorization = `Bearer ${key}`
  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/models', { headers })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'models fetch failed' }
  }
  if (res.status === 401 || res.status === 403) return { missing: 'OPENROUTER_API_KEY' }
  if (!res.ok) return { error: `models ${res.status}` }
  const body = (await res.json()) as { data?: ModelRow[] }
  let best: { id: string; price: number } | null = null
  for (const row of body.data ?? []) {
    if (typeof row.id !== 'string' || !row.id.trim()) continue
    const id = row.id.trim()
    if (id.toLowerCase().startsWith('openrouter/')) continue
    if (id === 'okvevo/auto-cost' || id === 'okvevo/auto-intelligence') continue
    if (!row.supported_parameters?.includes('tools')) continue
    if (typeof row.context_length !== 'number' || row.context_length < 64_000) continue
    const prompt = Number(row.pricing?.prompt)
    const completion = Number(row.pricing?.completion)
    if (!(prompt > 0) && !(completion > 0)) continue
    const price = (Number.isFinite(prompt) ? prompt : 0) + (Number.isFinite(completion) ? completion : 0)
    if (!best || price < best.price) best = { id, price }
  }
  if (!best) return { error: 'no chat model passed the catalog filter' }
  return { id: best.id }
}

async function pollFal(page: Page, endpoint: string, requestId: string, org: string): Promise<void> {
  let last = ''
  for (let i = 0; i < 40; i++) {
    const res = await browserJson(
      page,
      `/api/gateway/fal/queue/${endpoint}/requests/${requestId}/status`,
      { org }
    )
    const body = res.json as { status?: string; error?: { message?: string } }
    const message = body?.error?.message ?? ''
    if (message.includes('FAL_KEY missing')) {
      throw new Error('FAL_KEY missing')
    }
    last = `${res.status} ${body?.status ?? ''} ${message}`.trim()
    if (res.status >= 200 && res.status < 300 && body?.status === 'COMPLETED') return
    if (res.status === 499 || res.status === 403 || res.status === 500) {
      throw new Error(`fal job did not settle (${endpoint}): ${last}`)
    }
    await page.waitForTimeout(5_000)
  }
  throw new Error(`fal job did not settle (${endpoint}): ${last}`)
}

const VIDEO = [
  {
    endpoint: 'minimax/h3-max/text-to-video',
    label: 'H3 Max',
    args: {
      prompt: 'a red square',
      duration: 0.92,
      resolution: '480P',
      prompt_expansion_mode: 'disabled',
    },
  },
  {
    endpoint: 'alibaba/wan-3.0-prime/text-to-video',
    label: 'Wan 3.0 Prime',
    args: { prompt: 'a red square', duration: 2, resolution: '480p' },
  },
  {
    endpoint: 'bytedance/seedance-2.0/text-to-video',
    label: 'Seedance 2.0',
    args: { prompt: 'a red square', duration: '4', resolution: '480p' },
  },
  {
    endpoint: 'bytedance/seedance-2.5/text-to-video',
    label: 'Seedance 2.5',
    args: { prompt: 'a red square', duration: '4', resolution: '480p' },
  },
] as const

async function quote(
  page: Page,
  org: string,
  endpoint: string,
  args: Record<string, unknown>
): Promise<{ status: number; credits: number | null; json: unknown }> {
  const res = await browserJson(page, '/api/fal/quote', {
    method: 'POST',
    org,
    body: { endpoint, args },
  })
  const credits = (res.json as { credits?: unknown }).credits
  return {
    status: res.status,
    credits: typeof credits === 'number' ? credits : null,
    json: res.json,
  }
}

async function submitFal(
  page: Page,
  org: string,
  endpoint: string,
  args: Record<string, unknown>,
  approved: number
): Promise<{ status: number; requestId: string | null; json: unknown }> {
  const res = await browserJson(page, `/api/gateway/fal/queue/${endpoint}`, {
    method: 'POST',
    org,
    body: { ...args, run_id: randomUUID(), approved_credits: approved },
  })
  const requestId = (res.json as { request_id?: unknown }).request_id
  return {
    status: res.status,
    requestId: typeof requestId === 'string' ? requestId : null,
    json: res.json,
  }
}

export async function runChildJobs(page: Page, org: string): Promise<VendorCost> {
  const cost: VendorCost = { missingKeys: [] }
  try {
    const model = await cheapestChatModel()
    if ('missing' in model) {
      cost.missingKeys.push(model.missing)
      cost.chat = { settled: false, reason: `${model.missing} missing` }
    } else if ('error' in model) {
      cost.chat = { settled: false, reason: model.error }
    } else {
      const chat = await browserJson(page, '/api/gateway/chat/completions', {
        method: 'POST',
        org,
        body: {
          model: model.id,
          messages: [{ role: 'user', content: 'Reply with ok' }],
          max_tokens: 16,
          stream: false,
        },
      })
      const key = noteMissing(cost, chat.json)
      const usd = (chat.json as { usage?: { cost?: unknown } }).usage?.cost
      cost.chat = {
        model: model.id,
        usd: typeof usd === 'number' ? usd : null,
        settled: chat.status >= 200 && chat.status < 300 && !key,
        reason: key ? `${key} missing` : chat.status >= 300 ? short(chat.json) : undefined,
      }
    }

    const search = await browserJson(page, '/api/gateway/tavily/search', {
      method: 'POST',
      org,
      body: { query: 'okvevo', search_depth: 'basic', max_results: 1 },
    })
    const searchKey = noteMissing(cost, search.json)
    cost.search = {
      settled: search.status >= 200 && search.status < 300 && !searchKey,
      reason: searchKey ? `${searchKey} missing` : search.status >= 300 ? short(search.json) : undefined,
    }

    const imageArgs = { prompt: 'a red square', image_size: 'square_hd', quality: 'low', num_images: 1 }
    const imageQuote = await quote(page, org, 'openai/gpt-image-2', imageArgs)
    const imageKey = noteMissing(cost, imageQuote.json)
    if (imageKey || imageQuote.credits == null) {
      cost.image = {
        endpoint: 'openai/gpt-image-2',
        settled: false,
        quoteCredits: imageQuote.credits,
        reason: imageKey ? `${imageKey} missing` : `quote ${imageQuote.status} ${short(imageQuote.json)}`,
      }
    } else {
      const submitted = await submitFal(page, org, 'openai/gpt-image-2', imageArgs, imageQuote.credits)
      const submitKey = noteMissing(cost, submitted.json)
      if (submitKey || !submitted.requestId || submitted.status >= 300) {
        cost.image = {
          endpoint: 'openai/gpt-image-2',
          quoteCredits: imageQuote.credits,
          settled: false,
          reason: submitKey ? `${submitKey} missing` : `submit ${submitted.status} ${short(submitted.json)}`,
        }
        if (!submitKey) throw new Error(cost.image.reason)
      } else {
        await pollFal(page, 'openai/gpt-image-2', submitted.requestId, org)
        cost.image = {
          endpoint: 'openai/gpt-image-2',
          quoteCredits: imageQuote.credits,
          settled: true,
        }
      }
    }

    const imageBlocked = cost.image?.reason?.includes('FAL_KEY missing')
    if (process.env.L2_SKIP_PAID_VIDEO === '1') {
      cost.video = { settled: false, skipped: 'L2_SKIP_PAID_VIDEO' }
    } else if (imageBlocked) {
      cost.video = { settled: false, reason: 'skipped after FAL_KEY missing' }
    } else {
      let winner: { endpoint: string; label: string; args: Record<string, unknown>; credits: number } | null = null
      const quoteNotes: string[] = []
      for (const candidate of VIDEO) {
        const q = await quote(page, org, candidate.endpoint, { ...candidate.args })
        const key = noteMissing(cost, q.json)
        if (key) {
          quoteNotes.push(`${candidate.label}: ${key} missing`)
          continue
        }
        if (q.status >= 500 || q.credits == null) {
          quoteNotes.push(`${candidate.label}: ${q.status}`)
          continue
        }
        if (!winner || q.credits < winner.credits) {
          winner = {
            endpoint: candidate.endpoint,
            label: candidate.label,
            args: { ...candidate.args },
            credits: q.credits,
          }
        }
      }
      if (!winner) {
        cost.video = { settled: false, reason: `no video quote (${quoteNotes.join('; ')})` }
      } else {
        const submitted = await submitFal(page, org, winner.endpoint, winner.args, winner.credits)
        const submitKey = noteMissing(cost, submitted.json)
        if (submitKey || !submitted.requestId || submitted.status >= 300) {
          cost.video = {
            endpoint: winner.endpoint,
            model: winner.label,
            quoteCredits: winner.credits,
            settled: false,
            reason: submitKey ? `${submitKey} missing` : `submit ${submitted.status} ${short(submitted.json)}`,
          }
          if (!submitKey) throw new Error(cost.video.reason)
        } else {
          await pollFal(page, winner.endpoint, submitted.requestId, org)
          cost.video = {
            endpoint: winner.endpoint,
            model: winner.label,
            quoteCredits: winner.credits,
            settled: true,
          }
        }
      }
    }

    const jobs = await browserJson(page, `/api/orgs/${org}/jobs`, { org })
    const items = ((jobs.json as { items?: JobItem[] }).items ?? []) as JobItem[]
    cost.jobs = items.map((item) => ({
      modelLabel: item.modelLabel,
      jobType: item.jobType,
      credits: item.credits,
      status: item.status,
    }))
    const sum = (type: string) =>
      items.filter((item) => item.jobType === type).reduce((n, item) => n + (item.credits || 0), 0)
    if (cost.chat) cost.chat.credits = sum('Chat')
    if (cost.search) cost.search.credits = sum('Search')
    if (cost.image) cost.image.credits = sum('Image')
    if (cost.video) cost.video.credits = sum('Video')
    for (const [name, leg] of [
      ['chat', cost.chat],
      ['search', cost.search],
      ['image', cost.image],
      ['video', cost.video],
    ] as const) {
      if (!leg || leg.skipped || leg.settled) continue
      if (leg.reason?.includes('missing')) continue
      throw new Error(`${name} did not settle: ${leg.reason ?? 'unknown'}`)
    }
    return cost
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stopped'
    cost.stopped = message
    for (const name of MISSING) {
      if (message.includes(`${name} missing`) && !cost.missingKeys.includes(name)) cost.missingKeys.push(name)
    }
    throw err
  } finally {
    fs.mkdirSync(path.dirname(COST_PATH), { recursive: true })
    fs.writeFileSync(COST_PATH, JSON.stringify(cost, null, 2))
    console.log(`L2_COST ${JSON.stringify(cost)}`)
  }
}
