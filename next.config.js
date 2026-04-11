/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/auctions/completed-v2",
        destination: "/auctions/completed",
        permanent: true,
      },
      {
        source: "/auctions/completed-v2/:path*",
        destination: "/auctions/completed/:path*",
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.mercdn.net',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'auctions.c.yimg.jp',
      },
    ],
  },
}

module.exports = nextConfig
