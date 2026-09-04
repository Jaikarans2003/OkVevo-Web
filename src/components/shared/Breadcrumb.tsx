import Link from 'next/link';
import { env } from '@/config/env';

type Crumb = { label: string; href: string }

export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: `${env.siteUrl}${c.href}`
    }))
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav aria-label="Breadcrumb" className="mb-6 pt-24 px-6 md:px-10 max-w-[1400px] mx-auto z-10 relative">
        <ol className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-medium text-white/50 uppercase tracking-widest">
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              {i < crumbs.length - 1 ? (
                <>
                  <Link href={c.href} className="hover:text-orange-500 transition-colors">
                    {c.label}
                  </Link>
                  <span className="text-white/20">/</span>
                </>
              ) : (
                <span className="text-white/90">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
