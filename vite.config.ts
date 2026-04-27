import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const getGitMetadata = () => {
  try {
    const commitCount = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const commitHash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

    return { commitCount, commitHash };
  } catch {
    return { commitCount: '0', commitHash: 'unknown' };
  }
};

const { commitCount, commitHash } = getGitMetadata();
const buildStamp = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT_COUNT__: JSON.stringify(commitCount),
    __APP_COMMIT_HASH__: JSON.stringify(commitHash),
    __APP_BUILD_STAMP__: JSON.stringify(buildStamp),
  },
});
