export function usePipelineApproval(
  sessionId: string | null,
  sendMessage: (msg: { text: string }) => void
) {
  const approve = () => {
    if (!sessionId) return
    sendMessage({ text: 'Looks good, continue with rendering' })
  }

  return { approve }
}
