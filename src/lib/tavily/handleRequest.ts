import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';
import {
  InFlightBudgetError,
  InsufficientCreditsError,
  OrgAccessDeniedError,
  PlanNotActiveError,
  reconcileCredits,
  releaseCredits,
  reserveCredits,
} from '@/lib/gateway/debit';
import {
  inFlightBudgetResponse,
  insufficientCreditsResponse,
  invalidTokenResponse,
} from '@/lib/gateway/httpErrors';
import {
  endCustomerRefFromRequest,
  orgPublicIdFromRequest,
} from '@/lib/orgs/orgContext';
import { creditsFromUsd } from '@/lib/gateway/pricing';
import { proxyTavily, tavilyServerKey } from '@/lib/tavily/client';
import {
  billedTavilyCredits,
  estimateTavilyCredits,
  tavilyUsdPerCredit,
  urlList,
} from '@/lib/tavily/credits';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function handleTavily(
  request: NextRequest,
  action: string
): Promise<Response> {
  if (action !== 'search' && action !== 'extract') {
    return jsonError(404, 'not found');
  }
  const token = gatewayIdToken(request);
  if (!token) return invalidTokenResponse();
  let uid: string;
  let email: string | undefined;
  let emailVerified: boolean | undefined;
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email;
    emailVerified = decoded.email_verified === true;
  } catch {
    return invalidTokenResponse();
  }
  if (!tavilyServerKey()) return jsonError(500, 'TAVILY_API_KEY missing');
  const orgPublicId = orgPublicIdFromRequest(request);
  const endCustomerRef = endCustomerRefFromRequest(request);

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonError(400, 'invalid json');
  }

  if (action === 'extract' && urlList(body).length === 0) {
    return jsonError(400, 'extract needs urls');
  }

  const tavilyEst = estimateTavilyCredits(action, body);
  const estimated = creditsFromUsd(tavilyEst * tavilyUsdPerCredit()).credits;
  const requestId = crypto.randomUUID();
  try {
    await reserveCredits({
      uid,
      requestId,
      provider: 'tavily',
      estimatedCredits: estimated,
      extra: { action, tavilyCredits: tavilyEst, requestedModel: `tavily-${action}` },
      orgPublicId,
      endCustomerRef,
      email,
      emailVerified,
    });
  } catch (err) {
    if (err instanceof OrgAccessDeniedError) {
      return NextResponse.json(
        { error: { message: err.code, code: err.code } },
        { status: 403 }
      );
    }
    if (err instanceof PlanNotActiveError) {
      return jsonError(403, 'plan not active');
    }
    if (err instanceof InFlightBudgetError) return inFlightBudgetResponse();
    if (err instanceof InsufficientCreditsError) return insufficientCreditsResponse();
    throw err;
  }

  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  let proxied: { status: number; json: unknown; text: string };
  try {
    proxied = await proxyTavily(action, rec);
  } catch (err) {
    console.error('tavily proxy failed', err);
    await releaseCredits(requestId);
    return jsonError(502, 'Tavily request failed');
  }

  if (proxied.status >= 400) {
    await releaseCredits(requestId);
    return new NextResponse(proxied.text, {
      status: proxied.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const billedTavily = billedTavilyCredits(action, body, proxied.json);
  const billed = creditsFromUsd(billedTavily * tavilyUsdPerCredit());
  try {
    await reconcileCredits({
      requestId,
      actualCredits: billed.credits,
      provider: 'tavily',
      model: `tavily-${action}`,
      costUsd: billed.costUsd,
      priceUsd: billed.rawUsd,
    });
  } catch (err) {
    console.error('tavily reconcile failed', err);
  }
  return NextResponse.json(proxied.json);
}
