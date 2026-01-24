import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // output: 'export', // Disabled to allow API routes for SQS integration
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Cross-Origin-Embedder-Policy",
                        value: "credentialless", // Changed from require-corp to allow Storage videos
                    },
                    {
                        key: "Cross-Origin-Opener-Policy",
                        value: "same-origin-allow-popups",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
