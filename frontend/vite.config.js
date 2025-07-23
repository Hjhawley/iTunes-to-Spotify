import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // Explicitly load env vars from the correct directory
  const env = loadEnv(mode, process.cwd(), '');

  console.log('VITE_BACKEND_URL:', env.VITE_BACKEND_URL); // <- will now work

  return {
    base: '/iTunes-to-Spotify/',
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      // Optional: make it globally replaceable if needed
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL),
    },
  };
});
