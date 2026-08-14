/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Matches MAX_ATTACHMENT_BYTES in lib/blob.js — keep both in sync.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
