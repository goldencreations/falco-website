import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
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
