import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ditch/types"],
};

export default nextConfig;
