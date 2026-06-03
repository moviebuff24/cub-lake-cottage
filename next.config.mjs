/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/cub-lake-cottage',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
