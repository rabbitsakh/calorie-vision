export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) {
    return `${basePath}/${path}`;
  }

  return `${basePath}${path}`;
}

export function getImageUrl(path: string): string {
  if (path.startsWith("blob:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const legacyMatch = path.match(/^\/uploads\/(.+)$/);
  if (legacyMatch?.[1]) {
    const id = legacyMatch[1].replace(/\.[^.]+$/, "");
    return withBasePath(`/api/uploads/${id}`);
  }

  return withBasePath(path);
}
