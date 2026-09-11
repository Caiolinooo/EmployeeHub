"use client";
import { useEffect, useState, useCallback } from "react";

export interface AllUser {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber: string;
  role: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string;
  department?: string;
  sector_id?: string;
  active: boolean;
  startup_splash_enabled?: boolean;
  startup_splash_url?: string;
  startup_sound_enabled?: boolean;
  startup_sound_url?: string;
  accessPermissions?: any;
  createdAt: string;
  updatedAt: string;
}

export function useAllUsers() {
  const [users, setUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      const res = await fetch(`/api/users?_=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Erro ao carregar usuarios');
      const data = await res.json();
      setUsers(data as AllUser[]);
      return data as AllUser[];
    } catch (e: any) {
      setError(e?.message || 'Erro desconhecido');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { users, setUsers, loading, error, refresh };
}

