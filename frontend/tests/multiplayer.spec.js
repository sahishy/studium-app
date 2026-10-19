import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
const credentials = async () => JSON.parse(await readFile(process.env.REALTIME_TEST_CREDENTIALS || path.resolve(import.meta.dirname, '../../backend/realtime/.wrangler/local-staging-credentials.json'), 'utf8'))
const command = async (request, endpoint, body) => {
    const { baseUrl, testSecret } = await credentials()
    const response = await request.post(`${baseUrl}/__test/${endpoint}`, { headers: { Authorization: `Bearer ${testSecret}` }, data: body })
    expect(response.ok()).toBeTruthy()
    return response.json()
}
const network = (request, profile) => request.post('http://127.0.0.1:8790/__network', { data: profile })
const enter = async (page, room, index = 0) => {
    const player = room.players[index]
    await page.goto(`/tests/multiplayer.html?${new URLSearchParams({ room: room.roomId, user: player.userId, admission: player.admission, mode: room.modeId })}`)
    await expect.poll(() => page.evaluate(() => window.__netcodeTest?.metrics()?.connectionState)).toBe('ready')
    await expect.poll(() => page.evaluate(() => window.__netcodeTest.errors)).toEqual([])
}
test.beforeEach(async ({ request }) => { await network(request, { rttMs: 40, jitterMs: 0 }) })
test('two real clients render acknowledged chops and never replay disconnected presses', async ({ browser, request }) => {
    const room = await command(request, 'rooms', { modeId: 'sat-timber' })
    const first = await browser.newContext(), second = await browser.newContext()
    const a = await first.newPage(), b = await second.newPage()
    try {
        await Promise.all([enter(a, room), enter(b, room, 1)])
        await a.keyboard.press('a')
        await expect.poll(() => a.evaluate(() => window.__netcodeTest.snapshot.players[0].state.timberActualChops)).toBe(1)
        await expect.poll(() => b.evaluate(() => window.__netcodeTest.snapshot.players[0].state.timberActualChops)).toBe(1)
        await network(request, { rttMs: 120, jitterMs: 30, stallMs: 1500, disconnect: true })
        await expect.poll(() => a.evaluate(() => window.__netcodeTest.metrics().connectionState)).not.toBe('ready')
        for(let i = 0; i < 8; i++) await a.keyboard.press(i % 2 ? 'd' : 'a')
        await network(request, { rttMs: 120, jitterMs: 30 })
        await expect.poll(() => a.evaluate(() => window.__netcodeTest.metrics().connectionState), { timeout: 15_000 }).toBe('ready')
        expect(await a.evaluate(() => window.__netcodeTest.snapshot.players[0].state.timberActualChops)).toBe(1)
    } finally { await first.close(); await second.close(); await command(request, 'command', { roomId: room.roomId, command: 'dispose' }) }
})
test('Puncture renders overlapping timestamped flights and settles late receipts immediately', async ({ page }) => {
    await page.goto('/tests/multiplayer.html?mode=scene')
    await expect.poll(() => page.evaluate(() => typeof window.__netcodeTest?.fire)).toBe('function')
    const result = await page.evaluate(async () => {
        const counts = [], latencies = [], rendered = []
        let correctionPreservedNode = false
        for(let i = 0; i < 10; i++) {
            const started = performance.now()
            window.__netcodeTest.fire(i)
            await new Promise(requestAnimationFrame)
            let node = document.querySelector(`[data-shot-key="client:test-${i}"]`)
            if(!node || Number(node.getAttribute('cy')) >= 275) await new Promise(requestAnimationFrame)
            node = document.querySelector(`[data-shot-key="client:test-${i}"]`)
            rendered.push(Boolean(node && Number(node.getAttribute('cy')) < 275))
            latencies.push(performance.now() - started)
            counts.push(document.querySelectorAll('[data-shot-key]').length)
            if(i === 0) {
                window.__netcodeTest.correct(0)
                await new Promise(requestAnimationFrame)
                correctionPreservedNode = document.querySelector('[data-shot-key="client:test-0"]') === node && Number(node?.getAttribute('cy')) < 275
            }
            await new Promise((resolve) => setTimeout(resolve, Math.max(0, 50 - (performance.now() - started))))
        }
        return { counts, latencies, rendered, correctionPreservedNode }
    })
    expect(Math.max(...result.counts)).toBeGreaterThan(1)
    expect(result.rendered.every(Boolean)).toBe(true)
    expect(result.correctionPreservedNode).toBe(true)
    await expect(page.locator('[data-shot-key]')).toHaveCount(0)
    await page.evaluate(() => window.__netcodeTest.fire(99, Date.now() - 1000))
    await expect(page.locator('[data-shot-key]')).toHaveCount(0)
    expect([...result.latencies].sort((a, b) => a - b)[Math.ceil(result.latencies.length * .95) - 1]).toBeLessThanOrEqual(40)
})
test('two Puncture clients reconcile a cloud shot without replaying its expired flight', async ({ browser, request }) => {
    await network(request, { rttMs: 120, jitterMs: 30 })
    const room = await command(request, 'rooms', { modeId: 'sat-puncture' })
    const a = await browser.newPage(), b = await browser.newPage()
    try {
        await Promise.all([enter(a, room), enter(b, room, 1)])
        const local = await a.evaluate(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
            await new Promise(requestAnimationFrame)
            return document.querySelectorAll('[data-shot-key]').length
        })
        expect(local).toBe(1)
        await expect.poll(() => b.evaluate(() => window.__netcodeTest.snapshot.players[0].state.punctureShotCount)).toBe(1)
        await expect(a.locator('[data-shot-key]')).toHaveCount(0)
        await expect(b.locator('[data-shot-key]')).toHaveCount(0)
    } finally { await a.close(); await b.close(); await command(request, 'command', { roomId: room.roomId, command: 'dispose' }) }
})
test('Flutter retains the latest released direction after a connection resumes', async ({ page, request }) => {
    const room = await command(request, 'rooms', { modeId: 'sat-flutter' })
    await command(request, 'command', { roomId: room.roomId, command: 'flightWindow' })
    try {
        await enter(page, room)
        await page.keyboard.down('d')
        await expect.poll(() => page.evaluate(() => window.__netcodeTest.snapshot.players[0].state.flutterInput?.right)).toBe(true)
        await network(request, { rttMs: 120, jitterMs: 30, disconnect: true, stallMs: 1000 })
        await expect.poll(() => page.evaluate(() => window.__netcodeTest.metrics().connectionState)).not.toBe('ready')
        await page.keyboard.up('d')
        await network(request, { rttMs: 120, jitterMs: 30 })
        await expect.poll(() => page.evaluate(() => window.__netcodeTest.metrics().connectionState), { timeout: 15_000 }).toBe('ready')
        await expect.poll(() => page.evaluate(() => window.__netcodeTest.snapshot.players[0].state.flutterInput?.right)).toBe(false)
    } finally { await command(request, 'command', { roomId: room.roomId, command: 'dispose' }) }
})
test('two clients transition from questions and receive settled final results', async ({ browser, request }) => {
    const room = await command(request, 'rooms', { modeId: 'sat-timber', exercise: false })
    const a = await browser.newPage(), b = await browser.newPage()
    try {
        await Promise.all([enter(a, room), enter(b, room, 1)])
        await expect.poll(() => a.evaluate(() => window.__netcodeTest.now() >= window.__netcodeTest.snapshot.room.state.currentQuestionActiveAt), { timeout: 10_000 }).toBe(true)
        await a.evaluate(() => window.__netcodeTest.send('game.answer', { submittedResponse: 'A' }))
        await b.evaluate(() => window.__netcodeTest.send('game.answer', { submittedResponse: 'A' }))
        await expect.poll(() => a.evaluate(() => window.__netcodeTest.snapshot.room.state.phase)).toBe('timber_countdown')
        await expect.poll(() => a.evaluate(() => window.__netcodeTest.snapshot.room.state.phase), { timeout: 10_000 }).toBe('timber_active')
        await a.evaluate(() => window.__netcodeTest.send('game.leave'))
        await expect.poll(() => b.evaluate(() => window.__netcodeTest.snapshot.room.status)).toBe('finished')
        await expect.poll(() => b.evaluate(() => window.__netcodeTest.snapshot.events.some((event) => event.type === 'GAME_ENDED' && event.data.rewardsByUserId))).toBe(true)
    } finally { await a.close(); await b.close(); await command(request, 'command', { roomId: room.roomId, command: 'dispose' }) }
})
