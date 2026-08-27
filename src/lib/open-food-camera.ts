/**
 * Custom event: FAB / CTAs ask FoodAddPanel to open the camera.
 * Dispatched on `window` so ration page stays decoupled from panel refs.
 */
export const OPEN_FOOD_CAMERA_EVENT = "cv-open-food-camera";

export function requestOpenFoodCamera(scrollFirst = true): void {
  if (typeof window === "undefined") return;
  if (scrollFirst) {
    document.getElementById("food-add-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => {
      window.dispatchEvent(new Event(OPEN_FOOD_CAMERA_EVENT));
    }, 380);
    return;
  }
  window.dispatchEvent(new Event(OPEN_FOOD_CAMERA_EVENT));
}
