/**
 * Меню длительности отдыха: рядом с кнопкой и внутри видимого окна,
 * а не внизу длинной страницы.
 */

export function menuAnchor(opts: {
  buttonTop: number;
  buttonBottom: number;
  buttonRight: number;
  viewportHeight: number;
  viewportWidth: number;
  menuWidth: number;
  menuHeight: number;
  margin?: number;
}): { top: number; left: number } {
  const margin = opts.margin ?? 8;
  const width = Math.max(1, opts.menuWidth);
  const height = Math.max(1, opts.menuHeight);
  const viewH = Math.max(height + margin * 2, opts.viewportHeight);
  const viewW = Math.max(width + margin * 2, opts.viewportWidth);
  const spaceBelow = opts.viewportHeight - opts.buttonBottom;
  const openUp = spaceBelow < height + margin && opts.buttonTop > spaceBelow;
  const rawTop = openUp ? opts.buttonTop - height - 4 : opts.buttonBottom + 4;
  const maxTop = Math.max(margin, viewH - height - margin);
  const top = Math.min(Math.max(margin, rawTop), maxTop);
  const rawLeft = opts.buttonRight - width;
  const maxLeft = Math.max(margin, viewW - width - margin);
  const left = Math.min(Math.max(margin, rawLeft), maxLeft);
  return { top, left };
}
