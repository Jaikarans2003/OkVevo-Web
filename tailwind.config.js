/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                'custom-orange': '#FF6D1F',
                'custom-cream': '#FAF3E1',
                'custom-bg': '#141413',
                'orange-brand': {
                    50: '#fff7ed',
                    100: '#ffedd5',
                    200: '#fed7aa',
                    300: '#fdba74',
                    400: '#fb923c',
                    500: '#f97316',
                    600: '#ea580c',
                    700: '#c2410c',
                    800: '#9a3412',
                    900: '#7c2d12',
                    950: '#431407',
                },
                'gray-brand': {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#000000ff',
                },
            },
            backgroundImage: {
                'orange-gradient': 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
                'dark-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            },
            animation: {
                'pulse-orange': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-orange': 'bounce 1s infinite',
            },
        },
    },
    plugins: [],
}
