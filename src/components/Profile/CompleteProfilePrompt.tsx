"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "react-toastify";
import {
  profileNeedsCompletion,
  validateName,
  formatName
} from "@/lib/nameValidation";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

interface Props {
  reminderMinutes?: number; // default 2
}

// Simple modal component (local to this file)
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">Completar Perfil</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function CompleteProfilePrompt({ reminderMinutes = 2 }: Props) {
  const { profile, getToken, refreshProfile } = useSupabaseAuth();
  const { t } = useI18n();

  // Análise do perfil
  const profileAnalysis = useMemo(() => {
    if (!profile) return { needsCompletion: false, reasons: [], suggestions: {} };
    return profileNeedsCompletion(profile);
  }, [profile]);

  const needsProfile = profileAnalysis.needsCompletion;

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Atualizar campos quando o perfil mudar
  useEffect(() => {
    const currentFirstName = (profile?.first_name || "").trim();
    const currentLastName = (profile?.last_name || "").trim();

    setFirstName(currentFirstName);
    setLastName(currentLastName);

    // Aplicar sugestões se os nomes estiverem vazios
    if (profileAnalysis.needsCompletion && profileAnalysis.suggestions) {
      if (!currentFirstName && profileAnalysis.suggestions.firstName) {
        setFirstName(profileAnalysis.suggestions.firstName);
      }
      if (!currentLastName && profileAnalysis.suggestions.lastName) {
        setLastName(profileAnalysis.suggestions.lastName);
      }
    }
  }, [profile?.first_name, profile?.last_name, profileAnalysis]);



  const remindKey = "abz:lastProfileReminderAt";

  const scheduleReminder = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      if (needsProfile && !open) {
        const reasons = profileAnalysis.reasons.join(', ');
        toast.warning(
          t("profile.completeNameReminder", `Por favor, melhore seu perfil: ${reasons}`),
          { autoClose: 7000 }
        );
        setOpen(true);
        localStorage.setItem(remindKey, String(Date.now()));
      }
    }, Math.max(1, reminderMinutes) * 60_000);
  }, [needsProfile, open, reminderMinutes, t, profileAnalysis.reasons]);

  useEffect(() => {
    // When profile is incomplete, show once immediately and then every N minutes
    if (needsProfile) {
      const last = Number(localStorage.getItem(remindKey) || 0);
      const elapsed = Date.now() - last;
      const period = Math.max(1, reminderMinutes) * 60_000;
      if (elapsed >= period) {
        setOpen(true);
        toast.info(t("profile.missingNameTitle", "Complete seu perfil"));
        localStorage.setItem(remindKey, String(Date.now()));
      }
      scheduleReminder();
    } else {
      if (timerRef.current) clearInterval(timerRef.current as any);
      setOpen(false);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
    };
  }, [needsProfile, reminderMinutes, scheduleReminder, t]);

  // Aplicar sugestão
  const applySuggestion = (field: 'firstName' | 'lastName', suggestion: string) => {
    if (field === 'firstName') {
      setFirstName(suggestion);
    } else {
      setLastName(suggestion);
    }
  };

  const onSave = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error(t("common.notAuthorized", "Não autorizado"));
        return;
      }

      // Formatar nomes corretamente
      const formattedFirstName = formatName(firstName?.trim() || '');
      const formattedLastName = formatName(lastName?.trim() || '');

      // Validar nomes
      const firstValidation = validateName(formattedFirstName);
      const lastValidation = validateName(formattedLastName);

      if (!firstValidation.isValid) {
        toast.warning(firstValidation.message || t('components.nomeInvalido'));
        return;
      }

      if (!lastValidation.isValid) {
        toast.warning(lastValidation.message || t('components.sobrenomeInvalido'));
        return;
      }

      const body = {
        first_name: formattedFirstName,
        last_name: formattedLastName
      };

      const res = await fetch("/api/users-unified/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar perfil");
      }

      toast.success(t("profile.updateSuccess", "Perfil atualizado com sucesso! 🎉"));
      setOpen(false);
      await refreshProfile();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao salvar");
    }
  };

  if (!needsProfile) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <div className="space-y-4">
        {/* Explicação */}
        <div className="flex items-start space-x-2">
          <FiAlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700 font-medium">
              {t("profile.completeNameTitle", "Complete your profile")}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {t("profile.completeNameDesc", "Please fill in your first and last name for a better experience.")}
            </p>
          </div>
        </div>

        {/* Sugestões automáticas */}
        {(profileAnalysis.suggestions.firstName || profileAnalysis.suggestions.lastName) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center space-x-2 mb-2">
              <FiInfo className="text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Sugestões baseadas no seu email:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profileAnalysis.suggestions.firstName && (
                <button
                  onClick={() => applySuggestion('firstName', profileAnalysis.suggestions.firstName!)}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                >
                  Nome: {profileAnalysis.suggestions.firstName}
                </button>
              )}
              {profileAnalysis.suggestions.lastName && (
                <button
                  onClick={() => applySuggestion('lastName', profileAnalysis.suggestions.lastName!)}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                >
                  Sobrenome: {profileAnalysis.suggestions.lastName}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Campo Nome */}
        <div className="space-y-2">
          <label className="block text-sm text-gray-700 font-medium">
            {t("register.firstName", "First Name")} *
          </label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:border-abz-blue"
            placeholder={t("register.firstNamePlaceholder", "Your first name")}
          />
        </div>

        {/* Campo Sobrenome */}
        <div className="space-y-2">
          <label className="block text-sm text-gray-700 font-medium">
            {t("register.lastName", "Last Name")} *
          </label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:border-abz-blue"
            placeholder={t("register.lastNamePlaceholder", "Your last name")}
          />
        </div>

        {/* Botões */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t("common.later", "Remind me later")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              onClick={onSave}
              className="rounded-md bg-abz-blue px-4 py-2 font-medium text-white hover:bg-abz-blue-dark"
            >
              {t("common.save", "Save")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

