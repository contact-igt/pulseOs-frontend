import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pulseos/ui", "@pulseos/design-tokens", "@pulseos/types", "@pulseos/api-client"],
  reactStrictMode: true,
  agentRules: false,
};

export default nextConfig;
