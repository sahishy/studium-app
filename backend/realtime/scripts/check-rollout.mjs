import { readFile } from 'node:fs/promises'
const [filename, percentage = '10'] = process.argv.slice(2)
if(!filename || !['10', '50', '100'].includes(percentage)) throw new Error('Usage: node scripts/check-rollout.mjs REPORT.json 10|50|100')
const report = JSON.parse(await readFile(filename, 'utf8'))
const failures = []
if(!report.environment?.startsWith('https://')) failures.push('A deployed cloud report is required; localhost cannot establish cloud acceptance.')
if(report.completedMatches < 100) failures.push('At least 100 completed matches are required.')
if(report.transportErrors !== 0) failures.push('Transport errors must be resolved.')
if(report.p95ProcessingMs == null || report.p95ProcessingMs >= 20) failures.push('p95 processing must be below 20 ms.')
if(report.p95UpdateMs == null || report.p95RttMs == null || report.p95UpdateMs > report.p95RttMs + 75) failures.push('p95 authoritative feedback must be within measured RTT + 75 ms.')
if(!report.browserAcceptancePassed) failures.push('A passing browser acceptance run must be attached as browserAcceptancePassed=true.')
if(!report.productionBaselineCompared) failures.push('Compare against the measured production baseline before enabling any upgraded cohort.')
if(Number(percentage) > 10 && (report.cohortPercent !== Number(percentage) / (percentage === '50' ? 5 : 2) || !report.productionBaselineCompared || !report.settlementAndErrorRatesStable)) failures.push('Attach the previous production cohort report and confirm baseline, settlement and error-rate comparison before expansion.')
if(failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.info(`Acceptance evidence supports the ${percentage}% new-match cohort. Set the repository REALTIME_V4_PERCENT variable for the next Worker deployment; existing matches retain their version.`)
