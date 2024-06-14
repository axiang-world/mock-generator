import { mkdirSync, rmSync } from 'node:fs'
import { type BuildOptions, context } from 'esbuild'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import packageJSON from '../package.json'

rmSync('dist', { force: true, recursive: true })
mkdirSync('dist')

const watch = async (options: BuildOptions) => {
    const ctx = await context(options)
    await ctx.watch()
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))

watch({
    bundle: true,
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    format: 'esm',
    chunkNames: '_[name]-[hash]',
    splitting: true,
    external: [...Object.keys(packageJSON.devDependencies)],
    entryPoints: [resolve(__dirname, '../src/index.ts'), resolve(__dirname, '../src/cli.ts')],
    outdir: resolve(__dirname, '../dist'),
    plugins: [
        {
            name: 'log',
            setup(build) {
                let first = true
                build.onEnd(() => {
                    if (first) {
                        first = false
                        console.log('Watching...')
                    } else {
                        console.log('Rebuilt')
                    }
                })
            },
        },
    ],
})
