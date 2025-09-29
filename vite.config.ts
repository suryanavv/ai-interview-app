import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize for production deployment
    sourcemap: false,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate large libraries into their own chunks for better caching
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime')) {
              return 'react-vendor';
            }
            // UI libraries (Radix UI, Tabler icons)
            if (id.includes('@radix-ui') || id.includes('@tabler') || id.includes('cmdk') || id.includes('class-variance-authority')) {
              return 'ui-vendor';
            }
            // AI libraries
            if (id.includes('ai') || id.includes('openrouter') || id.includes('@openrouter')) {
              return 'ai-vendor';
            }
            // File processing libraries
            if (id.includes('pdfjs') || id.includes('mammoth') || id.includes('react-pdf')) {
              return 'pdf-vendor';
            }
            // State management and utilities
            if (id.includes('zustand') || id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-vendor';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'form-vendor';
            }
            // Other vendor libraries
            return 'vendor';
          }
          // Separate large application chunks
          if (id.includes('components/IntervieweeTab')) {
            return 'interviewee-tab';
          }
          if (id.includes('components/InterviewerTab')) {
            return 'interviewer-tab';
          }
          if (id.includes('services/aiService')) {
            return 'ai-service';
          }
          if (id.includes('store/interviewStore')) {
            return 'interview-store';
          }
        },
      },
    },
  },
  // Optimize development server
  server: {
    // Enable HMR with better performance
    hmr: {
      overlay: false, // Disable error overlay for better performance
    },
  },
  // Ensure proper asset handling for PDF worker
  publicDir: 'public',
  assetsInclude: ['**/*.wasm'],
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@radix-ui/react-tabs',
      '@tabler/icons-react',
      'zustand',
      'date-fns'
    ],
  },
})