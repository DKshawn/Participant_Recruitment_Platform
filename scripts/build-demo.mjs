import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
// Override .env.local without editing it, so the static build stays independent of the API.
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, VITE_API_BASE_URL: '' },
})
process.exit(result.status ?? 1)
