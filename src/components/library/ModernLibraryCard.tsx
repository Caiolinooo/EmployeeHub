'use client';

import React from 'react';

import { FiX, FiUpload, FiSave, FiLayout, FiImage, FiList, FiTrash2, FiRefreshCw, FiPlus, FiLink, FiFile, FiFolder, FiVideo, FiMap, FiCalendar, FiUsers, FiBriefcase, FiClipboard, FiSearch, FiSettings, FiMessageCircle, FiBell, FiStar, FiHeart, FiShare, FiDownload, FiCheck, FiAlertCircle, FiHelpCircle, FiHome, FiGrid, FiMonitor, FiSmartphone, FiTag, FiFlag, FiAward, FiGift, FiShoppingCart, FiCreditCard, FiDollarSign, FiActivity, FiTrendingUp, FiPieChart, FiBarChart, FiShield, FiLock, FiUnlock, FiKey, FiBook, FiMoreVertical, FiPlay, FiExternalLink, FiFileText } from 'react-icons/fi';

interface LibraryItem {
    id: string;
    title: string;
    slug: string;
    description: string;
    type: 'video' | 'image' | 'pdf' | 'document' | 'text' | 'link';
    metadata: any;
}

interface ModernLibraryCardProps {
    item: LibraryItem;
    onClick: () => void;
}

export default function ModernLibraryCard({ item, onClick }: ModernLibraryCardProps) {
    // Determine icon and accent color based on type
    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'video':
                return { icon: <FiVideo className="w-5 h-5" />, color: 'bg-red-50 text-red-600', ring: 'ring-red-100', accent: '#FEF2F2' };
            case 'image':
                return { icon: <FiImage className="w-5 h-5" />, color: 'bg-indigo-50 text-indigo-600', ring: 'ring-indigo-100', accent: '#EEF2FF' };
            case 'pdf':
                return { icon: <FiFileText className="w-5 h-5" />, color: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100', accent: '#FFFBEB' };
            case 'link':
                return { icon: <FiExternalLink className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100', accent: '#ECFDF5' };
            default:
                return { icon: <FiBook className="w-5 h-5" />, color: 'bg-blue-50 text-abz-blue', ring: 'ring-blue-100', accent: '#EFF6FF' };
        }
    };

    const config = getTypeConfig(item.type);

    // Helper to get icon component
    const getIconComponent = (iconName: string) => {
        const icons: any = {
            'book': FiBook, 'file': FiFile, 'link': FiLink, 'folder': FiFolder, 'image': FiImage,
            'video': FiVideo, 'map': FiMap, 'calendar': FiCalendar, 'users': FiUsers,
            'briefcase': FiBriefcase, 'clipboard': FiClipboard, 'search': FiSearch,
            'settings': FiSettings, 'message-circle': FiMessageCircle, 'bell': FiBell,
            'star': FiStar, 'heart': FiHeart, 'share': FiShare, 'download': FiDownload,
            'upload': FiUpload, 'trash': FiTrash2, 'check': FiCheck, 'x': FiX, 'plus': FiPlus,
            'alert-circle': FiAlertCircle, 'help-circle': FiHelpCircle, 'home': FiHome,
            'grid': FiGrid, 'list': FiList, 'layout': FiLayout, 'monitor': FiMonitor,
            'smartphone': FiSmartphone, 'tag': FiTag, 'flag': FiFlag, 'award': FiAward,
            'gift': FiGift, 'shopping-cart': FiShoppingCart, 'credit-card': FiCreditCard,
            'dollar-sign': FiDollarSign, 'activity': FiActivity, 'trending-up': FiTrendingUp,
            'pie-chart': FiPieChart, 'bar-chart': FiBarChart, 'shield': FiShield,
            'lock': FiLock, 'unlock': FiUnlock, 'key': FiKey
        };
        const Icon = icons[iconName];
        return Icon ? <Icon className="w-5 h-5" /> : null;
    };

    // Override with metadata if present
    const customIcon = item.metadata?.icon ? getIconComponent(item.metadata.icon) : null;
    const finalIcon = customIcon || config.icon;

    // Override with metadata if present
    const customBg = item.metadata?.backgroundColor ? { backgroundColor: item.metadata.backgroundColor } : { backgroundColor: config.accent };
    const customText = item.metadata?.textColor ? { color: item.metadata.textColor } : {};

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col justify-between h-48 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
        >
            {/* Decorative Background Pattern */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent z-0 rounded-bl-full opacity-50 transition-opacitygroup-hover:opacity-100"></div>

            <div className="p-6 z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${config.color} ${config.ring} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        {finalIcon}
                    </div>
                    {/* Optional Status or Type Badge */}
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                        {item.type}
                    </span>
                </div>

                <div className="mt-auto">
                    <h3 className="text-lg font-bold text-slate-800 leading-tight mb-2 line-clamp-2 group-hover:text-abz-blue transition-colors">
                        {item.title}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                    </p>
                </div>
            </div>

            {/* Bottom Accent Bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${item.type === 'video' ? 'from-red-400 to-red-600' : 'from-abz-blue to-blue-400'} scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}></div>
        </div>
    );
}
