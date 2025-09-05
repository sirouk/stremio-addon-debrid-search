// Debrid clients factory - Cloudflare Workers compatible

import { RealDebridClient } from './real-debrid.js'
import { AllDebridClient } from './all-debrid.js'

// Create debrid client based on provider
export function createDebridClient(provider, apiKey) {
    switch (provider.toLowerCase()) {
        case 'realdebrid':
        case 'real-debrid':
            return new RealDebridClient(apiKey)

        case 'alldebrid':
        case 'all-debrid':
            return new AllDebridClient(apiKey)

        // TODO: Add other providers
        case 'premiumize':
            throw new Error('Premiumize support coming soon')

        case 'torbox':
            throw new Error('TorBox support coming soon')

        case 'debridlink':
        case 'debrid-link':
            throw new Error('Debrid-Link support coming soon')

        default:
            throw new Error(`Unsupported debrid provider: ${provider}`)
    }
}

// Get streams from any debrid provider
export async function getDebridStreams(config, type, imdbId, extraData = {}) {
    try {
        const { debridProvider, apiKey, maxResults = 10 } = config

        if (!apiKey) {
            throw new Error('API key is required')
        }

        const client = createDebridClient(debridProvider, apiKey)
        const results = await client.searchByImdb(imdbId)

        // Convert results to Stremio streams
        const streams = results
            .slice(0, maxResults)
            .map(item => client.formatAsStream(item))

        // If no streams found, return helpful message
        if (streams.length === 0) {
            return [{
                name: `📁 No content found in ${debridProvider}`,
                description: `No files found for this title in your ${debridProvider} account. Add content to your debrid account first.`,
                externalUrl: "https://x.stremio-addon-debrid-search.pages.dev/configure",
                behaviorHints: { notWebReady: true }
            }]
        }

        return streams

    } catch (error) {
        console.error('Get debrid streams error:', error)
        return [{
            name: `❌ API Error: ${error.message}`,
            description: `Failed to connect to ${config.debridProvider || 'debrid provider'}. Check your API key.`,
            externalUrl: "https://x.stremio-addon-debrid-search.pages.dev/configure",
            behaviorHints: { notWebReady: true }
        }]
    }
}

// Resolve debrid URL
export async function resolveDebridUrl(provider, apiKey, id, hostUrl, clientIp) {
    try {
        const client = createDebridClient(provider, apiKey)

        // For direct links, return as-is
        if (hostUrl !== '#' && hostUrl.startsWith('http')) {
            return hostUrl
        }

        // For torrents/magnets, resolve to direct link
        if (client.resolveTorrent) {
            const resolved = await client.resolveTorrent(id, 0)
            if (resolved) {
                return resolved
            }
        }

        if (client.resolveMagnet) {
            const resolved = await client.resolveMagnet(id, 0)
            if (resolved) {
                return resolved
            }
        }

        throw new Error('Unable to resolve URL')

    } catch (error) {
        console.error('Resolve debrid URL error:', error)
        throw error
    }
}
