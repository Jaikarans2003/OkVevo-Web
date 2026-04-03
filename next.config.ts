import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    outputFileTracingRoot: process.cwd(),
    serverExternalPackages: ['firebase-admin'],
    
    async rewrites() {
        return [
            {
                source: '/okvevo-masiv',
                destination: '/masivpage',
            },
        ];
    },

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'pixabay.com' },
            { protocol: 'https', hostname: 'cdn.pixabay.com' },
            { protocol: 'https', hostname: 'i.pinimg.com' },
            { protocol: 'https', hostname: 'i.pravatar.cc' },
            { protocol: 'https', hostname: 'storage.googleapis.com' },
            { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
        ],
    },
};

export default nextConfig;
