import { ApiList } from '../types'

export function filterPaths(paths: string[], includes: ApiList | undefined, excludes: ApiList | undefined) {
    if (includes?.length && excludes?.length) {
        let finalPaths = paths

        if (includes) {
            finalPaths = finalPaths.filter((apiPath) => {
                return includes.some((item) => {
                    return item instanceof RegExp ? new RegExp(item).test(apiPath) : apiPath === item
                })
            })
        }

        if (excludes) {
            finalPaths = finalPaths.filter((apiPath) => {
                return excludes.every((item) => {
                    return item instanceof RegExp ? !new RegExp(item).test(apiPath) : apiPath !== item
                })
            })
        }

        return new Set(finalPaths)
    }
    return new Set(paths)
}
