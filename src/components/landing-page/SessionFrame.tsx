export type SessionLine = {
    role: 'you' | 'nia' | 'note';
    text: string;
    tone?: 'petrol' | 'ochre' | 'moss' | 'rust' | 'slate';
};

const TONE: Record<NonNullable<SessionLine['tone']>, string> = {
    petrol: 'bg-[#2c5a55] text-[#e3dcd6]',
    ochre: 'bg-[#c9962e] text-[#2b2b2b]',
    moss: 'bg-[#5c6d4a] text-[#e3dcd6]',
    rust: 'bg-[#a8422f] text-[#e3dcd6]',
    slate: 'bg-[#4a5a63] text-[#e3dcd6]',
};

export default function SessionFrame({ label, lines }: { label: string; lines: readonly SessionLine[] }) {
    return (
        <div className="overflow-hidden rounded-[1.75rem] bg-[#242424] text-[#e3dcd6] shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#e3dcd6]/10 px-5 py-4">
                <p className="text-sm">{label}</p>
                <p className="rounded-full bg-[#4a5a63] px-3 py-1 text-xs">On this computer</p>
            </div>
            <div className="flex min-h-[300px] flex-col justify-end gap-3 px-5 py-6">
                {lines.map((line) => {
                    if (line.role === 'note') {
                        return (
                            <p
                                key={line.text}
                                className={`w-fit rounded-full px-3 py-1 text-xs ${TONE[line.tone ?? 'slate']}`}
                            >
                                {line.text}
                            </p>
                        );
                    }
                    if (line.role === 'you') {
                        return (
                            <p
                                key={line.text}
                                className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#6b4a35] px-4 py-3 text-sm leading-relaxed"
                            >
                                {line.text}
                            </p>
                        );
                    }
                    return (
                        <p key={line.text} className="mr-auto max-w-[90%] text-sm leading-relaxed text-[#e3dcd6]/90">
                            {line.text}
                        </p>
                    );
                })}
            </div>
        </div>
    );
}
