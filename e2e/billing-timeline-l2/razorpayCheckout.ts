/**
 * Drives the real Razorpay Checkout widget from a blank Playwright page,
 * given the `subscriptionId` + `razorpayKeyId` a real API route just
 * returned (plan §14.3). Deliberately bypasses our own pricing/billing UI.
 *
 * Staging test-mode Checkout: Contact details sheet before pay; UPI behind
 * "Show more options". Mobile is a React-controlled input — Playwright
 * fill/type can leave the DOM empty after Continue; we set via the native
 * HTMLInputElement value setter + input/change events.
 */
import type { Frame, Locator, Page } from '@playwright/test';

const TEST_EMAIL = 'l2-billing@okvevo.test';
/** Razorpay rejects obvious sequences like 9876543210 ("Please enter a valid mobile number"). */
const TEST_MOBILE = '9123456789';
/** USD Checkout defaults to +91; switch to US so contact validation matches currency. */
const TEST_MOBILE_US = '2015550123';

/** Opens Razorpay Checkout for a subscription on a fresh blank page. */
export async function openSubscriptionCheckout(
  page: Page,
  opts: { razorpayKeyId: string; subscriptionId: string }
): Promise<void> {
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><html><body>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </body></html>`);
  await page.waitForFunction(() => typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== 'undefined');
  await page.evaluate(
    ({ key, subscription_id, email, contact }) => {
      const w = window as unknown as {
        Razorpay: new (o: Record<string, unknown>) => { open: () => void };
      };
      const rzp = new w.Razorpay({
        key,
        subscription_id,
        name: 'OkVevo billing-timeline-l2',
        prefill: { email, contact },
        handler: () => {
          document.title = 'L2_PAYMENT_SUCCESS';
        },
        modal: {
          ondismiss: () => {
            document.title = 'L2_PAYMENT_DISMISSED';
          },
        },
      });
      rzp.open();
    },
    {
      key: opts.razorpayKeyId,
      subscription_id: opts.subscriptionId,
      email: TEST_EMAIL,
      // IN mobile — matches INR Checkout / +91 contact sheet.
      contact: TEST_MOBILE,
    }
  );
  await waitForCheckoutFrame(page);
  await page.waitForTimeout(1_500);
  await dismissContactDetailsIfPresent(page, 20_000);
}

async function waitForCheckoutFrame(page: Page, timeoutMs = 45_000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const hit = await frame
          .locator('body')
          .getByText(/payment options|contact details/i)
          .first()
          .isVisible()
          .catch(() => false);
        if (hit) return frame;
      } catch {
        // skip
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error('razorpayCheckout: Checkout iframe not found');
}

async function checkoutFrame(page: Page): Promise<Frame> {
  return waitForCheckoutFrame(page, 15_000);
}

/** Fill + dismiss Contact details if present. Returns true if sheet was handled. */
async function dismissContactDetailsIfPresent(page: Page, waitMs = 2_500): Promise<boolean> {
  const frame = await checkoutFrame(page);
  const heading = frame.getByRole('heading', { name: /contact details/i });
  try {
    await heading.waitFor({ state: 'visible', timeout: waitMs });
  } catch {
    return false;
  }

  // Contact sheet is a real <form>. Stay on whatever country Checkout shows
  // (+91 for INR, often +1 after USD prefill). Only switch if validation fails.
  const contactForm = frame.locator('form').filter({ has: frame.getByPlaceholder('Mobile number') });
  const countryBtn = contactForm.getByRole('button').filter({ hasText: /\+\d+/ }).first();
  const mobile = contactForm.locator('input[name="contact"], input[type="tel"]').first();
  const email = contactForm.locator('input[name="email"], input[placeholder*="Email" i]').first();

  const countryNow = ((await countryBtn.textContent().catch(() => '')) || '').trim();
  let number = /\+1\b/.test(countryNow) ? TEST_MOBILE_US : TEST_MOBILE;

  await mobile.click();
  await mobile.fill('');
  await mobile.pressSequentially(number, { delay: 25 });

  if (await email.isVisible().catch(() => false)) {
    const current = await email.inputValue().catch(() => '');
    if (!current) {
      await email.click();
      await email.fill(TEST_EMAIL);
    }
  }

  const continueBtn = contactForm.getByRole('button', { name: /^continue$/i });
  await continueBtn.click({ timeout: 5_000 });

  // If IN number rejected, flip to US (+1) and retry once.
  const invalid = contactForm.getByText(/valid mobile number/i);
  if (await invalid.isVisible({ timeout: 1_500 }).catch(() => false)) {
    if (await countryBtn.isVisible().catch(() => false) && !/\+1\b/.test(countryNow)) {
      await countryBtn.click();
      const us = frame.getByText(/united states|\bUSA\b/i).first();
      if (await us.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await us.click();
        number = TEST_MOBILE_US;
      } else {
        await page.keyboard.press('Escape').catch(() => undefined);
        number = TEST_MOBILE_US; // try alt digits on same country
      }
    } else {
      number = number === TEST_MOBILE_US ? TEST_MOBILE : TEST_MOBILE_US;
    }
    await mobile.fill('');
    await mobile.pressSequentially(number, { delay: 25 });
    await continueBtn.click({ timeout: 5_000 });
  }

  try {
    await heading.waitFor({ state: 'hidden', timeout: 15_000 });
    return true;
  } catch {
    await contactForm.evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
    });
    try {
      await heading.waitFor({ state: 'hidden', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}

/** Click a locator; if Contact details blocks it, dismiss and retry. */
async function clickClearingContact(page: Page, locator: Locator, attempts = 6): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    await dismissContactDetailsIfPresent(page, i === 0 ? 8_000 : 1_500);
    try {
      await locator.click({ timeout: 5_000 });
      return;
    } catch (err) {
      lastErr = err;
      await dismissContactDetailsIfPresent(page, 3_000);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('clickClearingContact failed');
}

/** Pay with the UPI test VPA that auto-succeeds in Razorpay test mode (INR Checkout). */
export async function payWithUpiSuccess(page: Page): Promise<void> {
  await dismissContactDetailsIfPresent(page, 8_000);
  const frame = await checkoutFrame(page);

  // Close Accidental Account & Terms drawer (⋯ menu) if it stole focus.
  const accountTerms = frame.getByRole('heading', { name: /account\s*&\s*terms/i });
  if (await accountTerms.isVisible().catch(() => false)) {
    await frame.getByRole('button').filter({ has: frame.locator('[aria-label*="close" i]') }).first()
      .click({ timeout: 3_000 })
      .catch(async () => {
        await page.keyboard.press('Escape');
      });
  }

  // Select UPI method row (accessible name includes app icons).
  const upiMethod = frame.getByRole('button', { name: /^upi\b/i }).first();
  await clickClearingContact(page, upiMethod);

  // Subscription Checkout defaults to UPI QR — switch to collect (VPA) if offered.
  for (const label of [/enter upi id/i, /pay.*upi id/i, /upi id/i, /collect/i]) {
    const tab = frame.getByRole('button', { name: label }).or(frame.getByText(label)).first();
    if (await tab.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await tab.click();
      break;
    }
  }

  const vpaInput = frame
    .getByPlaceholder(/upi id|enter upi|vpa|example@okhdfcbank/i)
    .or(frame.getByRole('textbox', { name: /upi/i }))
    .first();
  try {
    await vpaInput.waitFor({ state: 'visible', timeout: 8_000 });
  } catch {
    // No VPA collect UI on this Checkout build — fall back to test card so
    // Layer 2 still covers create-subscription → Checkout → webhook.activate.
    // UPI collect webhook paths stay covered by Layer 1 fixtures.
    await payWithTestCard(page);
    return;
  }
  await vpaInput.fill('success@razorpay');

  await clickClearingContact(
    page,
    frame.getByRole('button', { name: /verify|pay|continue/i }).first()
  );

  const payButton = frame.getByRole('button', { name: /^pay/i }).first();
  if (await payButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await clickClearingContact(page, payButton);
  }

  await page.waitForFunction(() => document.title === 'L2_PAYMENT_SUCCESS', { timeout: 60_000 });
}

/** Pay with the Razorpay test card that auto-succeeds in test mode. */
export async function payWithTestCard(page: Page): Promise<void> {
  await dismissContactDetailsIfPresent(page, 8_000);
  const frame = await checkoutFrame(page);

  const cards = frame.getByRole('button', { name: /cards/i }).first();
  if (await cards.isVisible().catch(() => false)) {
    await clickClearingContact(page, cards);
  }

  // Order matters. 4718… is the legacy Subscriptions happy-path card.
  // 5305… is Native-OTP recurring. 4100… often fails Checkout with
  // "not eligible for recurring" on this staging account.
  // Docs: razorpay.com/.../test-s2s/recurring/card-recurring
  const RECURRING_CARDS = [
    '4718609108204366',
    '5305620000060000',
    '6527658900001005',
    '4100280000001007',
  ] as const;

  async function fillCard(number: string) {
    const num = frame.getByRole('textbox', { name: /card number/i });
    await num.click();
    await num.fill('');
    await num.pressSequentially(number, { delay: 15 });
    await frame.getByRole('textbox', { name: /mm\s*\/\s*yy/i }).fill('12/35');
    await frame.getByRole('textbox', { name: /^cvv$/i }).fill('123');
    const nameInput = frame
      .getByRole('textbox', { name: /name on card|enter name/i })
      .or(frame.getByPlaceholder(/name on card|enter name/i))
      .first();
    if (await nameInput.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await nameInput.fill('L2 Test');
    }
    const saveCard = frame.getByRole('checkbox', { name: /save this card|rbi/i });
    if (await saveCard.isVisible({ timeout: 1_000 }).catch(() => false)) {
      if (!(await saveCard.isChecked().catch(() => false))) await saveCard.check();
    }
  }

  async function advancePastSaveCard() {
    await clickClearingContact(page, frame.getByRole('button', { name: /^continue$/i }).first());
    const nameErr = frame.getByText(/enter name on your card/i);
    if (await nameErr.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await frame
        .getByRole('textbox', { name: /name on card|enter name/i })
        .or(frame.getByPlaceholder(/name on card|enter name/i))
        .first()
        .fill('L2 Test');
      await clickClearingContact(page, frame.getByRole('button', { name: /^continue$/i }).first());
    }
    const secureCard = frame.getByRole('button', { name: /yes,?\s*secure my card/i });
    try {
      await secureCard.waitFor({ state: 'visible', timeout: 8_000 });
      await secureCard.click();
    } catch {
      // some cards skip the consent sheet
    }

    // Prefer entering a test OTP (Native OTP cards) over Skip — Skip has
    // produced "not eligible for recurring" / "Currency is not supported".
    const otpHeading = frame.getByText(/securely saving your card|otp sent/i);
    try {
      await otpHeading.first().waitFor({ state: 'visible', timeout: 8_000 });
      const otpBoxes = frame.locator('input[inputmode="numeric"], input[maxlength="1"]');
      if ((await otpBoxes.count()) >= 4) {
        await otpBoxes.first().click();
        await page.keyboard.type('123456', { delay: 40 });
        await frame.getByRole('button', { name: /^continue$/i }).last().click();
      } else {
        await frame.getByRole('button', { name: /skip otp/i }).click();
      }
    } catch {
      // no OTP sheet
    }
  }

  /** After save-card: Pay sheet, hard error, or auto-success. */
  async function settleOrReject(): Promise<'ok' | 'reject'> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (await page.title().then((t) => t === 'L2_PAYMENT_SUCCESS').catch(() => false)) {
        return 'ok';
      }
      const reject = frame.getByText(/not eligible for recurring|currency is not supported|payment could not be completed/i);
      if (await reject.first().isVisible().catch(() => false)) {
        const tryAgain = frame.getByRole('button', { name: /try again/i });
        if (await tryAgain.isVisible().catch(() => false)) await tryAgain.click();
        return 'reject';
      }
      const payButton = frame.getByRole('button', { name: /^pay\b/i }).first();
      if (await payButton.isVisible().catch(() => false)) {
        const usdOpt = frame.getByText(/USD\s*\$/i).first();
        if (await usdOpt.isVisible().catch(() => false)) await usdOpt.click();
        await payButton.click();
        // Pay may still reject — keep looping briefly.
        await page.waitForTimeout(1_500);
        continue;
      }
      const successBtn = frame.getByRole('button', { name: /^success$/i });
      if (await successBtn.isVisible().catch(() => false)) {
        await successBtn.click();
        return 'ok';
      }
      await page.waitForTimeout(400);
    }
    // Timed out without reject — treat as ok and wait for handler below.
    return 'ok';
  }

  let accepted = false;
  for (const number of RECURRING_CARDS) {
    // Re-open Cards after a Try-again that returns to Payment Options.
    if (await cards.isVisible().catch(() => false)) {
      await cards.click().catch(() => undefined);
    }
    await fillCard(number);
    await advancePastSaveCard();
    const result = await settleOrReject();
    if (result === 'ok') {
      accepted = true;
      break;
    }
  }
  if (!accepted) {
    throw new Error('payWithTestCard: all recurring test cards were rejected');
  }

  // Mock bank / leftover OTP (frame and any popup pages — no cross-frame .or()).
  try {
    const frameSuccess = frame.getByRole('button', { name: /^success$/i });
    await frameSuccess.waitFor({ state: 'visible', timeout: 5_000 });
    await frameSuccess.click();
  } catch {
    // not in checkout frame
  }
  for (const p of page.context().pages()) {
    const bankSuccess = p.getByRole('button', { name: /^success$/i });
    if (await bankSuccess.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await bankSuccess.click();
    }
  }

  await page.waitForFunction(() => document.title === 'L2_PAYMENT_SUCCESS', { timeout: 90_000 });
}
