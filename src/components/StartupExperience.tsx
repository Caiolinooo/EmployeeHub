'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiX, FiVolume2 } from 'react-icons/fi';

export default function StartupExperience() {
  const { isAuthenticated, isLoading, profile } = useSupabaseAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !profile) return;

    const splashEnabled = !!(profile.startup_splash_enabled && profile.startup_splash_url);
    const soundEnabled = !!(profile.startup_sound_enabled && profile.startup_sound_url);

    if (!splashEnabled && !soundEnabled) return;

    // Check if already played in this browser session
    const sessionKey = `startup_exp_${profile.id || 'default'}`;
    const alreadyShown = sessionStorage.getItem(sessionKey);
    if (alreadyShown) return;

    sessionStorage.setItem(sessionKey, 'true');

    // Play startup sound if enabled
    if (soundEnabled && profile.startup_sound_url) {
      try {
        const audio = new Audio(profile.startup_sound_url);
        audio.volume = 0.75;
        audioRef.current = audio;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log('🔇 Startup audio autoplay prevented by browser policy:', err);
            // Allow retry on next user interaction
            const handleFirstInteraction = () => {
              audio.play().catch(() => {});
              window.removeEventListener('click', handleFirstInteraction);
              window.removeEventListener('touchstart', handleFirstInteraction);
            };
            window.addEventListener('click', handleFirstInteraction, { once: true });
            window.addEventListener('touchstart', handleFirstInteraction, { once: true });
          });
        }
      } catch (err) {
        console.warn('Erro ao inicializar som de startup:', err);
      }
    }

    // Show splash screen if enabled
    if (splashEnabled) {
      setShowSplash(true);
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setShowSplash(false);
          setIsFadingOut(false);
        }, 500); // 500ms fade-out transition
      }, 2600); // 2.6s visible duration

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, profile]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setShowSplash(false);
      setIsFadingOut(false);
    }, 300);
  };

  if (!showSplash || !profile?.startup_splash_url) {
    return null;
  }

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer transition-opacity duration-500 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative max-w-lg w-[90%] max-h-[85vh] flex flex-col items-center justify-center p-4">
        {/* Close hint button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="absolute -top-3 -right-3 md:top-2 md:right-2 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition backdrop-blur-sm shadow-lg z-10"
          title="Fechar"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Splash Image */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/40 max-h-[75vh] flex items-center justify-center animate-in fade-in zoom-in-95 duration-500">
          <img
            src={profile.startup_splash_url}
            alt="Startup Splash"
            className="max-h-[70vh] w-auto object-contain rounded-xl"
          />
        </div>

        {/* Brand / indicator footer */}
        <div className="mt-4 flex items-center gap-2 text-white/70 text-xs font-medium tracking-wide">
          <span>Portal ABZ</span>
          <span className="text-white/40">•</span>
          <span>Toque para avançar</span>
        </div>
      </div>
    </div>
  );
}
