/**
 * OAuth / messenger avatar CDNs used as `User.image` hotlinks.
 * Android WebView often fails these as <img> (hotlink / UA / referrer),
 * so we proxy or cache them same-origin.
 */

const AVATAR_HOST_SUFFIXES = [
  "googleusercontent.com",
  "ggpht.com",
  "gstatic.com",
  "avatars.yandex.net",
  "avatar.yandex.net",
  "userapi.com",
  "vkuserphoto.ru",
  "vk.com",
  "vk.me",
  "telegram.org",
  "telesco.pe",
  "t.me",
] as const;

export function isAllowedAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return AVATAR_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function isRemoteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}
