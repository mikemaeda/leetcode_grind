import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["leetcode-grind-mikemaedas-projects.vercel.app"],
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
