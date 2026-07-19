/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure the writing guide markdown is bundled with the AI API route in
  // production builds (it's read from disk at runtime, not imported).
  // Next.js 14 still has this behind `experimental` — it moved to the top
  // level in Next 15.
  experimental: {
    outputFileTracingIncludes: {
      "/api/ai": ["./lib/writing-guide.md"],
    },
  },
};

export default nextConfig;
