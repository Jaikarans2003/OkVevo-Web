/**
 * POST /api/contact — plain form categories only in PR 1.
 */
import { sql } from '@/lib/db/client'

export const CONTACT_CATEGORIES = [
  'enterpriseEnquiry',
  'problemTicket',
  'generalQuery',
] as const

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export type ContactInput = {
  category: string
  email: string
  message: string
  whatsapp?: string | null
}

export type ContactValidation =
  | { ok: true; value: { category: ContactCategory; email: string; message: string; whatsapp: string | null } }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContactInput(body: ContactInput): ContactValidation {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const whatsapp =
    typeof body.whatsapp === 'string' && body.whatsapp.trim() ? body.whatsapp.trim() : null

  if (!email) return { ok: false, error: 'Email is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (!(CONTACT_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: 'Please select a category.' }
  }
  if (!message) return { ok: false, error: 'Please describe your query or requirements.' }
  if (message.length > 10_000) return { ok: false, error: 'Message is too long.' }

  return {
    ok: true,
    value: {
      category: category as ContactCategory,
      email,
      message,
      whatsapp,
    },
  }
}

export async function insertContactSubmission(value: {
  category: ContactCategory
  email: string
  message: string
  whatsapp: string | null
}): Promise<string> {
  const rows = await sql`
    insert into contact_submissions (category, email, message, whatsapp)
    values (${value.category}, ${value.email}, ${value.message}, ${value.whatsapp})
    returning id
  `
  return String((rows[0] as { id: string }).id)
}
