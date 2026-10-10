import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  /* config options here */
  reactStrictMode: false,
};

export default nextConfig;
