// Theme-aware class name helper
export function getThemeClasses(theme: 'light' | 'dark') {
    return {
        // Backgrounds
        bg: theme === 'light' ? 'bg-bg-main' : 'bg-custom-bg',
        bgSecondary: theme === 'light' ? 'bg-white' : 'bg-custom-bg',

        // Text
        text: theme === 'light' ? 'text-text-main' : 'text-custom-cream',
        textDim: theme === 'light' ? 'text-text-dim' : 'text-custom-cream/60',

        // Cards
        card: theme === 'light' ? 'glass-card border border-text-main/10' : 'bg-custom-cream/5 border border-accent-orange/20',
        messageCard: theme === 'light' ? 'bg-white border-2 border-text-main/5' : 'bg-custom-cream/5 border border-accent-orange/30',

        // Inputs
        input: theme === 'light' ? 'bg-white border-2 border-text-main/10 text-text-main placeholder-text-dim/40 focus:border-accent-orange' : 'bg-custom-bg border-2 border-accent-orange/30 text-custom-cream placeholder-custom-cream/30 focus:border-accent-orange',

        // Sidebar
        sidebar: theme === 'light' ? 'glass-card border border-text-main/10' : 'bg-custom-bg/80 backdrop-blur-md border border-accent-orange/20',

        // Bot avatar
        botAvatar: theme === 'light' ? 'bg-accent-orange' : 'bg-accent-orange',

        // User avatar  
        userAvatar: theme === 'light' ? 'bg-text-main/20' : 'bg-custom-cream/20',
    };
}
