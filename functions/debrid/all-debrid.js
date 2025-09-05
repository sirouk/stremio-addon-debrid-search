// All-Debrid API client - Cloudflare Workers compatible
// Using only fetch() and Web APIs

const AD_API_BASE = 'https://api.alldebrid.com/v4'

export class AllDebridClient {
    constructor(apiKey) {
        this.apiKey = apiKey
    }

    async makeRequest(endpoint, options = {}) {
        const url = new URL(`${AD_API_BASE}${endpoint}`)
        url.searchParams.set('agent', 'stremio')
        url.searchParams.set('apikey', this.apiKey)

        // Add additional params
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                url.searchParams.set(key, value)
            }
        }

        const response = await fetch(url.toString(), {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body
        })

        if (!response.ok) {
            throw new Error(`All-Debrid API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (data.status !== 'success') {
            throw new Error(`All-Debrid API error: ${data.error?.message || 'Unknown error'}`)
        }

        return data.data
    }

    // Get user magnets
    async getMagnets() {
        try {
            return await this.makeRequest('/magnet/status')
        } catch (error) {
            console.error('AD getMagnets error:', error)
            return { magnets: [] }
        }
    }

    // Get user links
    async getLinks() {
        try {
            return await this.makeRequest('/link/history', {
                params: { limit: 100 }
            })
        } catch (error) {
            console.error('AD getLinks error:', error)
            return { links: [] }
        }
    }

    // Search magnets and links for IMDB ID
    async searchByImdb(imdbId) {
        try {
            const [magnets, links] = await Promise.all([
                this.getMagnets(),
                this.getLinks()
            ])

            const results = []

            // Search magnets
            if (magnets.magnets) {
                for (const magnet of magnets.magnets) {
                    if (magnet.filename && this.matchesImdb(magnet.filename, imdbId)) {
                        results.push({
                            type: 'magnet',
                            name: magnet.filename,
                            id: magnet.id,
                            size: magnet.size,
                            files: magnet.links || []
                        })
                    }
                }
            }

            // Search links
            if (links.links) {
                for (const link of links.links) {
                    if (link.filename && this.matchesImdb(link.filename, imdbId)) {
                        results.push({
                            type: 'link',
                            name: link.filename,
                            id: link.id,
                            size: link.size,
                            link: link.link
                        })
                    }
                }
            }

            return results
        } catch (error) {
            console.error('AD searchByImdb error:', error)
            return []
        }
    }

    // Resolve magnet file to direct link
    async resolveMagnet(magnetId, fileIndex = 0) {
        try {
            const magnetInfo = await this.makeRequest(`/magnet/status`, {
                params: { id: magnetId }
            })

            const magnet = magnetInfo.magnets?.[0]
            if (!magnet || !magnet.links) {
                throw new Error('Magnet not found or not ready')
            }

            return magnet.links[fileIndex]?.link || null
        } catch (error) {
            console.error('AD resolveMagnet error:', error)
            return null
        }
    }

    // Simple IMDB matching
    matchesImdb(filename, imdbId) {
        if (!filename || !imdbId) return false

        const id = imdbId.replace(/^tt/, '')
        return filename.toLowerCase().includes(id) ||
            filename.toLowerCase().includes(`tt${id}`)
    }

    // Format file as Stremio stream
    formatAsStream(item, baseUrl) {
        const quality = this.extractQuality(item.name)
        const size = item.size ? ` (${this.formatBytes(item.size)})` : ''

        return {
            name: `AD 🔗 ${quality}${size}`,
            description: item.name,
            url: `${baseUrl}/resolve/alldebrid/${this.apiKey}/${item.id}/${encodeURIComponent(item.link || '#')}`,
            behaviorHints: {
                notWebReady: true
            }
        }
    }

    // Extract quality from filename
    extractQuality(filename) {
        const qualities = ['2160p', '1080p', '720p', '480p', '360p']
        for (const quality of qualities) {
            if (filename.toLowerCase().includes(quality)) {
                return quality
            }
        }
        return 'Unknown'
    }

    // Format bytes to human readable
    formatBytes(bytes) {
        if (!bytes) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }
}
