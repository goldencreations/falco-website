import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const falcoApiBaseUrl = process.env.FALCO_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Single source: server + client both read FALCO_API_BASE_URL from .env (see lib/falco-api.ts).
    FALCO_API_BASE_URL: falcoApiBaseUrl,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, 'node_modules/tailwindcss'),
    },
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
}

export default nextConfig
