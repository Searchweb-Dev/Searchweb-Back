import { create } from 'zustand';

export type ToastKind = 'error' | 'info';
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
/** 최소 전역 토스트 저장소 (Pinned 실패 알림용, 기존 토스트 인프라 부재) */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, kind = 'error') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const showToast = (message: string, kind: ToastKind = 'error') => useToastStore.getState().show(message, kind);
