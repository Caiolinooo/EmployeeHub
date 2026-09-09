import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface EffectivePermissions {
    user_id: string;
    role: string;
    effective_modules: Record<string, boolean>;
    effective_features?: Record<string, boolean>;
    acl_permission_names?: string[];
    effective_cards: string[];
    sector_id?: string | null;
    _sources?: any;
}

export function useEffectivePermissions() {
    const { user, profile } = useSupabaseAuth();
    const [permissions, setPermissions] = useState<EffectivePermissions | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Cache key maps to user ID - Version 6 includes effective_features / ACL names
    const cacheKey = user ? `permissions-v6-${user.id}` : null;

    const fetchPermissions = useCallback(async (force = false) => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        // Cache check
        const cached = sessionStorage.getItem(cacheKey || '');
        if (!force && cached) {
            try {
                const parsed = JSON.parse(cached);
                setPermissions(parsed);
                setIsLoading(false);
                return;
            } catch (e) {
                console.error('Error parsing cached permissions', e);
            }
        }

        try {
            console.log('🔍 [useEffectivePermissions] Fetching permissions for user:', user.id);
            const res = await fetch('/api/user/effective-permissions', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                console.log('✅ [useEffectivePermissions] Permissions received:', {
                    user_id: data.user_id,
                    role: data.role,
                    sector_id: data.sector_id,
                    effective_modules: data.effective_modules,
                    effective_modules_count: Object.keys(data.effective_modules || {}).length,
                    _debug: data._debug
                });
                setPermissions(data);
                if (cacheKey) {
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));
                }
            } else {
                console.error('❌ [useEffectivePermissions] Failed to fetch permissions:', res.status, res.statusText);
            }
        } catch (error) {
            console.error('❌ [useEffectivePermissions] Error fetching permissions', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, cacheKey]);

    useEffect(() => {
        fetchPermissions();

        // Listen for global permission updates
        const handleUpdate = () => {
            console.log('🔄 Permission update event detected, clearing cache and refreshing...');
            // Clear sessionStorage cache to force fresh fetch
            if (cacheKey) {
                sessionStorage.removeItem(cacheKey);
                console.log('🗑️ [useEffectivePermissions] Cache cleared for key:', cacheKey);
            }
            fetchPermissions(true);
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('permissions-updated', handleUpdate);
            window.addEventListener('visibilitychange', handleUpdate);
            window.addEventListener('focus', handleUpdate);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('permissions-updated', handleUpdate);
                window.removeEventListener('visibilitychange', handleUpdate);
                window.removeEventListener('focus', handleUpdate);
            }
        };
    }, [fetchPermissions, cacheKey]);

    const hasPermission = useCallback((moduleId: string): boolean => {
        if (!permissions) return true; // Default to true while loading (fail open)

        // ADMIN always has full access - bypass all checks
        if (permissions.role === 'ADMIN') {
            return true;
        }

        // Trust the API's effective_modules calculation
        // The API already handles: Sector (base) -> Role Override -> User Override
        const hasAccess = permissions.effective_modules && permissions.effective_modules[moduleId] === true;

        // Debug log for specific modules
        if (['academy', 'biblioteca', 'avaliacao', 'ajuda'].includes(moduleId)) {
            console.log(`🔐 [hasPermission] Module: ${moduleId}, HasAccess: ${hasAccess}, InEffectiveModules: ${moduleId in (permissions.effective_modules || {})}`);
        }

        return hasAccess;
    }, [permissions]);

    return {
        permissions,
        loading: isLoading,
        isLoading,
        hasPermission,
        isAdmin: permissions?.role === 'ADMIN',
        isManager: permissions?.role === 'MANAGER',
        refresh: useCallback(() => fetchPermissions(true), [fetchPermissions])
    };
}
