'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import dashboardCards from '@/data/cards';
import { newTrackingSessionId } from '@/lib/tracking/session-id';

// Map path segments to Module IDs
const getModuleIdFromPath = (path: string): { id: string, name: string } | null => {
    // Remove query params and trailing slashes for matching
    const cleanPath = path.split('?')[0].replace(/\/$/, '');

    // Check direct card matches first
    for (const card of dashboardCards) {
        if (cleanPath === card.href || cleanPath.startsWith(`${card.href}/`)) {
            return { id: card.id, name: card.title };
        }
    }

    return null;
};

export default function GlobalTimeTracker() {
    const pathname = usePathname();
    const { user, profile } = useSupabaseAuth();
    const startTimeRef = useRef<number | null>(null);
    const activeModuleRef = useRef<{ id: string, name: string } | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string>(newTrackingSessionId());
    const isVisibleRef = useRef(true);

    const sendTracking = (type: 'view' | 'heartbeat', duration: number = 0) => {
        if (!activeModuleRef.current) return;

        // Strict: only track if we have a user
        if (!user || !user.id) return;

        const data = {
            module_id: activeModuleRef.current.id,
            module_name: activeModuleRef.current.name,
            module_href: pathname,
            user_id: user.id,
            user_email: profile?.email || user.email,
            access_type: type === 'view' ? 'view' : 'heartbeat',
            is_external: false,
            session_id: sessionIdRef.current,
            duration_seconds: duration,
            referrer: document.referrer
        };

        const endpoint = type === 'view' ? '/api/tracking/module-access' : '/api/tracking/module-access';
        const method = type === 'view' ? 'POST' : 'PATCH';

        try {
            // Using fetch with keepalive for reliability
            fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                keepalive: true
            }).catch(e => console.error('Tracking error:', e));
        } catch (e) {
            console.error('Tracking exception:', e);
        }
    };

    // Handle visibility changes (tab switch)
    useEffect(() => {
        const handleVisibilityChange = () => {
            isVisibleRef.current = document.visibilityState === 'visible';
            if (!isVisibleRef.current && activeModuleRef.current && startTimeRef.current) {
                // Leaving tab: send duration so far
                const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
                if (duration > 0) {
                    sendTracking('heartbeat', duration);
                    // Reset start time to avoid double counting if they come back
                    startTimeRef.current = Date.now();
                }
            } else if (isVisibleRef.current) {
                // Coming back: reset start time
                startTimeRef.current = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user]);

    // Main tracking logic on path change
    useEffect(() => {
        if (!pathname || !user) return;

        // 1. Close previous session if exists
        if (activeModuleRef.current && startTimeRef.current) {
            const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
            if (duration > 0) {
                sendTracking('heartbeat', duration);
            }
        }

        // 2. Identify new module
        const moduleInfo = getModuleIdFromPath(pathname);

        if (moduleInfo) {
            // Start new session
            activeModuleRef.current = moduleInfo;
            startTimeRef.current = Date.now();

            // Send initial view
            sendTracking('view');

            // Start heartbeat
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                if (isVisibleRef.current && startTimeRef.current) {
                    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
                    // We send cumulative duration for the periodic update? 
                    // Or incremental? The API PATCH usually expects total duration for the session or updates it.
                    // Looking at api/tracking/module-access PATCH: it updates duration directly.
                    // So we should send TOTAL duration from start.
                    sendTracking('heartbeat', duration);
                }
            }, 5000); // 5s heartbeat (more frequent updates)
        } else {
            // Check if we are in a non-module page (like dashboard home), stop tracking
            activeModuleRef.current = null;
            startTimeRef.current = null;
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [pathname, user]);

    return null; // Headless component
}
