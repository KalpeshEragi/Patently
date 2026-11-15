import type { NextConfig } from "next";

// static export: FastAPI serves frontend/out in production (one server, one port)
const nextConfig: NextConfig = { output: "export", images: { unoptimized: true } };

export default nextConfig;
