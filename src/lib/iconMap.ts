/**
 * Mapeamento centralizado de ícones
 * Resolve problemas de compatibilidade com React 19
 */

import {
  FiHome,
  FiUser,
  FiUsers,
  FiSettings,
  FiGrid,
  FiFileText,
  FiDollarSign,
  FiCalendar,
  FiPhone,
  FiClock,
  FiTrendingUp,
  FiBook,
  FiBookOpen,
  FiMessageSquare,
  FiFolder,
  FiMail,
  FiBarChart,
  FiBarChart2,
  FiShoppingCart,
  FiPackage,
  FiTruck,
  FiMapPin,
  FiGlobe,
  FiAward,
  FiTarget,
  FiBriefcase,
  FiClipboard,
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiHelpCircle,
  FiStar,
  FiHeart,
  FiThumbsUp,
  FiShare2,
  FiDownload,
  FiUpload,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiMinus,
  FiX,
  FiCheck,
  FiChevronRight,
  FiChevronLeft,
  FiChevronUp,
  FiChevronDown,
  FiArrowRight,
  FiArrowLeft,
  FiArrowUp,
  FiArrowDown,
  FiMenu,
  FiMoreVertical,
  FiMoreHorizontal,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiLogOut,
  FiLogIn,
  FiLock,
  FiUnlock,
  FiEye,
  FiEyeOff,
  FiBell,
  FiActivity,
  FiPieChart,
  FiTrendingDown,
  FiZap,
  FiCpu,
  FiDatabase,
  FiServer,
  FiMonitor,
  FiSmartphone,
  FiTablet,
  FiWatch,
  FiCamera,
  FiVideo,
  FiImage,
  FiMusic,
  FiHeadphones,
  FiMic,
  FiVolume2,
  FiVolumeX,
  FiWifi,
  FiWifiOff,
  FiBluetooth,
  FiBattery,
  FiBatteryCharging,
  FiPower,
  FiSun,
  FiMoon,
  FiCloud,
  FiCloudOff,
  FiCloudRain,
  FiCloudSnow,
  FiCloudLightning,
  FiDroplet,
  FiWind,
  FiCompass,
  FiNavigation,
  FiNavigation2,
  FiAnchor,
  FiFlag,
  FiBookmark,
  FiTag,
  FiHash,
  FiAtSign,
  FiPercent,
  FiSlash,
  FiCode,
  FiCommand,
  FiTerminal,
  FiGitBranch,
  FiGitCommit,
  FiGitMerge,
  FiGitPullRequest,
  FiGithub,
  FiGitlab,
  FiLink,
  FiLink2,
  FiExternalLink,
  FiCopy,
  FiSave,
  FiPrinter,
  FiScissors,
  FiPaperclip,
  FiInbox,
  FiSend,
  FiArchive,
  FiShield,
  FiShieldOff,
  FiKey,
  FiCreditCard,
  FiShoppingBag,
  FiGift,
  FiPercent as FiDiscount,
} from 'react-icons/fi';

import type { IconType } from 'react-icons';

// Mapa de nomes de ícones para componentes
export const iconMap: Record<string, IconType> = {
  // Ícones principais
  FiHome,
  FiUser,
  FiUsers,
  FiSettings,
  FiGrid,
  FiFileText,
  FiDollarSign,
  FiCalendar,
  FiPhone,
  FiClock,
  FiTrendingUp,
  FiBook,
  FiBookOpen,
  FiMessageSquare,
  FiFolder,
  FiMail,
  FiBarChart,
  FiBarChart2,
  FiShoppingCart,
  FiPackage,
  FiTruck,
  FiMapPin,
  FiGlobe,
  FiAward,
  FiTarget,
  FiBriefcase,
  FiClipboard,
  
  // Ícones de status
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiHelpCircle,
  FiStar,
  FiHeart,
  FiThumbsUp,
  
  // Ícones de ação
  FiShare2,
  FiDownload,
  FiUpload,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiMinus,
  FiX,
  FiCheck,
  
  // Navegação
  FiChevronRight,
  FiChevronLeft,
  FiChevronUp,
  FiChevronDown,
  FiArrowRight,
  FiArrowLeft,
  FiArrowUp,
  FiArrowDown,
  FiMenu,
  FiMoreVertical,
  FiMoreHorizontal,
  
  // Ferramentas
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiLogOut,
  FiLogIn,
  FiLock,
  FiUnlock,
  FiEye,
  FiEyeOff,
  FiBell,
  
  // Gráficos e dados
  FiActivity,
  FiPieChart,
  FiTrendingDown,
  FiZap,
  
  // Tecnologia
  FiCpu,
  FiDatabase,
  FiServer,
  FiMonitor,
  FiSmartphone,
  FiTablet,
  FiWatch,
  
  // Mídia
  FiCamera,
  FiVideo,
  FiImage,
  FiMusic,
  FiHeadphones,
  FiMic,
  FiVolume2,
  FiVolumeX,
  
  // Conectividade
  FiWifi,
  FiWifiOff,
  FiBluetooth,
  FiBattery,
  FiBatteryCharging,
  FiPower,
  
  // Clima
  FiSun,
  FiMoon,
  FiCloud,
  FiCloudOff,
  FiCloudRain,
  FiCloudSnow,
  FiCloudLightning,
  FiDroplet,
  FiWind,
  
  // Localização
  FiCompass,
  FiNavigation,
  FiNavigation2,
  FiAnchor,
  FiFlag,
  
  // Organização
  FiBookmark,
  FiTag,
  FiHash,
  FiAtSign,
  FiPercent,
  FiSlash,
  
  // Desenvolvimento
  FiCode,
  FiCommand,
  FiTerminal,
  FiGitBranch,
  FiGitCommit,
  FiGitMerge,
  FiGitPullRequest,
  FiGithub,
  FiGitlab,
  
  // Links e arquivos
  FiLink,
  FiLink2,
  FiExternalLink,
  FiCopy,
  FiSave,
  FiPrinter,
  FiScissors,
  FiPaperclip,
  
  // Comunicação
  FiInbox,
  FiSend,
  FiArchive,
  
  // Segurança
  FiShield,
  FiShieldOff,
  FiKey,
  
  // Comércio
  FiCreditCard,
  FiShoppingBag,
  FiGift,
};

/**
 * Obtém um componente de ícone pelo nome
 * @param iconName Nome do ícone (ex: 'FiHome', 'FiUser')
 * @returns Componente do ícone ou FiGrid como fallback
 */
export function getIconComponent(iconName: string | undefined): IconType {
  if (!iconName) return FiGrid;
  
  // Se já for um componente, retornar
  if (typeof iconName === 'function') return iconName as IconType;
  
  // Buscar no mapa
  const icon = iconMap[iconName];
  if (icon) return icon;
  
  // Fallback
  console.warn(`Ícone não encontrado: ${iconName}, usando FiGrid como fallback`);
  return FiGrid;
}

/**
 * Lista de todos os nomes de ícones disponíveis
 */
export const availableIcons = Object.keys(iconMap);

export default iconMap;
