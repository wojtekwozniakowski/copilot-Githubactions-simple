import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isCi = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isCi && repositoryName ? `/${repositoryName}/` : '/',
  build: {
    outDir: 'dist'
  }
});
