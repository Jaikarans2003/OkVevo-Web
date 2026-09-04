/** @type {import('next').NextConfig} */
const nextConfig = {
    outputFileTracingRoot: process.cwd(),
    serverExternalPackages: ['firebase-admin'],
    turbopack: {},

    webpack: (config, { isServer, webpack }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
                path: false,
                stream: false,
                util: false,
                buffer: false,
            };

            // Only ignore firebase-admin on client side
            config.plugins.push(
                new webpack.IgnorePlugin({
                    resourceRegExp: /^(firebase-admin|@google-cloud\/firestore|@google-cloud\/storage)$/,
                })
            );
        }

        return config;
    },

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups',
                    },
                ],
            },
            {
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store',
                    },
                ],
            },
        ];
    },

    async rewrites() {
        return [
            {
                source: '/okvevo-masiv',
                destination: '/masivpage',
            },
        ];
    },

    images: {
        // ponytail: Firebase Hosting webframeworks /_next/image returns 500; raw /public paths are 200. Re-enable when sharp/optimizer works on Cloud Run.
        unoptimized: true,
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
