import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root has its own lockfile; pin tracing to this app to silence workspace-root inference. */
const projectRoot = dirname(fileURLToPath(import.meta.url));

/** GitHub Pages project sites serve under /<repo>, so basePath comes from the environment. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: projectRoot,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
