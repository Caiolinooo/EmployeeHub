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
  active: boolean;
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
      const res = await fetch('/api/users', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Erro ao carregar usuarios');
      const data = await res.json();
      setUsers(data as AllUser[]);
    } catch (e: any) {
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { users, loading, error, refresh };
}

