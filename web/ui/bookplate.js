import { byId } from "./elements.js";

export function bookcaseInscription(discovery) {
  if (!discovery) return "spine-inscription";
  return discovery.pool ? "water-inscription" : "shelf-inscription";
}

export function showInscription(element, inscription) {
  if (element.dataset.inscription === inscription) return;
  element.replaceChildren(byId(inscription).content.cloneNode(true));
  element.dataset.inscription = inscription;
}

const clamp = (n, low, high) => Math.max(low, Math.min(n, high));

export function placeBookplate(point, size, bounds, shelfHalfWidth = 0) {
  const gap = 14, { x, y } = point, { width, height } = size;
  let left = x - width / 2, top = y - height - gap;
  if (top < bounds.top) {
    const besideLeft = x - shelfHalfWidth - gap - width, besideRight = x + shelfHalfWidth + gap;
    const fitsLeft = besideLeft >= bounds.left, fitsRight = besideRight + width <= bounds.right;
    if (fitsLeft || fitsRight) {
      const useLeft = fitsLeft && (!fitsRight || x < (bounds.left + bounds.right) / 2);
      left = useLeft ? besideLeft : besideRight;
      top = y - height / 2;
    } else {
      top = y + gap;
    }
  }
  left = clamp(left, bounds.left, bounds.right - width);
  top = clamp(top, bounds.top, bounds.bottom - height);
  return { left, top, threadX: clamp(x, left + 6, left + width - 6), threadY: clamp(y, top, top + height) };
}
