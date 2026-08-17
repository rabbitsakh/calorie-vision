const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/calorie-vision";

const nextConfig = {
  basePath,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
