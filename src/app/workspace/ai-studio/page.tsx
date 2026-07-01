'use client';

import { Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AiStudioShell from '@/components/workspace/ai-studio/AiStudioShell';

function AiStudioPageContent() {
  const { user } = useAuth();
  if (!user) return null;
  return <AiStudioShell userId={user.uid} />;
}

export default function AiStudioPage() {
  return (
    <Suspense fallback={null}>
      <AiStudioPageContent />
    </Suspense>
  );
}
