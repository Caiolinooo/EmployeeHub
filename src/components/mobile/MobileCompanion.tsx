'use client';

import BottomSheet from './BottomSheet';
import TouchButton from './TouchButton';

type MobileCompanionProps = {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function MobileCompanion({
  defaultOpen = false,
  open,
  onOpenChange,
}: MobileCompanionProps) {
  const controlled = open !== undefined;
  const isOpen = controlled ? Boolean(open) : defaultOpen;

  return (
    <>
      <TouchButton
        aria-label="Abrir Companion"
        onClick={() => onOpenChange?.(true)}
        className="abz-m-fab z-[40] h-14 w-14 rounded-full px-0 shadow-lg"
        data-abz-mobile-companion-fab=""
      >
        IA
      </TouchButton>
      <BottomSheet
        open={isOpen}
        onClose={() => onOpenChange?.(false)}
        title="Companion ABZ"
        className="abz-m-sheet-tall"
      >
        <div className="flex h-full min-h-[320px] flex-col gap-3" data-abz-mobile-companion-sheet="">
          <p className="rounded-2xl abz-m-chip px-3 py-2 text-sm text-gray-800">
            Companion do portal. Mesma sessão e APIs do desktop quando você estiver logado.
          </p>
          <div className="mt-auto flex gap-2">
            <input
              type="text"
              readOnly
              placeholder="Pergunte ao Companion"
              className="touch-target flex-1 rounded-xl border border-gray-200 px-3 text-base"
            />
            <TouchButton className="shrink-0">Enviar</TouchButton>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
