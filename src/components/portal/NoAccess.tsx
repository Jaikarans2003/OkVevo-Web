import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

/**
 * Shown when a role opens a URL it can't use, or an org id the user can't
 * read (403/404 from /api/orgs/:publicId). Plan §9.
 */
export default function NoAccess() {
  return (
    <section className="wrap pt-stack">
      <div className="pt-note pt-note--bad" role="alert">
        <ShieldAlert aria-hidden />
        <div>
          <h3>You don&apos;t have access to this page</h3>
          <p>If you think that&apos;s wrong, ask an owner of the organisation.</p>
          <Link href="/dashboard" className="btn">
            Back to your account
          </Link>
        </div>
      </div>
    </section>
  )
}
