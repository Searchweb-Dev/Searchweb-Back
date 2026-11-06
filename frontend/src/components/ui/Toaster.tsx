'use client';

import { useToastStore } from '@/lib/store/toastStore';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} data-testid="toast"
          className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-lg text-white ${t.kind === 'error' ? 'bg-rose-600' : 'bg-gray-800'}`}>
          <span>{t.message}</span>
          <button type="button" aria-label="Close notification" onClick={() => dismiss(t.id)} className="material-symbols-outlined !text-[16px]">close</button>
        </div>
      ))}
    </div>
  );
}
