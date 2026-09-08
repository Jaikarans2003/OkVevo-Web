import { NextRequest } from 'next/server';

import { handleTavily } from '@/lib/tavily/handleRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: Promise<{ action: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { action } = await ctx.params;
  return handleTavily(request, action);
}
