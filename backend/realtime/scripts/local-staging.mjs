import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directory = await mkdtemp(resolve(tmpdir(), 'studium-realtime-'))
const config = JSON.parse(await readFile(resolve(root, 'wrangler.staging.jsonc'), 'utf8'))
config.main = resolve(root, 'src/index.ts')
const testSecret = randomBytes(32).toString('base64url'), admission = randomBytes(32).toString('base64url')
await writeFile(resolve(directory, 'wrangler.jsonc'), JSON.stringify(config))
await writeFile(resolve(directory, '.dev.vars'), `STAGING_TEST_SECRET=${testSecret}\nGAME_ADMISSION_SECRET=${admission}\n`, { mode: 0o600 })
await mkdir(resolve(root, '.wrangler'), { recursive: true })
await writeFile(resolve(root, '.wrangler/local-staging-credentials.json'), JSON.stringify({ baseUrl: 'http://127.0.0.1:8788', testSecret }), { mode: 0o600 })
const child = spawn(resolve(root, 'node_modules/.bin/wrangler'), ['dev', '--config', resolve(directory, 'wrangler.jsonc'), '--port', '8788', '--inspector-port', '9238', '--persist-to', resolve(root, '.wrangler/staging-state'), '--log-level', 'warn'], { cwd: root, stdio: 'inherit' })
const cleanup = async () => { child.kill('SIGTERM'); await rm(directory, { recursive: true, force: true }); }
process.on('SIGTERM', cleanup); process.on('SIGINT', cleanup)
child.on('exit', async (code) => { await rm(directory, { recursive: true, force: true }); process.exit(code ?? 0) })
console.info('Isolated staging fixtures: http://127.0.0.1:8788; local credentials saved under .wrangler (not printed).')
