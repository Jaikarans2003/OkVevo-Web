import { NextRequest } from 'next/server';

import { handleFalQueue } from '@/lib/fal/handleQueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

type Ctx = { params: Promise<{ path: string[] }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleFalQueue(request, path);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleFalQueue(request, path);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleFalQueue(request, path);
}
