import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
if (!existsSync(path.join(root, '.env.local')) || !existsSync(path.join(root, 'server/.env'))) {
  console.error('Copy .env.example to .env.local and server/.env.example to server/.env first. See docs/backend.md.')
  process.exit(1)
}
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
}
function run(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true })
  children.push(child)
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code ?? 1) })
}
run(['--env-file-if-exists=.env', 'dist/src/main.js'], path.join(root, 'server'))
run(['node_modules/vite/bin/vite.js'], root)
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
