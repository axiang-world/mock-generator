import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { ApiList } from '../types'
import { filterPaths } from './utils'

type Schemas = OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
type Responses =
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.ResponseObject
    | OpenAPIV3_1.ReferenceObject
    | OpenAPIV3_1.ResponseObject
type Parameters = OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject | OpenAPIV3_1.ReferenceObject
type Examples = OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject | OpenAPIV3_1.ReferenceObject
type RequestBodies =
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3_1.ReferenceObject
    | OpenAPIV3_1.RequestBodyObject

type RefMap = Map<string, Schemas | Responses | Parameters | Examples | RequestBodies>

export function handlerOpenApiV3(
    doc: OpenAPIV3.Document | OpenAPIV3_1.Document,
    includes: ApiList | undefined,
    excludes: ApiList | undefined,
) {
    const { paths, components } = doc
    const filteredPathSet = filterPaths(Object.keys(paths ?? {}), includes, excludes)

    const refMap = getRefMap(components)

    const pathItemMap = new Map()
    Object.entries(paths ?? {}).forEach(([path, value]) => {
        if (filteredPathSet.has(path)) {
            const commonParameters = value?.parameters
            const pathItemObject = Object.entries(value!).reduce((obj, [method, operation]) => {
                if (method.toUpperCase() in OpenAPIV3.HttpMethods) {
                    const { parameters, requestBody, responses } = operation as OpenAPIV3.OperationObject
                    console.log(parameters, requestBody, responses)
                    obj[method] = {
                        parameters: getFullParameters(parameters, commonParameters, refMap),
                        requestBody: getFullRequestBody(requestBody, refMap),
                        responses: getFullResponse(responses, refMap),
                    }
                }

                return obj
            }, {} as any)
            console.log(pathItemObject)
        }
    })

    return pathItemMap
}

/**
 * @description 获取完整的非引用的parameters，过滤掉in值非path和query的参数
 * @param parameters - Operator对象中的parameters
 * @param commonParameters - PathItem 对象的parameters，会被Operator对象的专属parameters覆盖
 * @param refMap - 引用对象映射，这里引用到的是Components对象下的Parameters对象
 */
function getFullParameters(
    parameters: Parameters[] | undefined,
    commonParameters: Parameters[] | undefined,
    refMap: RefMap,
) {
    if (!parameters?.length && !commonParameters?.length) {
        return []
    }
    const allParameters = [...(commonParameters ?? []), ...(parameters ?? [])]

    const map = allParameters.reduce(
        (map, item) => {
            if ('$ref' in item) {
                const params = refMap.get(item.$ref) as OpenAPIV3.ParameterObject
                map[params.name] = params
            }

            return map
        },
        {} as Record<string, Parameters>,
    )

    return map
}

function getFullRequestBody(
    requestBody: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject | undefined,
    refMap: RefMap,
) {
    console.log(requestBody, refMap)
}
function getFullResponse(response: OpenAPIV3.ResponsesObject, refMap: RefMap) {
    console.log(response, refMap)
}

function getRefMap(components: OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject | undefined) {
    const ComponentRefs = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies'] as const
    const map: RefMap = new Map()

    if (components) {
        ComponentRefs.forEach((refKey) => {
            Object.entries(components[refKey] ?? {}).forEach(([key, value]) => {
                map.set(`#/components/${refKey}/${key}`, value)
            })
        })
    }

    return map
}
