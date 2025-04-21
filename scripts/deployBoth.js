import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const distPath = path.resolve('dist')
const remote = 'origin'
const repo = 'https://github.com/sahishy/studium-app.git'

const run = (cmd) => {
    execSync(cmd, { stdio: 'inherit' })
}

const deployTo = (branch, addCNAME = false) => {
    const tempDir = path.resolve(`.deploy-temp-${branch}`)

    run(`rm -rf ${tempDir}`)
    run(`cp -r ${distPath} ${tempDir}`)

    if(addCNAME) {
        fs.writeFileSync(path.join(tempDir, 'CNAME'), 'studium-app.com')
    }

    run(`cd ${tempDir} && git init`)
    run(`cd ${tempDir} && git config user.name "github-actions"`)
    run(`cd ${tempDir} && git config user.email "github-actions@github.com"`)
    run(`cd ${tempDir} && git remote add ${remote} ${repo}`)
    run(`cd ${tempDir} && git checkout -b ${branch}`)
    run(`cd ${tempDir} && git add .`)
    run(`cd ${tempDir} && git commit -m "Deploy to ${branch}"`)
    run(`cd ${tempDir} && git push --force ${remote} ${branch}`)

    run(`rm -rf ${tempDir}`)
}

console.log('deploying to preview...')
deployTo('preview', false)

console.log('deploying to gh-pages...')
deployTo('gh-pages', true)

console.log('deployed to both preview and production')