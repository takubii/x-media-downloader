const MIN_IMAGE_SIZE = 80;
const IMAGE_VISIBILITY_INSET = 16;
const MEDIA_HOST = "pbs.twimg.com";
const MAX_VISIBLE_ANCESTOR_DEPTH = 4;

export function getEligibleImage(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof HTMLImageElement)) {
    return null;
  }

  if (!isXImageUrl(target.currentSrc || target.src)) {
    return null;
  }

  const rect = target.getBoundingClientRect();

  if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) {
    return null;
  }

  return target;
}

function isXImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === MEDIA_HOST && url.pathname.includes("/media/");
  } catch {
    return false;
  }
}

export function getVisibleImageRect(image: HTMLImageElement): DOMRect | null {
  if (!image.isConnected || !isXImageUrl(image.currentSrc || image.src)) {
    return null;
  }

  const rect = image.getBoundingClientRect();

  if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) {
    return null;
  }

  if (
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > window.innerHeight ||
    rect.right > window.innerWidth
  ) {
    return null;
  }

  if (!isElementUncovered(image, rect)) {
    return null;
  }

  return rect;
}

export function isPointInsideRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isElementUncovered(element: Element, rect: DOMRect): boolean {
  const inset = Math.min(IMAGE_VISIBILITY_INSET, rect.width / 2, rect.height / 2);
  const horizontalCenter = rect.left + rect.width / 2;
  const verticalCenter = rect.top + rect.height / 2;

  const points = [
    { x: horizontalCenter, y: rect.top + inset },
    { x: horizontalCenter, y: rect.bottom - inset },
    { x: rect.left + inset, y: verticalCenter },
    { x: rect.right - inset, y: verticalCenter },
    { x: horizontalCenter, y: verticalCenter },
  ];

  return points.every((point) => isElementPointVisible(element, point.x, point.y));
}

function isElementPointVisible(target: Element, x: number, y: number): boolean {
  const elementAtPoint = document.elementFromPoint(x, y);

  if (!elementAtPoint) {
    return false;
  }

  if (elementAtPoint === target || target.contains(elementAtPoint)) {
    return true;
  }

  return isCloseAncestor(elementAtPoint, target);
}

function isCloseAncestor(element: Element, target: Element): boolean {
  let parent = target.parentElement;
  let depth = 0;

  while (parent && depth < MAX_VISIBLE_ANCESTOR_DEPTH) {
    if (parent === element) {
      return true;
    }

    parent = parent.parentElement;
    depth += 1;
  }

  return false;
}
