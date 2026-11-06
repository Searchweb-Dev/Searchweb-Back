// v5: open right/down from the actual trigger; shift only to stay in the viewport.
export function folderMenuPosition(anchor: Pick<DOMRect, 'left' | 'bottom'>, width: number, height: number,
  viewport: { width: number; height: number }) {
  const inset = 8;
  return {
    left: Math.max(inset, Math.min(anchor.left, viewport.width - width - inset)),
    top: Math.max(inset, Math.min(anchor.bottom + 4, viewport.height - height - inset)),
  };
}
