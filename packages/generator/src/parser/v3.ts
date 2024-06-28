import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { ApiList } from '../types'
import { filterPaths } from './utils'
import consola from 'consola'
import SwaggerParser from '@apidevtools/swagger-parser'

type Schemas = OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
type ComponentSchemas = Schemas | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
type Responses = OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject
// type ComponentResponses = Responses | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
type Parameters = OpenAPIV3.ParameterObject
// type ComponentParameters = Parameters | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
type Examples = OpenAPIV3.ExampleObject
// type ComponentExamples = Examples | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
type RequestBodies = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject
// type ComponentRequestBodies = RequestBodies | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject

type RefType = Schemas | Responses | Parameters | Examples | RequestBodies
type RefMap = Map<string, RefType>

enum ComponentType {
    SCHEMAS = 'schemas',
    RESPONSES = 'responses',
    PARAMETERS = 'parameters',
    EXAMPLES = 'examples',
    REQUESTBODIES = 'requestBodies',
}

export class OpenAPIV3Parser {
    private paths: OpenAPIV3.PathsObject<{}, {}> | OpenAPIV3_1.PathsObject<{}, {}>
    private components: OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject
    private filteredPathSet: Set<string> // 筛选后的路径
    private isV3_1: boolean // 是否3.1版本

    constructor(
        private readonly doc: OpenAPIV3.Document | OpenAPIV3_1.Document,
        includes: ApiList | undefined,
        excludes: ApiList | undefined,
    ) {
        const { paths, components, openapi } = doc

        this.isV3_1 = openapi.startsWith('3.1')
        this.paths = paths ?? {}
        this.components = components ?? {}
        this.filteredPathSet = filterPaths(Object.keys(this.paths), includes, excludes)

        this.start()
    }

    private start() {
        consola.info('开始解析openapi文档')

        const result = {} as OpenAPIV3.PathsObject<{}, {}> | OpenAPIV3_1.PathsObject<{}, {}>
        console.log(result)

        Object.entries(this.paths).forEach(async ([path, pathItem]) => {
            if (!pathItem || !this.filteredPathSet.has(path)) {
                return
            }

            const { $ref, parameters, ...httpMethodObj } = pathItem
            console.log(httpMethodObj, parameters)
            let ref = {} as RefType
            if ($ref) {
                ref = await this.getRef($ref)
            }
            console.log(ref)
        })
    }

    private refCache: RefMap = new Map()
    private async getRef(ref: string): Promise<RefType> {
        if (this.refCache.has(ref)) {
            return this.refCache.get(ref) as RefType
        }

        const match = ref.match(/([^#]+)#\/(.+)/)

        if (match) {
            const [, docPath, paths] = match
            const doc = await this.getRefDoc(docPath)
            console.log(paths, doc, this.isV3_1)

            const [, componentType, path] = match as [any, ComponentType, string]
            let refObj: RefType
            switch (componentType) {
                case ComponentType.SCHEMAS:
                    refObj = this.getSchemaRef(path)
                case ComponentType.REQUESTBODIES:
                    refObj = this.getRequestBodiesRef(path)
                case ComponentType.RESPONSES:
                    refObj = this.getResponseRef(path)
                case ComponentType.PARAMETERS:
                    refObj = this.getParameterRef(path)
                case ComponentType.EXAMPLES:
                    refObj = this.getExampleRef(path)
                default:
                    refObj = {}
            }
            this.refCache.set(ref, refObj)
            return refObj
        } else {
            return {}
        }
    }

    private async getRefDoc(docPath: string): Promise<OpenAPIV3.Document<{}> | OpenAPIV3_1.Document<{}>> {
        let doc = this.doc
        if (docPath) {
            try {
                const result = await SwaggerParser.parse(docPath)

                if ('openapi' in result) {
                    doc = result
                } else {
                    throw new Error('不支持引用openapi v2文档')
                }
            } catch (err) {
                consola.error(err.message)
            }
        }

        return doc
    }

    private getExampleRef(path: string) {
        console.log(path)
        return {} as RefType
    }

    private getParameterRef(path: string) {
        console.log(path)
        return {} as RefType
    }

    private getResponseRef(path: string) {
        console.log(path)
        return {} as RefType
    }

    private getRequestBodiesRef(path: string) {
        console.log(path)
        return {} as RefType
    }

    private getSchemaRef(path: string): Schemas {
        const schema = this.components.schemas?.[path]

        if (!schema) {
            return {} as Schemas
        }

        const getRef = this.getRef
        function processRecursiveSchemas(obj: ComponentSchemas): Schemas {
            if ('$ref' in obj) {
                return getRef(obj.$ref) as Schemas
            }

            const res = {} as Record<string, any>
            const arrayProperties = ['allOf', 'oneOf', 'anyOf']

            Object.entries(obj).forEach(([key, value]) => {
                if (arrayProperties.includes(key)) {
                    res[key] = (value as ComponentSchemas[]).map((item) => processRecursiveSchemas(item))
                } else if (key === 'additionalProperties') {
                    if (typeof value === 'boolean') {
                        res[key] = value
                    } else {
                        res[key] = processRecursiveSchemas(value)
                    }
                } else if (key === 'not') {
                    res[key] = processRecursiveSchemas(value)
                } else if (key === 'properties') {
                    res[key] = Object.entries(value).reduce(
                        (properties, [name, property]) => {
                            properties[name] = processRecursiveSchemas(property as ComponentSchemas)
                            return properties
                        },
                        {} as Record<string, Schemas>,
                    )
                } else {
                    res[key] = value
                }
            })

            return res as Schemas
        }

        return processRecursiveSchemas(schema)
    }
}
