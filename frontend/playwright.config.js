import { defineConfig } from '@playwright/test'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const cloud = process.env.REALTIME_TEST_TARGET
export default defineConfig({
    testDir: './tests', testMatch: '*.spec.js', workers: 1, timeout: 45_000,
    use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-swiftshader'] }, trace: 'retain-on-failure' },
    outputDir: 'test-results/multiplayer',
    webServer: [
        ...(!cloud ? [{ command: 'npm run staging:dev', cwd: path.join(root, 'backend/realtime'), url: 'http://127.0.0.1:8788/health', reuseExistingServer: !process.env.CI, timeout: 120_000 }] : []),
        { command: 'npm run staging:proxy', cwd: path.join(root, 'backend/realtime'), url: 'http://127.0.0.1:8790/__network', env: { REALTIME_TARGET: cloud || 'http://127.0.0.1:8788' }, reuseExistingServer: !process.env.CI },
        { command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort', cwd: path.join(root, 'frontend'), url: 'http://127.0.0.1:5174/tests/multiplayer.html', env: { VITE_REALTIME_HOST: '127.0.0.1:8790', VITE_USE_FIREBASE_EMULATORS: 'false', VITE_FIREBASE_API_KEY: 'AIzaSyTESTONLY0000000000000000000000000', VITE_FIREBASE_PROJECT_ID: 'studium-netcode-test', VITE_FIREBASE_AUTH_DOMAIN: 'studium-netcode-test.firebaseapp.com', VITE_FIREBASE_APP_ID: '1:123:web:test' }, reuseExistingServer: !process.env.CI },
    ],
})
