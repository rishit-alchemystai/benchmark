import { AlchemystAI } from "@alchemystai/sdk"
import type { Provider, ProviderConfig, IngestOptions, IngestResult, SearchOptions } from "../../types/provider"
import type { UnifiedSession } from "../../types/unified"
import { logger } from "../../utils/logger"

export class AlchemystProvider implements Provider {
    name = "alchemyst"
    private client: AlchemystAI | null = null

    async initialize(config: ProviderConfig): Promise<void> {
        this.client = new AlchemystAI({
            apiKey: config.apiKey,
        })
        logger.info(`Initialized Alchemyst provider`)
    }

    async ingest(sessions: UnifiedSession[], options: IngestOptions): Promise<IngestResult> {
        if (!this.client) throw new Error("Provider not initialized")
        logger.debug(`AlchemystProvider.ingest starting for ${sessions.length} sessions`)

        const documentIds: string[] = []

        for (const session of sessions) {
            try {
                // console.log("Session length = ", session.messages);

                const sessionStr = JSON.stringify(session.messages)

                const formattedDate = session.metadata?.formattedDate as string
                const isoDate = session.metadata?.date as string
                const content = formattedDate
                    ? `Date: ${formattedDate}\n\nSession: ${sessionStr}`
                    : `Session: ${sessionStr}`

                const payload = {
                    documents: [
                        {
                            content: content,
                        }
                    ],
                    metadata: {
                        sessionId: session.sessionId,
                        fileName: `session-${session.sessionId}.json`,
                        fileSize: Buffer.byteLength(content),
                        fileType: "application/json",
                        lastModified: new Date().toISOString(),
                        groupname: ['benchmarking'],
                    },
                    source: "memorybench",
                    context_type: "conversation" as const,
                }

                logger.debug(`Calling AlchemystAI.v1.context.add with payload: ${JSON.stringify(payload, null, 2)}`)

                const response = await this.client.v1.context.add(payload);
                console.info(`AlchemystAI.v1.context.add response done. Response is:`, response)
                    

                const responseData = response
                // if (responseData.id) {
                //     documentIds.push(responseData.id)
                // } else if (responseData.ids && Array.isArray(responseData.ids)) {
                //     documentIds.push(...responseData.ids)
                // }}

                documentIds.push(session.sessionId);

                // logger.debug(`Successfully ingested session ${session.sessionId} to Alchemyst`)
                logger.debug(`Successfully ingested session ${session.sessionId} to Alchemyst`)
            } catch (error: any) {
                logger.error(`Alchemyst ingestion error for session ${session.sessionId}: ${error.message || String(error)}`)
                if (error.response) {
                    logger.error(`Error response: ${JSON.stringify(error.response.data, null, 2)}`)
                }
                if (error.stack) {
                    logger.debug(error.stack)
                }
                throw error
            }
        }

        return { documentIds }
    }

    async awaitIndexing(result: IngestResult, _containerTag: string): Promise<void> {
        // Alchemyst indexing is generally fast or handled at query time for context.
        // If there's a specific status check, it would go here.
        // For now, we'll assume it's ready.
        logger.debug(`Alchemyst provider: Skipping indexing wait for ${result.documentIds.length} docs`)
    }

    async search(query: string, options: SearchOptions): Promise<unknown[]> {
        if (!this.client) throw new Error("Provider not initialized")

        const response = await this.client.v1.context.search({
            query: query,
            similarity_threshold: 0.9,
            minimum_similarity_threshold: 0.4,
            scope: 'internal',
            body_metadata: {
                groupname: ['benchmarking'],
            }
        })

        // console.log("Response", response)
        console.log("Querry for search: ", query);
        console.log("Response Status", response.contexts);

        

        // Normalize Alchemyst results if necessary. 
        // Based on SDK docs, it returns an array of context items.
        return response.contexts ?? [];
    }

    async clear(containerTag: string): Promise<void> {
        if (!this.client) throw new Error("Provider not initialized")
        logger.warn(`Clear not yet fully implemented for Alchemyst in this SDK version - containerTag: ${containerTag}`)
    }
}

export default AlchemystProvider
