'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, FolderOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  DeliverableImage,
  DeliverableVideo,
} from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';
const PANEL_EASE = [0.32, 0.72, 0, 1] as const;
const PANEL_DURATION = 0.44;

type PreviewAsset = {
  url: string;
  label: string;
  kind: 'video' | 'image';
};

function downloadAsset(url: string) {
  if (!url) throw new Error('Missing asset URL');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function VideoCard({
  url,
  label,
  onOpen,
}: {
  url: string;
  label: string;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const playPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {});
  };

  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={playPreview}
      onMouseLeave={stopPreview}
      onFocus={playPreview}
      onBlur={stopPreview}
      className="min-w-0 cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-[#1f1f1f]/80 text-left transition hover:border-white/[0.12]"
    >
      <video
        ref={videoRef}
        src={url}
        muted
        loop
        playsInline
        preload="metadata"
        className="pointer-events-none aspect-video w-full bg-black/50 object-cover"
      />
      <div className="bg-[#1f1f1f]/80 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white/88">
        <span className="block truncate">{label}</span>
      </div>
    </button>
  );
}

function ImageCard({
  url,
  label,
  onOpen,
}: {
  url: string;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-0 cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-[#1f1f1f]/80 text-left transition hover:border-white/[0.12]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="aspect-video w-full bg-black/50 object-contain"
      />
      <div className="bg-[#1f1f1f]/80 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white/88">
        <span className="block truncate">{label}</span>
      </div>
    </button>
  );
}

function AssetPreviewModal({
  asset,
  onClose,
}: {
  asset: PreviewAsset;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    setDownloadError(null);
    try {
      downloadAsset(asset.url);
      setDownloading(true);
      window.setTimeout(() => setDownloading(false), 400);
    } catch {
      setDownloadError('Download failed. Try again.');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={asset.label}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
            {asset.label}
          </h3>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            <Download size={16} strokeWidth={2.25} />
            {downloading ? 'Downloading…' : 'Download'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white/90"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
          {asset.kind === 'video' ? (
            <video
              src={asset.url}
              controls
              autoPlay
              playsInline
              className="max-h-[min(70vh,720px)] w-full rounded-xl bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.label}
              className="max-h-[min(70vh,720px)] w-full rounded-xl object-contain"
            />
          )}
        </div>

        {downloadError ? (
          <p className="px-4 pb-3 text-xs text-red-300/90">{downloadError}</p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function AiStudioDeliverablesRail({
  open,
  fileCount = 0,
  draftVideoUrl,
  renderedVideos = [],
  images = [],
}: {
  open: boolean;
  fileCount?: number;
  draftVideoUrl?: string;
  renderedVideos?: DeliverableVideo[];
  images?: DeliverableImage[];
}) {
  const [preview, setPreview] = useState<PreviewAsset | null>(null);
  const uploadedVideos = renderedVideos.filter((v) => v.kind === 'uploaded_video');
  const uploadedImages = images.filter((i) => i.kind === 'uploaded_image');
  const backgroundVideos = renderedVideos.filter(
    (v) => v.kind === 'background_video'
  );
  const finalVideos = renderedVideos.filter((v) => v.kind === 'draft_video');
  const clipVideos = renderedVideos.filter(
    (v) =>
      v.kind !== 'background_video' &&
      v.kind !== 'draft_video' &&
      v.kind !== 'uploaded_video'
  );
  const galleryImages = images.filter((i) => i.kind !== 'uploaded_image');
  // Fall back to session draftVideoUrl when no draft_video assets yet (legacy).
  const showDraftFallback = finalVideos.length === 0 && Boolean(draftVideoUrl);
  const empty =
    !showDraftFallback &&
    finalVideos.length === 0 &&
    clipVideos.length === 0 &&
    backgroundVideos.length === 0 &&
    galleryImages.length === 0 &&
    uploadedVideos.length === 0 &&
    uploadedImages.length === 0;

  const openVideo = (url: string, label: string) =>
    setPreview({ url, label, kind: 'video' });
  const openImage = (url: string, label: string) =>
    setPreview({ url, label, kind: 'image' });

  return (
    <>
      <AnimatePresence initial={false} mode="sync">
        {open ? (
          <motion.aside
            key="deliverables-rail"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '44%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: PANEL_DURATION, ease: PANEL_EASE }}
            className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-[#161616]"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#141414] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />

            <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-white/[0.05] px-5 py-3.5">
              <FolderOpen className="h-4 w-4 shrink-0 text-orange-400/90" />
              <h2 className="flex-1 text-sm font-semibold uppercase tracking-wide text-white/85">
                Deliverables
                <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-normal normal-case text-white/50">
                  {fileCount} files
                </span>
              </h2>
            </header>

            <div className="custom-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-8">
              {uploadedVideos.length > 0 || uploadedImages.length > 0 ? (
                <div className="mt-4 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                    Uploads ({uploadedVideos.length + uploadedImages.length})
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {uploadedVideos.map((video) => (
                      <VideoCard
                        key={video.id}
                        url={video.url}
                        label={video.label}
                        onOpen={() => openVideo(video.url, video.label)}
                      />
                    ))}
                    {uploadedImages.map((image) => (
                      <ImageCard
                        key={image.id}
                        url={image.url}
                        label={image.label}
                        onOpen={() => openImage(image.url, image.label)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {galleryImages.length > 0 ? (
                <div className="mt-4 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                    Images ({galleryImages.length})
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {galleryImages.map((image) => (
                      <ImageCard
                        key={image.id}
                        url={image.url}
                        label={image.label}
                        onOpen={() => openImage(image.url, image.label)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {backgroundVideos.length > 0 ? (
                <div className="mt-4 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                    Background videos ({backgroundVideos.length})
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {backgroundVideos.map((video) => (
                      <VideoCard
                        key={video.id}
                        url={video.url}
                        label={video.label}
                        onOpen={() => openVideo(video.url, video.label)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {finalVideos.length > 0 || showDraftFallback ? (
                <div className="mt-4 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                    Final video
                    {finalVideos.length > 1 ? ` (${finalVideos.length})` : ''}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {finalVideos.length > 0
                      ? finalVideos.map((video) => (
                          <VideoCard
                            key={video.id}
                            url={video.url}
                            label={video.label}
                            onOpen={() => openVideo(video.url, video.label)}
                          />
                        ))
                      : draftVideoUrl
                        ? (
                            <VideoCard
                              url={draftVideoUrl}
                              label="final.mp4"
                              onOpen={() => openVideo(draftVideoUrl, 'final.mp4')}
                            />
                          )
                        : null}
                  </div>
                </div>
              ) : null}
              {clipVideos.length > 0 ? (
                <div className="mt-4 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/42">
                    Rendered clips ({clipVideos.length})
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {clipVideos.map((video) => (
                      <VideoCard
                        key={video.id}
                        url={video.url}
                        label={video.label}
                        onOpen={() => openVideo(video.url, video.label)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {empty ? (
                <p className="mt-8 text-center text-sm text-white/38">
                  Renders and exports will appear here.
                </p>
              ) : null}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {preview ? (
        <AssetPreviewModal asset={preview} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}

export function DeliverablesToggle({
  count,
  active,
  onClick,
}: {
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      transition={{ duration: 0.32, ease: PANEL_EASE }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur-md ${
        active
          ? 'border-orange-500/35 bg-orange-500/12 text-white/88 shadow-[0_0_20px_-6px_rgba(249,115,22,0.45)]'
          : 'border-white/[0.08] bg-[#141414]/95 text-white/55 hover:border-white/[0.14] hover:text-white/78'
      }`}
      whileTap={{ scale: 0.97 }}
    >
      <FolderOpen
        size={13}
        className={`transition-colors duration-300 ${active ? 'text-orange-400' : 'text-white/45'}`}
      />
      Deliverables
      <AnimatePresence initial={false}>
        {count > 0 ? (
          <motion.span
            key="count"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
            className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300"
          >
            {count}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
