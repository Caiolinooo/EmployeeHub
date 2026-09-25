'use client';

import React, { useState, useLayoutEffect } from 'react';
import NewsPostEditor from './NewsPostEditor';
import NewsPostPreview, { NewsPostDraft } from './NewsPostPreview';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';

interface Props {
  userId: string;
  postId?: string;
  onClose?: () => void;
}

// Full-screen editor com painel de preview ao lado (Opção C)
const NewsPostEditorFullScreen: React.FC<Props> = ({ userId, postId, onClose }) => {
  const [draft, setDraft] = useState<NewsPostDraft>({
    title: '',
    excerpt: '',
    content: '',
    media_urls: [],
    tags: [],
    featured: false,
    pinned: false,
  });

  const { markTrigger, restoreFocus } = useRestoreFocus();
  useLayoutEffect(() => {
    const el = document.activeElement;
    const stable = document.querySelector('[data-news-more], [data-news-create]');
    const menuItemGone = el instanceof HTMLElement
      && /^\s*(Editar|Edit)\s*$/i.test((el.textContent || '').trim());
    if (
      el instanceof HTMLElement
      && el !== document.body
      && !menuItemGone
      && document.contains(el)
    ) {
      markTrigger(el);
      return;
    }
    if (stable instanceof HTMLElement) markTrigger(stable);
  }, [markTrigger]);
  const handleClose = () => {
    onClose?.();
    restoreFocus();
  };
  useEscapeToClose(Boolean(onClose), onClose ? handleClose : () => {});
  useEscapeCapture(Boolean(onClose), onClose ? handleClose : () => {});

  // Atalhos de teclado: salvar rascunho (Ctrl/Cmd+S) e publicar (Ctrl/Cmd+Enter)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const saveCombo = (isMac && e.metaKey && e.key.toLowerCase() === 's') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 's');
      const publishCombo = (isMac && e.metaKey && e.key === 'Enter') || (!isMac && e.ctrlKey && e.key === 'Enter');
      if (saveCombo || publishCombo) {
        e.preventDefault();
        const evt = new CustomEvent('news-editor:shortcut', { detail: { action: saveCombo ? 'save' : 'publish' } });
        window.dispatchEvent(evt);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white" data-modal-panel="">
      {/* Topbar */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between max-md:gap-3">
          <h1 className="text-lg font-semibold max-md:min-w-0 max-md:truncate">Editor do ABZ News</h1>
          <div className="flex items-center gap-3 text-sm text-gray-600 max-md:shrink-0">
            <span className="hidden sm:inline">Atalhos: Ctrl/Cmd+S (Salvar), Ctrl/Cmd+Enter (Publicar)</span>
            {onClose && (
              <>
                <button type="button" onClick={handleClose} className="text-gray-500 hover:text-gray-700 max-md:hidden">Fechar</button>
                <ModalCloseButton onClick={handleClose} mobileOnly mountOnlyWhenMobile />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content: Editor + Preview */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-56px)] max-md:h-auto max-md:max-h-[calc(100dvh-56px)] max-md:overflow-y-auto">
        <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white max-md:min-h-[50vh] max-md:overflow-visible">
          <div className="h-full overflow-y-auto max-md:overflow-visible">
            <NewsPostEditor
              userId={userId}
              postId={postId}
              onSave={() => {
                // Ao salvar com sucesso, fechar o editor (redirecionar para o feed)
                if (onClose) onClose();
              }}
              onDraftChange={(p: any) => setDraft({
                title: p.title,
                excerpt: p.excerpt,
                content: p.content,
                media_urls: p.media_urls,
                tags: p.tags,
                featured: p.featured,
                pinned: p.pinned,
              })}
              containerClassName="max-w-none border-none rounded-none shadow-none"
            />
          </div>
        </div>
        <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 max-md:min-h-[40vh]">
          <NewsPostPreview draft={draft} />
        </div>
      </div>
    </div>
  );
};

export default NewsPostEditorFullScreen;
