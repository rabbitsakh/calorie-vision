export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type ImageThumbWidth = 64 | 128 | 256;

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) {
    return `${basePath}/${path}`;
  }

  return `${basePath}${path}`;
}

export function getImageUrl(path: string, options?: { w?: ImageThumbWidth }): string {
  if (path.startsWith("blob:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const legacyMatch = path.match(/^\/uploads\/(.+)$/);
  let url: string;
  if (legacyMatch?.[1]) {
    const id = legacyMatch[1].replace(/\.[^.]+$/, "");
    url = withBasePath(`/api/uploads/${id}`);
  } else {
    url = withBasePath(path);
  }

  if (options?.w) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}w=${options.w}`;
  }

  return url;
}
