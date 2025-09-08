/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase the body size limit for API routes to handle large video uploads
  experimental: {
    // This allows larger request bodies for API routes
    serverComponentsExternalPackages: [],
  },
  
  // Configure API routes to handle large file uploads
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Increase from default 1mb to 100mb
    },
    responseLimit: false,
  },

  // Enable streaming for better performance with large files
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
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

  // Increase timeout for API routes
  serverRuntimeConfig: {
    maxDuration: 300, // 5 minutes
  },
}

module.exports = nextConfig
