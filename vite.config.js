import { defineConfig } from 'vite';
import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  return {
    // Set the base path for deployment.
    // For production builds, it reads the repository name from package.json.
    // For local development, it uses the root path '/'.
    base: command === 'build' 
      ? `/${pkg.repositoryName}/` 
      : '/',
  };
});
