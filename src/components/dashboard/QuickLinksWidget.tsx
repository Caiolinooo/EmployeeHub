'use client';

import React from 'react';
import Link from 'next/link';
import { HiHeart, HiShoppingBag, HiDocumentText, HiClock, HiAcademicCap } from 'react-icons/hi';
import { FiEdit2 } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface QuickLinkProps {
    title: string;
    subtitle: string;
    icon: any;
    href: string;
    iconBgColor: string;
    iconColor: string;
}

function QuickLinkCard({
    title,
    subtitle,
    icon: Icon,
    href,
    iconBgColor,
    iconColor,
}: QuickLinkProps) {
    return (
        <Link
            href={href}
            className="group bg-white hover:bg-gray-50 border-0 rounded-3xl p-5 transition-all duration-300 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] flex items-center h-[100px]"
        >
            <div
                className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center mr-4 shadow-sm group-hover:scale-110 transition-transform ${iconBgColor}`}
            >
                <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div className="min-w-0">
                <h4 className="font-bold text-gray-900 text-lg mb-0.5 truncate">{title}</h4>
                <p className="text-xs text-gray-500 font-medium truncate">{subtitle}</p>
            </div>
        </Link>
    );
}

import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

export default function QuickLinksWidget() {
    const { t } = useI18n();
    const { hasPermission } = useEffectivePermissions();

    // Dynamically translated list with IDs
    const links = [
        {
            id: 'ponto',
            title: t('menu.ponto'),
            subtitle: t('dashboard.registerPoint'),
            icon: HiClock,
            href: '/ponto',
            iconBgColor: 'bg-blue-50',
            iconColor: 'text-blue-500'
        },
        {
            id: 'reembolso',
            title: t('menu.reembolso'),
            subtitle: t('dashboard.requests'),
            icon: HiShoppingBag,
            href: '/reembolso',
            iconBgColor: 'bg-orange-50',
            iconColor: 'text-orange-500'
        },
        {
            id: 'contracheque',
            title: t('menu.contracheque'),
            subtitle: t('dashboard.payslips'),
            icon: HiDocumentText,
            href: '/contracheque',
            iconBgColor: 'bg-green-50',
            iconColor: 'text-green-500'
        },
        {
            id: 'academy',
            title: t('menu.academy'),
            subtitle: t('dashboard.courses'),
            icon: HiAcademicCap,
            href: '/academy',
            iconBgColor: 'bg-purple-50',
            iconColor: 'text-purple-500'
        },
        {
            id: 'contratos',
            title: t('menu.contratos', 'Contratos e Assinaturas'),
            subtitle: t('dashboard.signDocuments', 'Assine seus documentos'),
            icon: HiDocumentText,
            href: '/contratos',
            iconBgColor: 'bg-indigo-50',
            iconColor: 'text-indigo-500'
        }
    ];

    // Filter links based on permission
    const filteredLinks = links.filter(link => hasPermission(link.id));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 text-lg">{t('dashboard.quickLinks')}</h3>
                <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-abz-blue rounded"
                    title={t('common.edit', 'Editar')}
                    aria-label={t('common.edit', 'Editar') as string}
                    onClick={() => {
                        import('react-hot-toast').then(({ default: toast }) => {
                            toast('Em breve...', { icon: '🚧' });
                        });
                    }}
                >
                    <FiEdit2 className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 flex-1">
                {filteredLinks.map((link) => (
                    <QuickLinkCard key={link.href} {...link} />
                ))}
            </div>
        </div>
    );
}
