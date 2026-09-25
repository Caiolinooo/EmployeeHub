'use client';

import { FiKey } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface MobileInviteCodeInputProps {
  inviteCode: string;
  setInviteCode: (code: string) => void;
  showInviteField: boolean;
  setShowInviteField: (show: boolean) => void;
}

/** Clone do convite só no login mobile. Visual igual; toggle com hit ≥ 44×44. */
export default function MobileInviteCodeInput({
  inviteCode,
  setInviteCode,
  showInviteField,
  setShowInviteField,
}: MobileInviteCodeInputProps) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowInviteField(!showInviteField)}
          className="touch-target inline-flex items-center text-sm font-medium text-abz-blue hover:text-abz-blue-dark"
          data-abz-touch="invite-toggle"
        >
          <FiKey className="mr-1" />
          {showInviteField ? t('auth.hideInviteCode') : t('auth.haveInviteCode')}
        </button>
      </div>

      {showInviteField ? (
        <div className="mt-2">
          <label htmlFor="inviteCode" className="block text-sm font-medium leading-6 text-gray-900">
            {t('auth.inviteCode')}
          </label>
          <div className="mt-1 relative">
            <input
              id="inviteCode"
              name="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={t('auth.enterInviteCode')}
              className="block w-full rounded-md border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('auth.inviteCodeHelp')}</p>
        </div>
      ) : null}
    </div>
  );
}
