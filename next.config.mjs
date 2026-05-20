import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    qualities: [75, 85],
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
