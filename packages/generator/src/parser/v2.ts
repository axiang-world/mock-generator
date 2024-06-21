import { OpenAPIV2 } from 'openapi-types'
import { filterPaths } from './utils'
import { ApiList } from '../types'

export function handlerOpenApiV2(
    doc: OpenAPIV2.Document,
    includes: ApiList | undefined,
    excludes: ApiList | undefined,
) {
    const { paths, basePath } = doc
    const allPaths = basePath ? Object.keys(paths).map((item) => basePath + item) : Object.keys(paths)

    const filteredPathSet = filterPaths(allPaths, includes, excludes)
    console.log(filteredPathSet)
}
