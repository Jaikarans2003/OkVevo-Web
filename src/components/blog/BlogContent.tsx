'use client';

import { useMemo } from 'react';

interface BlogContentProps {
    content: string;
}

export default function BlogContent({ content }: BlogContentProps) {
    const parsedContent = useMemo(() => {
        const sections = content.split('\n\n');
        
        return sections.map((section, index) => {
            // Check if section is a table (starts with |)
            if (section.trim().startsWith('|')) {
                return renderTable(section, index);
            }
            
            // Check if section is a graph/chart indicator
            if (section.trim().startsWith('[GRAPH:') || section.trim().startsWith('[CHART:')) {
                return renderGraphPlaceholder(section, index);
            }
            
            // Regular paragraph
            return (
                <p key={index} className="text-lg leading-relaxed mb-6 text-white/80">
                    {section}
                </p>
            );
        });
    }, [content]);

    return <div className="space-y-6">{parsedContent}</div>;
}

function renderTable(tableText: string, key: number) {
    const lines = tableText.trim().split('\n');
    if (lines.length < 2) return null;

    // Parse header
    const headerCells = lines[0]
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell);

    // Skip separator line (line with dashes)
    const dataRows = lines.slice(2).map(line =>
        line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell)
    );

    return (
        <div key={key} className="my-8 overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden border border-white/10 rounded-xl">
                    <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-white/5">
                            <tr>
                                {headerCells.map((header, i) => (
                                    <th
                                        key={i}
                                        className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-white/5">
                            {dataRows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-white/5 transition-colors">
                                    {row.map((cell, cellIndex) => (
                                        <td
                                            key={cellIndex}
                                            className="px-6 py-4 text-sm text-white/80 whitespace-nowrap"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function renderGraphPlaceholder(graphText: string, key: number) {
    // Extract graph type and data from text like [GRAPH: Bar Chart - Sales Data]
    const match = graphText.match(/\[(GRAPH|CHART):\s*(.+?)\]/);
    if (!match) return null;

    const [, type, description] = match;

    return (
        <div
            key={key}
            className="my-8 p-8 bg-white/5 border border-white/10 rounded-xl"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-orange-600 rounded-full animate-pulse" />
                <h3 className="text-lg font-bold text-white">{type}: {description}</h3>
            </div>
            <div className="aspect-video bg-black/20 rounded-lg flex items-center justify-center border border-white/5 shadow-sm">
                <div className="text-center">
                    <svg
                        className="w-16 h-16 mx-auto mb-3 text-white/20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                    </svg>
                    <p className="text-sm text-white/60">{description}</p>
                    <p className="text-xs text-white/40 mt-2">Graph visualization placeholder</p>
                </div>
            </div>
        </div>
    );
}
