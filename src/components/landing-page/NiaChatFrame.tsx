'use client'

import { FILES } from './dump-wave'
import { FOLLOW_UP_PLACEHOLDERS, NiaComposer, NiaTurn, Thread } from './nia-app/kit'

/** One answered file. `chars` undefined = the reply is fully streamed. */
export type ChatTurn = { index: number; chars?: number }

/** The accountant preview: the real Nia chat, fed by the dump animation. Typing and attaching work; sending doesn't. */
export default function NiaChatFrame({ turns, phase = 'still' }: { turns: ChatTurn[]; phase?: 'in' | 'still' }) {
    const last = turns.at(-1)
    return (
        <div className={`nia-win nia-win--frame dump-result${phase === 'in' ? ' is-in' : ''}`}>
            <div className="na-lights" aria-hidden>
                <span />
                <span />
                <span />
            </div>
            <div className="na-main">
                <Thread tick={`${turns.length}:${last?.chars ?? 'done'}`}>
                    {turns.map(({ index, chars }) => {
                        const file = FILES[index]
                        return (
                            <NiaTurn
                                key={file.id}
                                user={file.prompt}
                                files={[file.name]}
                                reply={file.result}
                                output={file.output}
                                chars={chars}
                            />
                        )
                    })}
                </Thread>
                <div className="na-dock">
                    <NiaComposer lean placeholders={FOLLOW_UP_PLACEHOLDERS} />
                    <p className="na-note">Nia is AI Agent and can make mistakes, please double-check responses</p>
                </div>
            </div>
        </div>
    )
}
