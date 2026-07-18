/**
 * JSON-LD Structured Data for SEO, AEO, and GEO
 * Helps search engines and AI agents understand OKVEVO better
 */

import { env } from '@/config/env';

export default function StructuredData() {
    const baseUrl = env.siteUrl;
    
    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": "OKVEVO",
        "url": baseUrl,
        "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/OKVEVO%20With%20BackGrounds/OrangeBackGround.svg`,
            "width": "512",
            "height": "512"
        },
        "sameAs": [
            "https://instagram.com/okvevo",
            "https://linkedin.com/company/okvevo",
            "https://youtube.com/@okvevo",
            "https://x.com/okvevo"
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": "support@okvevo.com"
        }
    };

    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        "url": baseUrl,
        "name": "OKVEVO",
        "description": "Premium AI Video Generation Platform",
        "publisher": { "@id": `${baseUrl}/#organization` },
        "potentialAction": {
            "@type": "SearchAction",
            "target": `${baseUrl}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        }
    };

    const softwareAppSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "OKVEVO AI",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Web",
        "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "0",
            "highPrice": "17999",
            "priceCurrency": "INR",
            "offerCount": "3"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "1250",
            "bestRating": "5",
            "worstRating": "1"
        },
        "description": "OKVEVO AI - Create viral reels, YouTube shorts & faceless content instantly using text-to-video AI. The best AI video generator for creators in India.",
        "featureList": [
            "AI video generator",
            "Text to video AI",
            "AI reel generator for Instagram",
            "Faceless video creator AI",
            "AI influencer generator",
            "Automated lip sync technology",
            "Custom voice and avatar uploads"
        ]
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": baseUrl
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Features",
                "item": `${baseUrl}/features`
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": "Pricing",
                "item": `${baseUrl}/pricing`
            },
            {
                "@type": "ListItem",
                "position": 4,
                "name": "Blog",
                "item": `${baseUrl}/blogs`
            }
        ]
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
        </>
    );
}
