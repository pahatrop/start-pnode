import { defineConfig } from 'tsup'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs'
    }
  },
  banner: {
    js: `// Version: ${pkg.version}`
  },
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version)
  },
  onSuccess: 'node scripts/generate-version.cjs'
})
