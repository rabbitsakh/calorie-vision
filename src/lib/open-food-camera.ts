/**
 * Custom events: FAB / CTAs ask FoodAddPanel to open camera or text mode.
 * Dispatched on `window` so ration page stays decoupled from panel refs.
 */
export const OPEN_FOOD_CAMERA_EVENT = "cv-open-food-camera";
export const OPEN_FOOD_TEXT_EVENT = "cv-open-food-text";

function scrollToFoodPanel(): void {
  document.getElementById("food-add-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function requestOpenFoodCamera(scrollFirst = true): void {
  if (typeof window === "undefined") return;
  if (scrollFirst) {
    scrollToFoodPanel();
    window.setTimeout(() => {
      window.dispatchEvent(new Event(OPEN_FOOD_CAMERA_EVENT));
    }, 380);
    return;
  }
  window.dispatchEvent(new Event(OPEN_FOOD_CAMERA_EVENT));
}

/** Scroll to food panel and switch to text entry (not camera). */
export function requestOpenFoodText(scrollFirst = true): void {
  if (typeof window === "undefined") return;
  if (scrollFirst) {
    scrollToFoodPanel();
    window.setTimeout(() => {
      window.dispatchEvent(new Event(OPEN_FOOD_TEXT_EVENT));
    }, 280);
    return;
  }
  window.dispatchEvent(new Event(OPEN_FOOD_TEXT_EVENT));
}

/** Just scroll to the food add panel without forcing a mode. */
export function scrollToFoodAdd(): void {
  if (typeof window === "undefined") return;
  scrollToFoodPanel();
}
