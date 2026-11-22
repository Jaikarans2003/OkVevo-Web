/**
 * Email delivery stub — no provider wired yet.
 */
export type SendEmailInput = {
  to: string
  subject: string
  text?: string
  html?: string
}

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: 'not_configured' }

export async function sendEmail(_input: SendEmailInput): Promise<SendEmailResult> {
  return { sent: false, reason: 'not_configured' }
}