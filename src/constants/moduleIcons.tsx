import {
    FiGrid,
    FiRss,
    FiCalendar,
    FiClock,
    FiDollarSign,
    FiFileText,
    FiTrendingUp,
    FiCheckCircle,
    FiBook,
    FiList,
    FiShield,
    FiFolder,
    FiAward,
    FiHelpCircle,
    FiShoppingCart,
    FiBarChart2,
    FiAlertCircle,
    FiMessageSquare,
    FiCompass,
    FiPhone,
    FiAlertTriangle,
    FiDatabase,
    FiActivity,
    FiClipboard,
    FiCpu,
    FiBriefcase,
    FiUsers
} from 'react-icons/fi';
import { IconType } from 'react-icons';

export const MODULE_ICONS: Record<string, IconType> = {
    // Core
    'dashboard': FiGrid,
    'noticias': FiRss,
    'calendario': FiCalendar,
    'chat': FiMessageSquare,
    'wkradar': FiActivity,
    'contatos': FiPhone,
    'integracao-erp': FiDatabase,
    'ia-assistant': FiCpu,

    // HR
    'ponto': FiClock,
    'contracheque': FiFileText,
    'reembolso': FiDollarSign,
    'kpi': FiTrendingUp,
    'avaliacao': FiBarChart2,
    'epi': FiShield,
    'ferias': FiCalendar,
    'lista-presenca': FiCheckCircle,
    'contratos': FiFileText,

    // Content
    'manual': FiBook,
    'procedimentos': FiList,
    'politicas': FiShield,
    'biblioteca': FiFolder,
    'academy': FiAward,
    'ajuda': FiAlertCircle,
    'emergencia': FiAlertTriangle,
    'guia_offshore': FiCompass,

    // Department
    'compras': FiShoppingCart,
    'poliweb': FiClipboard,
    'man-schedule': FiCalendar,
    'gestao-tripulantes': FiUsers,
    'e-social': FiBriefcase,
    'dp': FiBriefcase,
};

// Default Icon
export const DEFAULT_MODULE_ICON = FiGrid;

export const getModuleIcon = (moduleId: string): IconType => {
    return MODULE_ICONS[moduleId] || DEFAULT_MODULE_ICON;
};
