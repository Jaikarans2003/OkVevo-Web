/** Layout + highlight wave for the accountant dump diagram.
 * Coordinates are the desktop stage viewBox. Lines leave each file,
 * meet at the junction, then run through the mascot into the result.
 */

export type DumpFile = {
    id: string
    name: string
    kind: string
    x: number
    y: number
    prompt: string
    result: string
    output: string
}

export const STAGE = { w: 1600, h: 700 }
export const CARD = { w: 148, h: 64 }
export const JUNCTION = { x: 312, y: 318 }
export const PILL_IN = { x: 336, y: 302, w: 70, h: 32 }
export const PILL_OUT = { x: 638, y: 302, w: 70, h: 32 }
export const MASCOT = { x: 434, y: 230, w: 176, h: 194 }
export const RESULT_X = 736
/** Resting “Result” word width. The open app window uses APP_W. */
export const WORD_W = 228
export const APP_W = 440
export const APP_H = 500

export const FILES: DumpFile[] = [
    {
        id: 'hdfc', name: 'HDFC-Sep.pdf', kind: 'PDF', x: 100, y: 16,
        prompt: 'Can you reconcile this HDFC statement for September against Sharma Traders’ books? Flag anything that doesn’t match, and please don’t touch the ledger yet. I’ll review first.',
        result: 'I’ve gone through all **42 lines** of the September statement and matched **39** of them to the ledger.\n\nThree need your eye:\n\n- A ₹18,400 debit on 14 Sep with no matching voucher\n- ₹2,950 in bank charges that haven’t been booked\n- A ₹60,000 credit that looks like a duplicate of the 11 Sep receipt\n\nThe ledger is untouched. The full reconciliation is attached.',
        output: 'HDFC-Sep-reconciled.xlsx',
    },
    {
        id: 'rent', name: 'Rent-12Sep.pdf', kind: 'PDF', x: 14, y: 106,
        prompt: 'This is the rent receipt for the Andheri office. Match it to the September ledger and tell me if the TDS was deducted correctly.',
        result: 'The receipt is for **₹85,000** and it matches the rent entry dated 12 Sep.\n\nTDS at 10% under section 194-I was deducted (₹8,500), so the net payment of **₹76,500** also agrees with the bank line. Nothing to correct here. I’ve attached the matched copy for your file.',
        output: 'Rent-12Sep-matched.pdf',
    },
    {
        id: 'neft', name: 'NEFT-Sharma.pdf', kind: 'PDF', x: 112, y: 196,
        prompt: 'Match this NEFT advice to the right invoice. I think Sharma Traders paid two invoices in one transfer, so please check that before you post anything.',
        result: 'You were right. The transfer of **₹1,24,500** covers two invoices:\n\n- INV-2041 for ₹78,000\n- INV-2047 for ₹46,500\n\nBoth are now marked as received against Sharma Traders and nothing is outstanding on their account. The matched file is attached.',
        output: 'NEFT-Sharma-matched.csv',
    },
    {
        id: 'upi', name: 'UPI-22Sep.csv', kind: 'CSV', x: 8, y: 286,
        prompt: 'Go through this UPI export and flag anything unusual. Look for duplicates, round amounts to payees we don’t know, and anything outside business hours.',
        result: 'I checked **212 payments** and flagged **3** for you:\n\n- Two payments of ₹4,999 to the same payee within a minute\n- A ₹25,000 transfer to a payee we haven’t paid before\n- A 3:12 am payment to a merchant you don’t normally use\n\nThe rest look routine. The flags are in the attached file.',
        output: 'UPI-22Sep-flags.csv',
    },
    {
        id: 'gst', name: 'GSTR-1.xls', kind: 'XLS', x: 104, y: 376,
        prompt: 'Draft the GSTR-1 for September from this sheet. Keep B2B and B2C separate, and tell me if any GSTIN looks wrong before I file.',
        result: 'The draft is ready for your review. It covers **64 invoices**, 41 B2B and 23 B2C, with a total taxable value of **₹18.6 lakh**.\n\nThe GSTIN on invoice 2052 has only 14 characters, so I’ve held it out of B2B until you confirm the right number. Nothing has been filed. The draft is attached.',
        output: 'GSTR-1-draft.xls',
    },
    {
        id: 'bills', name: 'Client-bills.zip', kind: 'ZIP', x: 18, y: 466,
        prompt: 'Pull the client bills out of this archive and sort them by client. Tell me which ones are missing before I start chasing anyone.',
        result: 'I unpacked **58 files** and sorted them into one folder per client.\n\nTwo bills are missing from the series: **#1184** for Mehta & Sons and **#1191** for Kapoor Textiles. I’ve listed both so you can ask for copies. Everything else is packed and attached.',
        output: 'Client-bills-out.zip',
    },
    {
        id: 'tds', name: 'TDS-26Q.pdf', kind: 'PDF', x: 96, y: 556,
        prompt: 'Line up the deductions in this 26Q return with the challans we paid. I want to be sure it’s ready well before the due date.',
        result: 'All **31 deductee entries** line up with the challans, and the total tax of **₹1,42,300** matches what was deposited.\n\nTwo challans were paid a day late, which attracts interest of ₹284 in total. I’ve noted it in the file so it can be paid along with the return. It’s attached.',
        output: 'TDS-26Q-lined.pdf',
    },
]

/** The result is a fixed Nia window. The thread inside scrolls. */
export function resultBox(_count: number): { x: number; y: number; w: number; h: number } {
    return { x: RESULT_X, y: JUNCTION.y - APP_H / 2, w: APP_W, h: APP_H }
}

/** Vertical channel just past the widest file, so elbows never cut a card. */
export const RAIL = Math.max(...FILES.map((file) => file.x + CARD.w)) + 16

export function feedPath(file: DumpFile): string {
    const x1 = file.x + CARD.w
    const y1 = file.y + CARD.h / 2
    return `M ${x1} ${y1} H ${RAIL} C ${JUNCTION.x} ${y1}, ${JUNCTION.x} ${y1}, ${JUNCTION.x} ${JUNCTION.y}`
}

/** One stream: file → junction → result. The mascot sits on top of the middle. */
export function streamPath(file: DumpFile): string {
    return `${feedPath(file)} H ${RESULT_X}`
}

export const SPINE = [
    `M ${JUNCTION.x} ${JUNCTION.y} H ${PILL_IN.x}`,
    `M ${PILL_IN.x + PILL_IN.w} ${JUNCTION.y} H ${MASCOT.x}`,
    `M ${MASCOT.x + MASCOT.w} ${JUNCTION.y} H ${PILL_OUT.x}`,
    `M ${PILL_OUT.x + PILL_OUT.w} ${JUNCTION.y} H ${RESULT_X}`,
]

export function shuffleIds(ids: readonly number[], random: () => number = Math.random): number[] {
    const next = [...ids]
    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        const swap = next[i]
        next[i] = next[j]
        next[j] = swap
    }
    return next
}
