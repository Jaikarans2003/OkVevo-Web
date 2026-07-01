'use client';

import { usePathname, useRouter } from 'next/navigation';
import AiStudioShellLayout from '@/components/workspace/ai-studio/AiStudioShellLayout';
import AiStudioSidebar from '@/components/workspace/ai-studio/AiStudioSidebar';
import { AiStudioWorkspaceProvider, useAiStudioWorkspace } from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';

function AiStudioLayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    activeSessionId,
    setActiveSessionId,
    startNewProject,
  } = useAiStudioWorkspace();

  const isFilesPage = pathname.endsWith('/files');

  const handleNewProject = () => {
    const didReset = startNewProject();
    if (!didReset) return;

    const target = '/workspace/ai-studio';
    if (isFilesPage) {
      router.push(target);
    } else {
      router.replace(target, { scroll: false });
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    const target = `/workspace/ai-studio?session=${encodeURIComponent(sessionId)}`;
    if (isFilesPage) {
      router.push(target);
    } else {
      router.replace(target, { scroll: false });
    }
  };

  return (
    <AiStudioShellLayout
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
      sidebar={
        <AiStudioSidebar
          collapsed={sidebarCollapsed}
          activeSessionId={activeSessionId}
          onSessionSelect={handleSessionSelect}
          onNewProject={handleNewProject}
        />
      }
    >
      {children}
    </AiStudioShellLayout>
  );
}

export default function AiStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <AiStudioWorkspaceProvider>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <AiStudioLayoutShell>{children}</AiStudioLayoutShell>
      </div>
    </AiStudioWorkspaceProvider>
  );
}
