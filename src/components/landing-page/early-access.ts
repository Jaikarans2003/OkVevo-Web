export function earlyAccessError(input: { email: string }): string | null {
    const email = input.email.trim()
    if (!email) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email.'
    return null
}
