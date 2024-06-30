import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { ApiList } from '../types'
import { filterPaths } from './utils'
import consola from 'consola'
import SwaggerParser from '@apidevtools/swagger-parser'

type ReferenceObject = OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
type PathsObject = OpenAPIV3.PathsObject<{}, {}> | OpenAPIV3_1.PathsObject<{}, {}>
type ComponentsObject = OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject
type PathItemObject = OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject
type SchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
type SchemasOrReference = SchemaObject | ReferenceObject
type Responses = OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject
// type ComponentResponses = Responses | ReferenceObject
type Parameters = OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject
type ParametersOrReference = Parameters | ReferenceObject
type Examples = OpenAPIV3.ExampleObject
// type ComponentExamples = Examples | ReferenceObject
type RequestBodies = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject
// type ComponentRequestBodies = RequestBodies | ReferenceObject

type RefType = SchemaObject | Responses | Parameters | Examples | RequestBodies | PathItemObject
type RefMap = Map<string, RefType>

enum ComponentType {
    SCHEMAS = 'schemas',
    RESPONSES = 'responses',
    PARAMETERS = 'parameters',
    EXAMPLES = 'examples',
    REQUEST_BODIES = 'requestBodies',
}

export class OpenAPIV3Parser {
    private readonly paths: PathsObject
    private readonly filteredPathSet: Set<string> // 筛选后的路径
    private readonly isV3_1: boolean // 是否3.1版本

    constructor(
        private readonly doc: OpenAPIV3.Document | OpenAPIV3_1.Document,
        includes: ApiList | undefined,
        excludes: ApiList | undefined,
    ) {
        const { paths, openapi } = doc

        this.isV3_1 = openapi.startsWith('3.1')
        this.paths = paths ?? {}
        this.filteredPathSet = filterPaths(Object.keys(this.paths), includes, excludes)

        this.start()
    }

    private start() {
        consola.info('开始解析openapi文档')

        const result = {} as OpenAPIV3.PathsObject<{}, {}> | OpenAPIV3_1.PathsObject<{}, {}>
        console.log(result, this.isV3_1)

        Object.entries(this.paths).forEach(async ([path, pathItem]) => {
            if (!pathItem || !this.filteredPathSet.has(path)) {
                return
            }

            const finalPathItem = pathItem.$ref ? ((await this.getRef(pathItem.$ref)) as PathItemObject) : pathItem
            const { parameters, ...httpMethodObj } = finalPathItem

            const commonParameters: Parameters[] = []

            for (const item of parameters ?? []) {
                const parameter = this.handlerParameter(item)
                console.log(commonParameters, parameter, httpMethodObj)
            }
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
            const [docKey, pathItemOrComponentKey, itemKey] = paths.split('/')

            let refObj: RefType = {}

            if (docKey === 'paths') {
                refObj = {}
            } else if (docKey === 'components') {
                const components = doc.components ?? {}
                switch (pathItemOrComponentKey) {
                    case ComponentType.SCHEMAS:
                        refObj = await this.getSchemaRef(components, itemKey)
                        break
                    case ComponentType.REQUEST_BODIES:
                        refObj = this.getRequestBodiesRef(itemKey)
                        break
                    case ComponentType.RESPONSES:
                        refObj = this.getResponseRef(itemKey)
                        break
                    case ComponentType.PARAMETERS:
                        refObj = this.getParameterRef(itemKey)
                        break
                    case ComponentType.EXAMPLES:
                        refObj = this.getExampleRef(itemKey)
                        break
                    default:
                        refObj = {}
                }
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

    private async handlerParameter(parameter: ParametersOrReference): Promise<Parameters> {
        if ('$ref' in parameter) {
            return (await this.getRef(parameter.$ref)) as Parameters
        }

        const { schema, examples, content } = parameter

        const _schema = schema ? await this.handlerSchemas(schema) : undefined
        console.log(examples, content)
        return {
            ...parameter,
            schema: _schema as Parameters['schema'],
        }
    }

    private getResponseRef(path: string) {
        console.log(path)
        return {} as RefType
    }

    private getRequestBodiesRef(path: string) {
        console.log(path)
        return {} as RefType
    }

    private async getSchemaRef(components: ComponentsObject, path: string): Promise<SchemaObject> {
        const schema = components.schemas?.[path]

        if (!schema) {
            return {} as SchemaObject
        }

        return await this.handlerSchemas(schema)
    }

    async handlerSchemas(schema: SchemasOrReference): Promise<SchemaObject> {
        if ('$ref' in schema) {
            return (await this.getRef(schema.$ref)) as SchemaObject
        }

        const res = {} as Record<string, any>
        const arrayProperties = ['allOf', 'oneOf', 'anyOf']

        for (const [key, value] of Object.entries(schema)) {
            if (arrayProperties.includes(key)) {
                res[key] = (value as SchemasOrReference[]).map((item) => this.handlerSchemas(item))
            } else if (key === 'additionalProperties') {
                if (typeof value === 'boolean') {
                    res[key] = value
                } else {
                    res[key] = this.handlerSchemas(value)
                }
            } else if (key === 'not' || key === 'items') {
                res[key] = this.handlerSchemas(value)
            } else if (key === 'properties') {
                const properties = {} as Record<string, SchemaObject>

                for (const [name, property] of Object.entries(value)) {
                    properties[name] = await this.handlerSchemas(property as SchemasOrReference)
                }

                res[key] = properties
            } else {
                res[key] = value
            }
        }

        return res as SchemaObject
    }
}
