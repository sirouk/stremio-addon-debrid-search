// Real-Debrid API client - Cloudflare Workers compatible
// Using only fetch() and Web APIs

const RD_API_BASE = 'https://api.real-debrid.com/rest/1.0'

export class RealDebridClient {
    constructor(apiKey) {
        this.apiKey = apiKey
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${RD_API_BASE}${endpoint}`
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        }

        const response = await fetch(url, {
            ...options,
            headers
        })

        if (!response.ok) {
            throw new Error(`Real-Debrid API error: ${response.status} ${response.statusText}`)
        }

        return await response.json()
    }

    // Get user torrents
    async getTorrents() {
        try {
            return await this.makeRequest('/torrents')
        } catch (error) {
            console.error('RD getTorrents error:', error)
            return []
        }
    }

    // Get downloads
    async getDownloads() {
        try {
            return await this.makeRequest('/downloads')
        } catch (error) {
            console.error('RD getDownloads error:', error)
            return []
        }
    }

    // Search torrents and downloads for IMDB ID
    async searchByImdb(imdbId) {
        try {
            const [torrents, downloads] = await Promise.all([
                this.getTorrents(),
                this.getDownloads()
            ])

            const results = []

            // Search torrents
            for (const torrent of torrents) {
                if (torrent.filename && this.matchesImdb(torrent.filename, imdbId)) {
                    results.push({
                        type: 'torrent',
                        name: torrent.filename,
                        id: torrent.id,
                        size: torrent.bytes,
                        files: torrent.files || []
                    })
                }
            }

            // Search downloads  
            for (const download of downloads) {
                if (download.filename && this.matchesImdb(download.filename, imdbId)) {
                    results.push({
                        type: 'download',
                        name: download.filename,
                        id: download.id,
                        size: download.filesize,
                        link: download.download
                    })
                }
            }

            return results
        } catch (error) {
            console.error('RD searchByImdb error:', error)
            return []
        }
    }

    // Resolve torrent file to direct link
    async resolveTorrent(torrentId, fileId) {
        try {
            const torrentInfo = await this.makeRequest(`/torrents/info/${torrentId}`)
            const file = torrentInfo.files?.find(f => f.id === fileId)

            if (!file) {
                throw new Error('File not found in torrent')
            }

            return file.links?.[0] || null
        } catch (error) {
            console.error('RD resolveTorrent error:', error)
            return null
        }
    }

    // Simple IMDB matching (can be improved)
    matchesImdb(filename, imdbId) {
        if (!filename || !imdbId) return false

        // Remove 'tt' prefix from IMDB ID
        const id = imdbId.replace(/^tt/, '')

        // Check if filename contains the IMDB ID
        return filename.toLowerCase().includes(id) ||
            filename.toLowerCase().includes(`tt${id}`)
    }

    // Format file as Stremio stream
    formatAsStream(item, baseUrl) {
        const quality = this.extractQuality(item.name)
        const size = item.size ? ` (${this.formatBytes(item.size)})` : ''

        return {
            name: `RD 🔗 ${quality}${size}`,
            description: item.name,
            url: `${baseUrl}/resolve/realdebrid/${this.apiKey}/${item.id}/${encodeURIComponent(item.link || '#')}`,
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
