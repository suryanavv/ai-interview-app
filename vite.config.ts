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
          // Only separate large application chunks to avoid vendor library conflicts
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