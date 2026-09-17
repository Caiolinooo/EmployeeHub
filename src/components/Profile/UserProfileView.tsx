import React, { useMemo } from 'react';
import { FiMail, FiPhone, FiMapPin, FiBriefcase, FiGrid, FiClock, FiCalendar } from 'react-icons/fi';
import UserAvatar from '@/components/UserAvatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useI18n } from '@/contexts/I18nContext';

interface UserProfileData {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
    position?: string;
    department?: string;
    role?: string;
    avatar?: string;
    drive_photo_url?: string;
    cover_url?: string;
    location?: string; // Optional
    bio?: string; // Optional
    created_at?: string;
    last_login?: string;
}

interface UserProfileViewProps {
    user: UserProfileData;
    isOwnProfile?: boolean;
    onEdit?: () => void;
    isLoading?: boolean;
}

export default function UserProfileView({ user, isOwnProfile, onEdit, isLoading }: UserProfileViewProps) {
    const { t } = useI18n();

    // Online Logic: Active in last 15 minutes
    // Hook ANTES do early return — hooks precisam rodar em toda render (rules-of-hooks).
    const isOnline = useMemo(() => {
        if (!user?.last_login) return false;
        try {
            const lastLogin = new Date(user.last_login).getTime();
            const now = new Date().getTime();
            const diffMinutes = (now - lastLogin) / 1000 / 60;
            return diffMinutes < 15;
        } catch (e) {
            return false;
        }
    }, [user?.last_login]);

    if (isLoading || !user) {
        return (
            <div className="w-full max-w-4xl mx-auto animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-2xl w-full"></div>
                <div className="px-8 pb-8">
                    <div className="relative -mt-16 mb-6 flex justify-between items-end">
                        <div className="w-32 h-32 bg-gray-300 rounded-full border-4 border-white"></div>
                        <div className="w-24 h-10 bg-gray-200 rounded-md"></div>
                    </div>
                    <div className="space-y-4">
                        <div className="h-8 bg-gray-200 w-1/3 rounded"></div>
                        <div className="h-4 bg-gray-200 w-1/4 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    return (
        <div className="w-full max-w-4xl mx-auto bg-white md:rounded-2xl md:shadow-xl overflow-hidden md:border border-gray-100 mb-6 md:mb-10">
            {/* Header / Cover */}
            <div className="h-28 md:h-48 relative group bg-gray-100 overflow-hidden">
                {user.cover_url ? (
                    <img
                        src={user.cover_url}
                        alt="Cover"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 relative">
                        <div className="absolute inset-0 bg-black/10"></div>
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-white/10 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 rounded-full bg-white/10 blur-3xl"></div>
                    </div>
                )}
            </div>

            <div className="px-4 md:px-8 pb-6 md:pb-8">
                {/* Avatar & Action Row */}
                <div className="relative -mt-10 sm:-mt-12 md:-mt-16 mb-4 md:mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="relative self-center md:self-auto">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg bg-white overflow-hidden p-0.5">
                            <UserAvatar
                                user={user}
                                profile={user}
                                className="w-full h-full rounded-full"
                            />
                        </div>
                        <div
                            className={`absolute bottom-1 md:bottom-2 right-1 md:right-2 w-4 h-4 md:w-5 md:h-5 border-2 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                            title={isOnline ? t('profile.online', 'Online') : t('profile.offline', 'Offline')}
                        ></div>
                    </div>

                    {isOwnProfile && onEdit && (
                        <button
                            onClick={onEdit}
                            className="w-full md:w-auto mt-3 md:mt-0 px-5 md:px-6 py-2 md:py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl md:rounded-full shadow-sm hover:shadow hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                            <span className="text-lg">✎</span>
                            {t('profile.edit', 'Editar Perfil')}
                        </button>
                    )}
                </div>

                {/* Main Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {/* Column 1: Identity */}
                    <div className="md:col-span-2 space-y-6 text-center md:text-left">
                        <div>
                            <div className="flex flex-col md:flex-row items-center md:justify-start gap-2 md:gap-3 mb-2 md:mb-1">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{fullName}</h1>
                                {isOnline && <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-green-100 text-green-700 border border-green-200 uppercase tracking-wide">{t('profile.online', 'Online')}</span>}
                            </div>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-gray-600 mb-4 px-2">
                                {user.position && (
                                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium max-w-full">
                                        <FiBriefcase className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{user.position}</span>
                                    </span>
                                )}
                                {user.department && (
                                    <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium max-w-full">
                                        <FiGrid className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{user.department}</span>
                                    </span>
                                )}
                            </div>

                            {user.bio ? (
                                <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto md:mx-0">{user.bio}</p>
                            ) : (
                                <p className="text-gray-400 italic">{t('profile.noBio', 'Nenhuma biografia adicionada.')}</p>
                            )}
                        </div>

                        {/* Contact Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pt-6 border-t border-gray-100 text-left">
                            <div className="flex items-start gap-3 p-3 md:p-4 bg-gray-50/50 md:bg-transparent rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="p-2 md:p-2.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                                    <FiMail className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Email</p>
                                    <a href={`mailto:${user.email}`} className="text-gray-900 font-medium hover:text-blue-600 block truncate" title={user.email}>
                                        {user.email}
                                    </a>
                                </div>
                            </div>

                            {user.phone_number && (
                                <div className="flex items-start gap-3 p-3 md:p-4 bg-gray-50/50 md:bg-transparent rounded-xl hover:bg-gray-50 transition-colors">
                                    <div className="p-2 md:p-2.5 bg-green-100 text-green-600 rounded-lg shrink-0">
                                        <FiPhone className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Telefone</p>
                                        <a href={`tel:${user.phone_number}`} className="text-gray-900 font-medium hover:text-blue-600 block truncate">
                                            {user.phone_number}
                                        </a>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3 p-3 md:p-4 bg-gray-50/50 md:bg-transparent rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="p-2 md:p-2.5 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                                    <FiCalendar className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{t('profile.joined', 'Entrou em')}</p>
                                    <p className="text-gray-900 font-medium block truncate">
                                        {user.created_at ? format(new Date(user.created_at), "MMMM 'de' yyyy", { locale: ptBR }) : t('profile.naoInformado', 'Não informado')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Stats / Sidebar */}
                    <div className="md:col-span-1">
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2">{t('profile.additionalInfo', 'Informações Adicionais')}</h3>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                    {t('profile.permission', 'Permissão')}
                                </span>
                                <span className="font-medium text-gray-700 capitalize">{user.role?.toLowerCase() || 'User'}</span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                    {t('profile.module', 'Módulo')}
                                </span>
                                <span className="font-medium text-gray-700">{user.department || t('profile.naoInformado', 'Não informado')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
