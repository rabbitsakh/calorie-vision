const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  // NextAuth callbacks and API POSTs break when Next.js 308-redirects them to a trailing slash.
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
