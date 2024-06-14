import { dirname, isAbsolute, join, resolve } from 'node:path'
import { DEFAULT_CONFIG_FILES, DEFAULT_CONFIG } from './constant'
import { existsSync, readFileSync, unlink } from 'node:fs'
import consola from 'consola'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'

export interface UserConfig {
    /**
     * openapi json file
     * 可以是url，也可以是能被解析的路径
     */
    file: string

    /**
     * openapi 版本
     * @default v3
     */
    version?: 'v3' | 'v2' | 'v1'

    /**
     * 指定同步哪些api，如果为空则同步全部。可以是正则表达式
     * @default []
     */

    includes?: string[]

    /**
     * 指定忽略哪些api，如果为空则同步全部。可以是正则表达式
     * 如果和includes产生交集，则以excludes的优先级更高
     * @default []
     */
    excludes?: string[]

    /**
     * 是否增量同步
     * @default false
     */
    incremental?: boolean

    /**
     * 类型文件输出目录，如果为假值则不生成类型文件
     */
    typeDir?: string

    /**
     * mock文件输出目录
     */
    mockDir: string
}

export function defineConfig(config: UserConfig) {
    return config
}

export async function resolveConfig() {
    const userConfig = await loadConfigFromFile()

    return {
        ...DEFAULT_CONFIG,
        ...userConfig,
    }
}

async function loadConfigFromFile() {
    let resolvedPath = ''
    for (const filename of DEFAULT_CONFIG_FILES) {
        const filePath = resolve(process.cwd(), filename)
        if (!existsSync(filePath)) continue

        resolvedPath = filePath
        break
    }
    if (!resolvedPath) {
        consola.error('配置文件不存在')
        process.exit()
    }

    // 以下参考vite的实现
    const isEsm = isFilePathESM(resolvedPath)

    if (!isEsm) {
        consola.error('不支持commonjs，请使用esm格式的配置文件')
        process.exit()
    }

    const code = await bundleConfigFile(resolvedPath)

    return loadConfigFromBundledFile(resolvedPath, code)
}

async function loadConfigFromBundledFile(fileName: string, bundledCode: string): Promise<UserConfig> {
    // for esm, before we can register loaders without requiring users to run node
    // with --experimental-loader themselves, we have to do a hack here:
    // write it to disk, load it with native Node ESM, then delete the file.
    /**
     * 这种方法的目的是为了在 Node.js 环境中无缝地使用 ESM而不需要用户进行额外的配置。
     * 这在 Node.js 逐渐向 ESM 过渡的过程中非常有用
     * 因为它允许开发者利用 ESM 的优势，同时避免了由于 Node.js 版本差异带来的兼容性问题。
     */
    const fileBase = `${fileName}.timestamp-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const fileNameTmp = `${fileBase}.mjs`
    const fileUrl = `${pathToFileURL(fileBase)}.mjs`
    await writeFile(fileNameTmp, bundledCode)
    try {
        return (await import(fileUrl)).default
    } finally {
        unlink(fileNameTmp, () => {}) // Ignore errors
    }
}

const NODE_BUILTIN_NAMESPACE = 'node:'
const nodeBuiltins = builtinModules.filter((id) => !id.includes(':'))
export function isNodeBuiltin(id: string): boolean {
    if (id.startsWith(NODE_BUILTIN_NAMESPACE)) return true
    return nodeBuiltins.includes(id)
}

async function bundleConfigFile(fileName: string) {
    const result = await build({
        absWorkingDir: process.cwd(),
        entryPoints: [fileName],
        write: false,
        target: ['node18'],
        platform: 'node',
        bundle: true,
        format: 'esm',
        mainFields: ['main'],
        sourcemap: 'inline',
        plugins: [
            {
                name: 'externalize-deps',
                setup(build) {
                    build.onResolve({ filter: /^[^.].*/ }, async ({ path: id, kind }) => {
                        if (kind === 'entry-point' || isAbsolute(id) || isNodeBuiltin(id)) {
                            return
                        }

                        return {
                            path: id,
                            external: true,
                        }
                    })
                },
            },
        ],
    })

    return result.outputFiles[0].text
}

function isFilePathESM(filePath: string): boolean {
    if (/\.m[jt]s$/.test(filePath)) {
        return true
    } else if (/\.c[jt]s$/.test(filePath)) {
        return false
    } else {
        // check package.json for type: "module"
        try {
            const pkgPath = join(dirname(filePath), 'package.json')
            const data = JSON.parse(readFileSync(pkgPath, 'utf-8'))
            return data.type === 'module'
        } catch {
            return false
        }
    }
}
