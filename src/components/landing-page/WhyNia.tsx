'use client'

import { COMPARISON, COMING_SOON, niaCell, type Mark } from './claims'

function MarkCell({ value }: { value: Mark }) {
    const yes = value === 'yes'
    return <span aria-label={yes ? 'Yes' : 'No'}>{yes ? '✓' : '✕'}</span>
}

export default function WhyNia() {
    return (
        <section id="why" aria-label="Why Nia">
            <div className="why-head">
                <h2 className="why-lines nia-display">
                    <span>People are all-rounders with a profession.</span>
                    <span>So we gave Nia a job.</span>
                </h2>
            </div>

            <div className="nia-card mx-auto max-w-[1040px] overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-[var(--line)]">
                            <th className="px-4 py-4 font-medium" />
                            <th className="px-4 py-4 font-medium">Generalist agents</th>
                            <th className="bg-[color-mix(in_srgb,var(--nia)_8%,white)] px-4 py-4 font-medium">Nia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {COMPARISON.map((row) => {
                            const cell = niaCell(row)
                            return (
                                <tr key={row.label} className="nia-row border-b border-[var(--line)] last:border-0">
                                    <th className="px-4 py-3 font-normal">{row.label}</th>
                                    <td className="px-4 py-3 text-[var(--muted)]">
                                        <MarkCell value={row.general} />
                                    </td>
                                    <td className="bg-[color-mix(in_srgb,var(--nia)_8%,white)] px-4 py-3 font-medium">
                                        <MarkCell value={cell.mark} />
                                        {cell.soon ? (
                                            <span className="mt-1 block text-xs font-medium tracking-[0.06em] text-[var(--muted)] uppercase">
                                                {COMING_SOON}
                                            </span>
                                        ) : null}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <h2 className="nia-display nia-h2 mx-auto mt-20 max-w-[14em] px-6 pb-24 text-center">
                <span className="block">A generalist can help you,</span>
                <span className="block">a professional can be trusted.</span>
            </h2>
        </section>
    )
}
