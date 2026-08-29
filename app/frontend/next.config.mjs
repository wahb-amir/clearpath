/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  typescript: {
    ignoreBuildErrors: true,
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
};

export default nextConfig;
