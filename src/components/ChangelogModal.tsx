
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiGift, FiClock, FiCheck, FiArrowRight, FiActivity } from 'react-icons/fi';
import confetti from 'canvas-confetti';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { usePathname } from 'next/navigation';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

interface ChangelogRelease {
    version: string;
    date: string;
    majorChanges: string[];
    minorChanges: string[];
    bugFixes: string[];
    content: string;
}

interface ChangelogData {
    latest: ChangelogRelease | null;
    history: ChangelogRelease[];
}

export default function ChangelogModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<ChangelogData | null>(null);
    const [view, setView] = useState<'latest' | 'history'>('latest');
    const [isLoading, setIsLoading] = useState(true);
    const { isAuthenticated } = useSupabaseAuth();
    const { t } = useI18n();
    const pathname = usePathname();

    useEffect(() => {
        // Auth Guard: Only show if authenticated
        if (!isAuthenticated) return;

        // Path Guard: Do not show on auth pages or public pages if any
        if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) return;

        const checkVersion = async () => {
            try {
                const res = await fetch('/api/changelog');
                if (!res.ok) return;
                const json: ChangelogData = await res.json();
                setData(json);

                if (json.latest) {
                    const lastSeen = localStorage.getItem('abz_last_seen_version');
                    // Show if version is different (newer)
                    if (lastSeen !== json.latest.version) {
                        // Delay opening by 2 seconds minimum inside dashboard
                        setTimeout(() => {
                            setIsOpen(true);
                            // Trigger confetti for minor/major updates
                            if (isMajorOrMinorUpdate(json.latest!.version)) {
                                setTimeout(() => triggerConfetti(), 500);
                            }
                        }, 2000);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch changelog:', err);
            } finally {
                setIsLoading(false);
            }
        };

        checkVersion();
    }, [isAuthenticated, pathname]);

    const handleClose = () => {
        if (data?.latest) {
            localStorage.setItem('abz_last_seen_version', data.latest.version);
        }
        setIsOpen(false);
    };

    useEscapeToClose(isOpen, handleClose);

    const isMajorOrMinorUpdate = (v: string) => {
        // Simple heuristic: ends with .0 ?
        return v.endsWith('.0');
    };

    const triggerConfetti = () => {
        const end = Date.now() + 1 * 1000;
        const colors = ['#0066CC', '#00C7B7', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    if (!isOpen || !data) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        data-modal-panel=""
                        className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white shrink-0">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <FiActivity size={120} />
                            </div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <motion.div
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="flex items-center gap-2 mb-2"
                                    >
                                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium backdrop-blur-md border border-white/20 uppercase">
                                            {view === 'latest' ? t('changelog.title') : t('changelog.historyTitle')}
                                        </span>
                                        <span className="text-sm opacity-90">{data.latest?.date}</span>
                                    </motion.div>
                                    <motion.h2
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                        className="text-3xl font-bold tracking-tight"
                                    >
                                        {view === 'latest' ? `${t('changelog.version')} ${data.latest?.version}` : t('changelog.historyTitle')}
                                    </motion.h2>
                                    {view === 'latest' && (
                                        <motion.p
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                            className="text-blue-50 mt-1"
                                        >
                                            {t('changelog.newFeaturesDesc')}
                                        </motion.p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    data-modal-close=""
                                    aria-label={t('changelog.close', 'Fechar')}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
                                >
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-0">
                            {view === 'latest' && data.latest ? (
                                <ReleaseContent release={data.latest} t={t} />
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {data.history.map((release) => (
                                        <div key={release.version} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-bold text-gray-900 dark:text-white">v{release.version}</span>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                        <FiClock size={14} /> {release.date}
                                                    </span>
                                                </div>
                                                {release.version === data.latest?.version && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full font-medium">
                                                        {t('changelog.current')}
                                                    </span>
                                                )}
                                            </div>
                                            <ReleaseContent release={release} summary t={t} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
                            <button
                                onClick={() => setView(view === 'latest' ? 'history' : 'latest')}
                                className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                            >
                                {view === 'latest' ? t('changelog.viewHistory') : t('changelog.backToCurrent')}
                            </button>

                            <button
                                onClick={handleClose}
                                className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium shadow-lg shadow-gray-200 dark:shadow-none hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
                            >
                                {view === 'latest' ? t('changelog.gotIt') : t('changelog.close')} <FiArrowRight />
                            </button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function ReleaseContent({ release, summary = false, t }: { release: ChangelogRelease, summary?: boolean, t: any }) {
    // If we have parsed section lists, use them. Otherwise fallback to raw content parsing helper
    const hasStructuredData = release.majorChanges.length > 0 || release.bugFixes.length > 0 || release.minorChanges.length > 0;

    if (hasStructuredData) {
        return (
            <div className={`space-y-6 ${summary ? 'space-y-4' : 'p-6'}`}>
                {release.majorChanges.length > 0 && (
                    <Section
                        title={t('changelog.highlights')}
                        items={release.majorChanges}
                        icon={<FiGift className="text-purple-500" />}
                        bg="bg-purple-50 dark:bg-purple-900/20"
                    />
                )}
                {release.minorChanges.length > 0 && (
                    <Section
                        title={t('changelog.improvements')}
                        items={release.minorChanges}
                        icon={<FiActivity className="text-blue-500" />}
                        bg="bg-blue-50 dark:bg-blue-900/20"
                    />
                )}
                {release.bugFixes.length > 0 && (
                    <Section
                        title={t('changelog.fixes')}
                        items={release.bugFixes}
                        icon={<FiCheck className="text-green-500" />}
                        bg="bg-green-50 dark:bg-green-900/20"
                    />
                )}
            </div>
        );
    }

    // Fallback: simpler rendering of the raw content if the robust regex didn't catch specific headers
    // We strip the version title from the raw content usually
    const cleanContent = release.content.replace(/^##\s+.*$/m, '').trim();

    return (
        <div className={`prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 ${summary ? 'line-clamp-4' : 'p-6'}`}>
            <div dangerouslySetInnerHTML={{ __html: cleanContent.replace(/\n/g, '<br/>') }} />
        </div>
    );
}

function Section({ title, items, icon, bg }: { title: string, items: string[], icon: React.ReactNode, bg: string }) {
    return (
        <div className={`rounded-xl p-4 ${bg}`}>
            <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-3">
                {icon} {title}
            </h4>
            <ul className="space-y-2">
                {items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
