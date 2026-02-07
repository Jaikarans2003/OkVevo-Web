/** @type {import('tailwindcss').Config} */
// Force rebuild
export default {
	darkMode: ["class"],
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
				'custom-White': '#FFFFFF',
				// Ook design system colors
				'bg-main': '#FAFAFA',
				'text-main': '#121212',
				'text-dim': '#666666',
				'accent-orange': '#FF5733',
				'accent-peach': '#FFDED6',
				'accent-lavender': '#E8D9FF',
				'accent-sky': '#D6F1FF',
				'accent-mint': '#D6FFF5',
				'orange-brand': {
					'50': '#fff7ed',
					'100': '#ffedd5',
					'200': '#fed7aa',
					'300': '#fdba74',
					'400': '#fb923c',
					'500': '#f97316',
					'600': '#ea580c',
					'700': '#c2410c',
					'800': '#9a3412',
					'900': '#7c2d12',
					'950': '#431407'
				},
				'gray-brand': {
					'50': '#f8fafc',
					'100': '#f1f5f9',
					'200': '#e2e8f0',
					'300': '#cbd5e1',
					'400': '#94a3b8',
					'500': '#64748b',
					'600': '#475569',
					'700': '#334155',
					'800': '#1e293b',
					'900': '#0f172a',
					'950': '#000000ff'
				},
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			backgroundImage: {
				'orange-gradient': 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
				'dark-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
			},
			animation: {
				'pulse-orange': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'bounce-orange': 'bounce 1s infinite'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontFamily: {
				sans: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				serif: ['var(--font-playfair)', 'Playfair Display', 'ui-serif', 'Georgia', 'Times New Roman', 'serif'],
				cursive: ['Dancing Script', 'cursive']
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}
