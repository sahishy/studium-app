import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'node_modules/.bin/wrangler')
const run = (args, input) => new Promise((resolve, reject) => {
    const child = spawn(cli, args, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (data) => { output += data; process.stdout.write(data) })
    child.stderr.on('data', (data) => process.stderr.write(data))
    if(input) child.stdin.write(input)
    child.stdin.end()
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`Wrangler exited ${code}`)))
})
await run(['whoami'])
const build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const output = await run(['deploy', '--config', 'wrangler.staging.jsonc', '--var', `BUILD_ID:${build}`])
const baseUrl = output.match(/https:\/\/studium-realtime-staging\.[a-zA-Z0-9.-]+\.workers\.dev/)?.[0]
if(!baseUrl) throw new Error('Unable to identify the staging Worker URL')
const testSecret = randomBytes(32).toString('base64url')
await run(['secret', 'bulk', '--config', 'wrangler.staging.jsonc'], JSON.stringify({ STAGING_TEST_SECRET: testSecret, GAME_ADMISSION_SECRET: randomBytes(32).toString('base64url') }))
await mkdir(resolve(root, '.wrangler'), { recursive: true })
await writeFile(resolve(root, '.wrangler/cloud-staging-credentials.json'), JSON.stringify({ baseUrl, testSecret }), { mode: 0o600 })
console.info('Staging ready; credentials saved under .wrangler. Production was not deployed.')
