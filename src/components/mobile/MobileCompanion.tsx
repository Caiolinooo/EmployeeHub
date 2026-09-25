'use client';

import React, { useState } from 'react';
import BottomSheet from './BottomSheet';
import TouchButton from './TouchButton';

type MobileCompanionProps = {
  defaultOpen?: boolean;
};

export default function MobileCompanion({ defaultOpen = false }: MobileCompanionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <TouchButton
        aria-label="Abrir Companion"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--mobile-nav-h,64px)+12px)] right-4 z-[60] h-14 w-14 rounded-full px-0 shadow-lg"
        data-abz-mobile-companion-fab=""
      >
        IA
      </TouchButton>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Companion ABZ" className="h-[85dvh]">
        <div className="flex h-full min-h-[320px] flex-col gap-3" data-abz-mobile-companion-sheet="">
          <div className="rounded-2xl bg-[#e8f1f8] px-3 py-2 text-sm text-gray-800">
            Olá. Sou o Companion no celular — sheet full-width, um FAB só. Mesma sessão e APIs do
            desktop quando você estiver logado.
          </div>
          <div className="mt-auto flex gap-2">
            <input
              type="text"
              readOnly
              placeholder="Pergunte ao Companion"
              className="touch-target min-h-11 flex-1 rounded-xl border border-gray-200 px-3 text-base"
            />
            <TouchButton className="shrink-0">Enviar</TouchButton>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
