import { resolveConfig } from './config'
import { parseFile } from './parser'

async function start() {
    const config = await resolveConfig()
    const apiMap = await parseFile(config)
    console.log(apiMap)
}

start()
