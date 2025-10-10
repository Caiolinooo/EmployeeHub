'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiClock, FiCheckCircle, FiAlertCircle, FiUser, FiCalendar } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import type { TipoNotificacaoAvaliacao } from '@/lib/services/notificacoes-avaliacao';
import { useI18n } from '@/contexts/I18nContext';

interface PopupData {
  id: string;
  tipo: TipoNotificacaoAvaliacao;
  dados: any;
  timestamp: string;
}

interface PopupNotificacaoAvaliacaoProps {
  usuarioId: string;
}

export default function PopupNotificacaoAvaliacao({
  const { t } = useI18n();
 usuarioId }: PopupNotificacaoAvaliacaoProps) {
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [popupAtivo, setPopupAtivo] = useState<PopupData | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Carregar popups existentes
    const carregarPopups = () => {
      try {
        const popupsArmazenados = JSON.parse(localStorage.getItem('avaliacaoPopups') || '[]');
        const popupsNaoExibidos = popupsArmazenados.filter((popup: PopupData) => {
          const exibidos = JSON.parse(localStorage.getItem('popupsExibidos') || '[]');
          return !exibidos.includes(popup.id);
        });
        setPopups(popupsNaoExibidos);
      } catch (error) {
        console.error('Erro ao carregar popups:', error);
      }
    };

    carregarPopups();

    // Listener para novos popups
    const handleNovoPopup = (event: CustomEvent) => {
      const novoPopup = event.detail as PopupData;
      setPopups(prev => [...prev, novoPopup]);
    };

    window.addEventListener('novoPopupAvaliacao', handleNovoPopup as EventListener);

    return () => {
      window.removeEventListener('novoPopupAvaliacao', handleNovoPopup as EventListener);
    };
  }, []);

  useEffect(() => {
    // Exibir próximo popup se houver
    if (popups.length > 0 && !popupAtivo) {
      const proximoPopup = popups[0];
      setPopupAtivo(proximoPopup);
      
      // Auto-fechar após 10 segundos
      setTimeout(() => {
        fecharPopup(proximoPopup.id);
      }, 10000);
    }
  }, [popups, popupAtivo]);

  const fecharPopup = (popupId: string) => {
    // Marcar como exibido
    const exibidos = JSON.parse(localStorage.getItem('popupsExibidos') || '[]');
    exibidos.push(popupId);
    localStorage.setItem('popupsExibidos', JSON.stringify(exibidos));

    // Remover da lista
    setPopups(prev => prev.filter(p => p.id !== popupId));
    setPopupAtivo(null);
  };

  const handleAcaoPopup = (popup: PopupData) => {
    switch (popup.tipo) {
      case 'periodo_iniciado':
      case 'autoavaliacao_pendente':
        router.push('/avaliacao/autoavaliacao');
        break;
      case 'autoavaliacao_recebida':
      case 'aprovacao_pendente':
        router.push('/avaliacao/aprovacoes');
        break;
      case 'avaliacao_aprovada':
      case 'avaliacao_editada':
      case 'avaliacao_finalizada':
        router.push('/avaliacao/minhas-avaliacoes');
        break;
      default:
        router.push('/avaliacao');
    }
    fecharPopup(popup.id);
  };

  const getIconePopup = (tipo: TipoNotificacaoAvaliacao) => {
    switch (tipo) {
      case 'periodo_iniciado':
        return <FiCalendar className="text-blue-500" size={24} />;
      case 'autoavaliacao_pendente':
      case 'autoavaliacao_prazo':
        return <FiClock className="text-yellow-500" size={24} />;
      case 'autoavaliacao_recebida':
      case 'aprovacao_pendente':
        return <FiUser className="text-orange-500" size={24} />;
      case 'avaliacao_aprovada':
      case 'avaliacao_finalizada':
        return <FiCheckCircle className="text-green-500" size={24} />;
      case 'avaliacao_editada':
        return <FiAlertCircle className="text-blue-500" size={24} />;
      default:
        return <FiAlertCircle className="text-gray-500" size={24} />;
    }
  };

  const getTituloPopup = (tipo: TipoNotificacaoAvaliacao) => {
    switch (tipo) {
      case 'periodo_iniciado':
        return {t('components.periodoDeAvaliacaoIniciado')};
      case 'autoavaliacao_pendente':
        return {t('components.autoavaliacaoPendente')};
      case 'autoavaliacao_prazo':
        return {t('components.prazoDeAutoavaliacao')};
      case 'autoavaliacao_recebida':
        return {t('components.autoavaliacaoRecebida')};
      case 'aprovacao_pendente':
        return {t('components.aprovacaoPendente')};
      case 'aprovacao_prazo':
        return {t('components.prazoDeAprovacao')};
      case 'avaliacao_aprovada':
        return {t('components.avaliacaoAprovada')};
      case 'avaliacao_editada':
        return {t('components.avaliacaoEditada')};
      case 'avaliacao_finalizada':
        return {t('components.avaliacaoFinalizada')};
      default:
        return {t('components.notificacaoDeAvaliacao')};
    }
  };

  const getMensagemPopup = (popup: PopupData) => {
    const { tipo, dados } = popup;
    
    switch (tipo) {
      case 'periodo_iniciado':
        return {t('components.completeSuaAutoavaliacaoAteDadosdatalimiteNewDated')}pt-BR') : 'o prazo estabelecido'}.`;
      case 'autoavaliacao_pendente':
        return {t('components.voceTemUmaAutoavaliacaoPendenteCompleteAteDadosdat')}pt-BR') : 'o prazo'}.`;
      case 'autoavaliacao_prazo':
        return {t('components.oPrazoParaSuaAutoavaliacaoEstaProximoCompleteHoje')};
      case 'autoavaliacao_recebida':
        return `${dados.funcionario_nome || {t('components.umFuncionario')}} completou sua autoavaliação e aguarda sua aprovação.`;
      case 'aprovacao_pendente':
        return {t('components.voceTemAvaliacoesPendentesDeAprovacao')};
      case 'aprovacao_prazo':
        return {t('components.oPrazoParaAprovacaoDeAvaliacoesEstaProximo')};
      case 'avaliacao_aprovada':
        return {t('components.suaAvaliacaoFoiAprovadaPorDadosgerentenome')}seu gerente'}.`;
      case 'avaliacao_editada':
        return {t('components.suaAvaliacaoFoiEditadaPorDadosgerentenome')}seu gerente'}.`;
      case 'avaliacao_finalizada':
        return {t('components.suaAvaliacaoFoiFinalizadaVocePodeVisualizalaAQualq')};
      default:
        return {t('components.voceTemUmaNovaNotificacaoSobreAvaliacao')};
    }
  };

  const getCorPopup = (tipo: TipoNotificacaoAvaliacao) => {
    switch (tipo) {
      case 'periodo_iniciado':
        return 'border-blue-500 bg-blue-50';
      case 'autoavaliacao_pendente':
      case 'autoavaliacao_prazo':
        return 'border-yellow-500 bg-yellow-50';
      case 'autoavaliacao_recebida':
      case 'aprovacao_pendente':
      case 'aprovacao_prazo':
        return 'border-orange-500 bg-orange-50';
      case 'avaliacao_aprovada':
      case 'avaliacao_finalizada':
        return 'border-green-500 bg-green-50';
      case 'avaliacao_editada':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  if (!popupAtivo) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className={`border-l-4 rounded-lg shadow-lg p-4 ${getCorPopup(popupAtivo.tipo)} animate-slide-in-right`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              {getIconePopup(popupAtivo.tipo)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {getTituloPopup(popupAtivo.tipo)}
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {getMensagemPopup(popupAtivo)}
              </p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => handleAcaoPopup(popupAtivo)}
                  className="text-xs bg-white border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 transition-colors"
                >
                  Ver Detalhes
                </button>
                <button
                  onClick={() => fecharPopup(popupAtivo.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Dispensar
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => fecharPopup(popupAtivo.id)}
            className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// CSS para animação (adicionar ao globals.css)
const styles = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
`;
