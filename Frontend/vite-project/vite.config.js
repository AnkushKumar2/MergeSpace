import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { fileURLToPath } from "node:url"


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  const env = loadEnv(mode, envDir, "")
  const runtimeEnv = globalThis.process?.env || {}
  const baseUrl = env.VITE_INSFORGE_BASE_URL || env.NEXT_PUBLIC_INSFORGE_URL || runtimeEnv.VITE_INSFORGE_BASE_URL || runtimeEnv.NEXT_PUBLIC_INSFORGE_URL
  const anonKey = env.VITE_INSFORGE_ANON_KEY || env.NEXT_PUBLIC_INSFORGE_ANON_KEY || runtimeEnv.VITE_INSFORGE_ANON_KEY || runtimeEnv.NEXT_PUBLIC_INSFORGE_ANON_KEY

  return {
    envDir,
    define: {
      "import.meta.env.VITE_INSFORGE_BASE_URL": JSON.stringify(baseUrl),
      "import.meta.env.VITE_INSFORGE_ANON_KEY": JSON.stringify(anonKey),
    },
    server: {
      port: 5173,
      proxy: {
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true,
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  }
})
