import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // output: 'export', // Disabled to allow API routes for SQS integration

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
        ],
    },
};

export default nextConfig;
