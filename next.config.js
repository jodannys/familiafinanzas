/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    'http://192.168.0.105:3000',
    'http://localhost:3000'
  ],
}

module.exports = nextConfig

