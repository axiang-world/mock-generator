import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { ApiList } from '../types'
import { filterPaths } from './utils'

type ComponentsSchemas =
    | {
          [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
      }
    | Record<string, OpenAPIV3_1.SchemaObject>
type ComponentsResponses =
    | {
          [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject
      }
    | Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ResponseObject>
type ComponentsParameters =
    | {
          [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject
      }
    | Record<string, OpenAPIV3.ParameterObject | OpenAPIV3_1.ReferenceObject>
type ComponentsExamples =
    | {
          [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject
      }
    | Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3.ExampleObject>
type ComponentsRequestBodies =
    | {
          [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject
      }
    | Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.RequestBodyObject>

const ComponentRefs = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies'] as const
type ComponentRefKey = (typeof ComponentRefs)[number]
type RefMapArray = [
    Map<string, ComponentsSchemas>,
    Map<string, ComponentsResponses>,
    Map<string, ComponentsParameters>,
    Map<string, ComponentsExamples>,
    Map<string, ComponentsRequestBodies>,
]

export function handlerOpenApiV3(
    doc: OpenAPIV3.Document | OpenAPIV3_1.Document,
    includes: ApiList | undefined,
    excludes: ApiList | undefined,
) {
    const { paths, components } = doc
    const filteredPathSet = filterPaths(Object.keys(paths ?? {}), includes, excludes)
    components?.requestBodies

    const [schemasMap, responsesMap, parametersMap, examplesMap, requestBodiesMap] = ComponentRefs.map((item) =>
        getRefMap(components!, item),
    ) as RefMapArray
    console.log(schemasMap, responsesMap, parametersMap, examplesMap, requestBodiesMap)

    const pathItemMap = new Map()
    Object.entries(paths ?? {}).forEach(([path, value]) => {
        if (filteredPathSet.has(path)) {
            const pathItemObject = Object.entries(value!).reduce((obj, [method, operation]) => {
                if (method in OpenAPIV3.HttpMethods) {
                    const { parameters, requestBody, responses } = operation as OpenAPIV3.OperationObject
                    console.log(parameters, requestBody, responses)
                }

                return obj
            }, {})
            console.log(pathItemObject)
        }
    })

    return pathItemMap
}

function getRefMap<T>(components: OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject, refKey: ComponentRefKey) {
    const map = new Map<string, T>()
    Object.entries(components[refKey] ?? {}).forEach(([key, value]) => {
        map.set(`#/components/${refKey}/${key}`, value)
    })

    return map
}
