import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rainbow-me/rainbowkit"],
  // Pin Turbopack root to this app so Next does not pick ~/package-lock.json as the monorepo root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
