'use client';

import MainLayout from '@/components/Layout/MainLayout';

export default function RecrutamentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
