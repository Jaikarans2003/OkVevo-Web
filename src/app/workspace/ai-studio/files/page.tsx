'use client';

import { FilesEmptyState } from '@/components/workspace/ai-studio/FilesEmptyState';

export default function AiStudioFilesPage() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-4 py-8">
      <FilesEmptyState />
    </div>
  );
}
