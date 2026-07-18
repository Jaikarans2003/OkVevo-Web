import { MetadataRoute } from 'next'
import { env } from '@/config/env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/dashboard/', '/_next/'] },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  }
}
