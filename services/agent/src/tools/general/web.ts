// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';

async function tavilySearch(query: string, maxResults: number): Promise<string> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    results?: { title: string; url: string; content: string; score: number }[];
  };

  return JSON.stringify({
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 500),
      score: r.score,
    })),
  });
}

async function tavilyExtract(urls: string[]): Promise<string> {
  const response = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      urls,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily extract error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    results?: { url: string; raw_content: string }[];
    failed_results?: { url: string; error: string }[];
  };

  return JSON.stringify({
    results: (data.results ?? []).map((r) => ({
      url: r.url,
      content: r.raw_content?.slice(0, 15000),
    })),
    failed: data.failed_results ?? [],
  });
}

export function createWebTools(_ctx: { sessionId: string; userId: string }) {
  return {
    web_search: tool({
      description: `Search the web for up-to-date information. Returns titles, URLs, and
snippets for the top results. Use this when you need current facts, news,
documentation, or any information not in your training data.`,
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        max_results: z
          .number()
          .optional()
          .default(5)
          .describe('Number of results to return (1–10). Default 5.'),
      }),
      execute: async ({ query, max_results }) => {
        if (!process.env.TAVILY_API_KEY) {
          throw new Error('TAVILY_API_KEY is not set');
        }
        const clamped = Math.min(Math.max(max_results ?? 5, 1), 10);
        return tavilySearch(query, clamped);
      },
    }),

    web_extract: tool({
      description: `Extract the full text content from one or more web page URLs.
Returns cleaned page content (up to 15,000 chars per page). Use this after
web_search to read the actual content of a page, or when the user provides
a URL they want analysed.`,
      inputSchema: z.object({
        urls: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe('List of URLs to extract content from (max 5)'),
      }),
      execute: async ({ urls }) => {
        if (!process.env.TAVILY_API_KEY) {
          throw new Error('TAVILY_API_KEY is not set');
        }
        return tavilyExtract(urls);
      },
    }),
  };
}
