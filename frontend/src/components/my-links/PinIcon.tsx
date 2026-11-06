'use client';

// Approved v5 SVG only; no preview DOM patching or network fixtures.
export function PinIcon({ unpin = false }: { unpin?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    className="h-5 w-5 min-w-5 shrink-0 overflow-visible">
    <path d="m9.3 5.25 5.4 0-.9 5.4 3.6 3.6v1.8H6.6v-1.8l3.6-3.6zM12 16.05v2.7" />
    {unpin && <path d="M5.25 5.25l13.5 13.5" />}
  </svg>;
}
