import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import nodeResolve from '@rollup/plugin-node-resolve'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)).toString())

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    input: {
        index: resolve(__dirname, './src/index.ts'),
        cli: resolve(__dirname, './src/cli.ts'),
    },
    cache: false,
    output: {
        dir: resolve(__dirname, 'dist'),
        entryFileNames: `[name].js`,
        chunkFileNames: 'chunks/dep-[hash].js',
        exports: 'named',
        format: 'esm',
        externalLiveBindings: false,
        freeze: false,
    },
    plugins: [
        esbuild({
            tsconfig: resolve(__dirname, './tsconfig.build.json'),
        }),
        nodeResolve({ preferBuiltins: true }),
    ],
    external: [...Object.keys(pkg.devDependencies)],
})
