"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "react-toastify";

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

  const needsProfile = useMemo(() => {
    const fn = (profile?.first_name || "").trim();
    const ln = (profile?.last_name || "").trim();
    return !fn || !ln;
  }, [profile?.first_name, profile?.last_name]);

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setFirstName((profile?.first_name || "").trim());
    setLastName((profile?.last_name || "").trim());
  }, [profile?.first_name, profile?.last_name]);

  const remindKey = "abz:lastProfileReminderAt";

  const scheduleReminder = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      if (needsProfile && !open) {
        toast.warning(
          t("profile.completeNameReminder", "Por favor, preencha seu Nome e Sobrenome."),
          { autoClose: 5000 }
        );
        setOpen(true);
        localStorage.setItem(remindKey, String(Date.now()));
      }
    }, Math.max(1, reminderMinutes) * 60_000);
  }, [needsProfile, open, reminderMinutes, t]);

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

  const onSave = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error(t("common.notAuthorized", "Não autorizado"));
        return;
      }
      const body = { first_name: firstName?.trim(), last_name: lastName?.trim() };
      if (!body.first_name || !body.last_name) {
        toast.warning(t("profile.fillNameWarning", "Informe nome e sobrenome."));
        return;
      }
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
      toast.success(t("profile.updateSuccess", "Informações atualizadas com sucesso"));
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
        <p className="text-sm text-gray-700">
          {t("profile.completeNameDesc", "Para uma melhor experiência, informe seu Nome e Sobrenome.")}
        </p>
        <div className="space-y-2">
          <label className="block text-sm text-gray-700">{t("register.firstName", "Nome")}</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-abz-blue focus:outline-none"
            placeholder={t("register.firstNamePlaceholder", "Seu nome")}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-700">{t("register.lastName", "Sobrenome")}</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-abz-blue focus:outline-none"
            placeholder={t("register.lastNamePlaceholder", "Seu sobrenome")}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-gray-700 hover:bg-gray-50">{t("common.later", "Depois")}</button>
          <button onClick={onSave} className="rounded-md bg-abz-blue px-4 py-2 font-medium text-white hover:bg-abz-blue-dark">{t("common.save", "Salvar")}</button>
        </div>
      </div>
    </Modal>
  );
}

