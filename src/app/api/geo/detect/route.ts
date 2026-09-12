import { NextRequest, NextResponse } from 'next/server';

import { detectCountry } from '@/lib/billing/detectCountry';

export const runtime = 'nodejs';

/** Server-side country → INR/USD. Pricing page applies the cookie override. */
export async function GET(request: NextRequest) {
    const detected = await detectCountry(request.headers);
    return NextResponse.json(detected, {
        headers: {
            'Cache-Control': 'private, max-age=300',
        },
    });
}
