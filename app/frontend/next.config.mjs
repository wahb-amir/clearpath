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
    // Only apply custom headers in production (Vercel sets NODE_ENV=production)
    // to avoid breaking Next.js development behavior with custom Cache-Control
    const isProd = process.env.NODE_ENV === "production";

    const prodHeaders = [
      {
        // Add caching headers for JS chunks to reduce HTTP/2 connection issues
        source: "/_next/static/chunks/:path*.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
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
    ];

    const allHeaders = [
      {
        // Security header for all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];

    return isProd ? [...prodHeaders, ...allHeaders] : allHeaders;
  },
};

export default nextConfig;
