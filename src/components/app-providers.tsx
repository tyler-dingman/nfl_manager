'use client';

import * as React from 'react';

import { ToastProvider, ToastViewport } from '@/components/ui/toast';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}
