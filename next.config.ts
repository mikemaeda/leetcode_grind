import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["commit.mikemaeda.com", "commit-accountability.mikemaeda7.chatgpt.site"],
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
