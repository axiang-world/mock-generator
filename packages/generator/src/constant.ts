export const DEFAULT_CONFIG_FILES = [
    'mock-gen.config.js',
    'mock-gen.config.mjs',
    'mock-gen.config.ts',
    'mock-gen.config.mts',
]

export enum OpenApiVersion {
    V1 = 'V1',
    V2 = 'V2',
    V3 = 'V3',
}

export const DEFAULT_CONFIG = {
    includes: [],
    excludes: [],
    typeDir: '',
}
