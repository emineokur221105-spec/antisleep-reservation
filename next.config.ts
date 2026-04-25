import type { NextConfig } from "next";

// On GitHub Pages, the site lives at /<repo-name>/.
// Local dev: NEXT_PUBLIC_BASE_PATH unset → basePath="" → http://localhost:3000/
// CI build: workflow sets NEXT_PUBLIC_BASE_PATH=/antisleep-reservation
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
