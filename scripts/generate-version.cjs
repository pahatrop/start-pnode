const fs = require('fs')
const path = require('path')

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
const versionContent = `export const version = "${pkg.version}"
`

const distDir = path.join(process.cwd(), 'dist')
const esmDir = path.join(distDir, 'esm')
const cjsDir = path.join(distDir, 'cjs')

// Ensure directories exist
if (!fs.existsSync(esmDir)) fs.mkdirSync(esmDir, { recursive: true })
if (!fs.existsSync(cjsDir)) fs.mkdirSync(cjsDir, { recursive: true })

// Write version files
fs.writeFileSync(path.join(esmDir, 'version.js'), versionContent)
fs.writeFileSync(path.join(cjsDir, 'version.js'), versionContent)

console.log(`✓ Generated version files for v${pkg.version}`)
