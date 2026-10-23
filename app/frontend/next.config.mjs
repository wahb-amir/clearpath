/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  typescript: {
    ignoreBuildErrors: true,
  },
  // Explicitly disable Turbopack (experimental) to use Webpack for all builds
  // This fixes 404/text/plain MIME issues with static chunks on Vercel
  // and the "Call retries were exceeded" build error
  turbopack: {},
  webpack: (config, { isServer, dev }) => {
    // Ensure proper MIME types for static assets
    if (!dev && !isServer) {
      config.output.charset = "utf-8";
    }
    return config;
  },
  async rewrites() {
    // If NEXT_PUBLIC_BACKEND_URL is set (e.g. Hugging Face Space), proxy it
    // so the browser treats it as a same-origin request and bypasses CORS preflight.
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Add caching headers for static assets to reduce HTTP/2 connection issues
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          // Ensure correct MIME type for JavaScript chunks
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Also add headers for the main document to help with connection reuse
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
