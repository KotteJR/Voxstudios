/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for Vercel deployment with proper limits
  experimental: {
    serverComponentsExternalPackages: [],
    // Set body size limit to Vercel's maximum (4.5MB)
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  
  // Configure API routes for Vercel's serverless functions
  api: {
    bodyParser: {
      sizeLimit: '4.5mb', // Vercel's maximum payload size
    },
    responseLimit: false,
  },

  // Configure webpack to handle large files
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'sharp': 'commonjs sharp',
      });
    }
    return config;
  },

  // Vercel serverless function timeout (max 60s for hobby, 300s for pro)
  serverRuntimeConfig: {
    maxDuration: 60, // 60 seconds for Vercel hobby plan
  },
}

module.exports = nextConfig
