'use client';

/**
 * Barramento Global de Ações do Portal ABZ (PortalActionBus)
 * Permite que o AI Companion / Moshi execute comandos visuais e de controle 
 * diretamente no navegador do usuário (navegação, preenchimento de inputs, 
 * abertura de modais e destaque visual de elementos).
 */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/** Keep in sync with `ACTIVE_BOARD_STORAGE_KEY` in kpi-board.ts (client-safe; no server import). */
const KPI_ACTIVE_BOARD_KEY = 'abz_kpi_active_board_id';

export type AIActionType = 
  | 'NAVIGATE'           // Navega para uma rota (ex: /ferias, /admin/users)
  | 'FILL_INPUT'         // Preenche um campo por id ou CSS selector
  | 'CLICK_ELEMENT'      // Simula clique em um botão/elemento
  | 'OPEN_MODAL'         // Notifica a UI para abrir um modal específico
  | 'HIGHLIGHT_ELEMENT'  // Destaca visualmente um elemento na tela (efeito guia)
  | 'OPEN_KPI_BOARD'     // Define quadro KPI ativo e dispara refresh em /kpi

export interface AICommandPayload {
  action: AIActionType;
  target?: string;      // Rota ex: '/ferias' ou Selector CSS ex: '#data-inicio'
  value?: unknown;      // Valor para preenchimento de input
  label?: string;       // Descrição em português falada/exibida pela IA
}

class PortalActionBus {
  private listeners: Array<(cmd: AICommandPayload) => void> = [];
  private router: AppRouterInstance | null = null;

  /**
   * Registra a instância do Next.js router para navegação SPA.
   * Deve ser chamado uma vez por um componente React com useRouter().
   */
  setRouter(router: AppRouterInstance) {
    this.router = router;
  }

  /**
   * Se inscreve para receber comandos da IA no frontend React.
   * Retorna uma função de cleanup para uso em useEffect.
   */
  subscribe(listener: (cmd: AICommandPayload) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Dispara uma ação da IA para o navegador do usuário.
   */
  dispatch(cmd: AICommandPayload) {
    if (typeof window === 'undefined') return;

    console.log('[Portal Action Bus] Executando comando da IA:', cmd);

    // 0. Abrir / definir quadro KPI ativo (antes do NAVIGATE típico)
    if (cmd.action === 'OPEN_KPI_BOARD') {
      const boardId =
        cmd.target ||
        (typeof cmd.value === 'object' && cmd.value && 'boardId' in (cmd.value as object)
          ? String((cmd.value as { boardId?: string }).boardId || '')
          : '');
      if (boardId) {
        try {
          localStorage.setItem(KPI_ACTIVE_BOARD_KEY, boardId);
        } catch { /* ignore */ }
        window.dispatchEvent(
          new CustomEvent('abz-kpi-board-open', { detail: { boardId } })
        );
      }
    }

    // 1. Navegação SPA via Next.js Router (sem full reload)
    if (cmd.action === 'NAVIGATE' && cmd.target) {
      if (this.router) {
        this.router.push(cmd.target);
      } else {
        // Fallback se o router não foi registrado
        console.warn('[Portal Action Bus] Router não registrado, usando fallback');
        window.location.href = cmd.target;
      }
    }

    // 2. Preenchimento Dinâmico de Input — compatível com React controlled components
    if (cmd.action === 'FILL_INPUT' && cmd.target && cmd.value !== undefined) {
      const inputEl = document.querySelector(cmd.target) as HTMLInputElement | HTMLTextAreaElement | null;
      if (inputEl) {
        // Usa o setter nativo para triggar o React state update corretamente
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          inputEl instanceof HTMLTextAreaElement 
            ? window.HTMLTextAreaElement.prototype 
            : window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(inputEl, String(cmd.value));
        } else {
          inputEl.value = String(cmd.value);
        }
        
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Destaca o input preenchido
        inputEl.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/50');
        setTimeout(() => inputEl.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/50'), 3000);
      }
    }

    // 3. Clique em Elemento
    if (cmd.action === 'CLICK_ELEMENT' && cmd.target) {
      const btnEl = document.querySelector(cmd.target) as HTMLElement | null;
      if (btnEl) {
        btnEl.click();
      }
    }

    // 4. Destaque Visual (Glow/Ring Effect para guiar o usuário na tela)
    if (cmd.action === 'HIGHLIGHT_ELEMENT' && cmd.target) {
      const targetEl = document.querySelector(cmd.target) as HTMLElement | null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'transition-all', 'duration-500');
        setTimeout(() => targetEl.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2'), 4000);
      }
    }

    // 5. Notifica todos os ouvintes React (Modais, Páginas locais)
    this.listeners.forEach(listener => {
      try {
        listener(cmd);
      } catch (err) {
        console.error('[Portal Action Bus] Erro ao notificar ouvinte:', err);
      }
    });
  }
}

export const portalActionBus = new PortalActionBus();
