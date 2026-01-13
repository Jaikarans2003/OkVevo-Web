import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export', // Enabled for Firebase Hosting deployment
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
                        value: "same-origin",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
