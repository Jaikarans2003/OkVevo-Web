/**
 * JSON-LD Structured Data for SEO
 * Helps search engines understand OKVEVO better
 */

export default function StructuredData() {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "OKVEVO",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Web",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "INR"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "1250"
        },
        "description": "OKVEVO AI - Best AI video generator for Instagram reels, YouTube shorts & faceless content. Create viral videos using AI without camera.",
        "featureList": [
            "AI video generator",
            "Text to video AI",
            "AI reel generator",
            "Faceless video creator",
            "AI influencer generator",
            "Automated video creation"
        ]
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
    );
}
