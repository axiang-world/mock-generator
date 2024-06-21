import { UserConfig } from '../config'
import SwaggerParser from '@apidevtools/swagger-parser'
import { handlerOpenApiV3 } from './v3'
import { handlerOpenApiV2 } from './v2'

export async function parseFile(config: UserConfig) {
    const { file, includes, excludes } = config
    const result = await SwaggerParser.parse(file)

    return 'swagger' in result
        ? handlerOpenApiV2(result, includes, excludes)
        : handlerOpenApiV3(result, includes, excludes)
}
