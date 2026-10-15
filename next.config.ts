import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vauffaiiibqwephxtgal.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/especies-referencia/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;