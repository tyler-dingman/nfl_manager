'use client';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { ComponentProps } from 'react';
export function FilterBottomSheet(props: ComponentProps<typeof BottomSheet>) {
  return <BottomSheet closeLabel="Close filters" {...props} />;
}
