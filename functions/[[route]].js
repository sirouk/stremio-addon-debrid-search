// Cloudflare Pages Functions - Complete rewrite for Workers compatibility
// No Node.js dependencies - using only Web APIs

export async function onRequest(context) {
    const { request, env } = context

    // Set environment variables from Cloudflare
    if (env) {
        Object.keys(env).forEach(key => {
            globalThis[`ENV_${key}`] = env[key]
        })
    }

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    try {
        // Health check
        if (pathname === '/ping') {
            return new Response('OK', { status: 200, headers: corsHeaders })
        }

        // Debug endpoint for testing
        if (pathname === '/debug') {
            return new Response(JSON.stringify({
                timestamp: new Date().toISOString(),
                url: request.url,
                method: request.method,
                headers: Object.fromEntries(request.headers.entries())
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Root redirect
        if (pathname === '/') {
            return new Response(null, {
                status: 302,
                headers: { ...corsHeaders, 'Location': '/configure' }
            })
        }

        // Configure page
        if (pathname === '/configure' || pathname.endsWith('/configure')) {
            const html = await generateConfigurePage(pathname)
            return new Response(html, {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'text/html' }
            })
        }

        // Manifest endpoint
        if (pathname.endsWith('/manifest.json')) {
            const manifest = generateManifest(pathname)
            return new Response(JSON.stringify(manifest), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Stream endpoints
        const streamMatch = pathname.match(/^\/([^\/]+)?\/?stream\/(movie|series)\/([^\/]+)(?:\/(.+))?\.json$/)
        if (streamMatch) {
            const [, configParam, type, id, extra] = streamMatch
            const baseUrl = `${url.protocol}//${url.host}`
            const result = await handleStreamRequest(configParam, type, id, extra, url.searchParams, baseUrl)

            // Always return streams array for Stremio compatibility
            const response = {
                streams: result.streams || []
            }

            return new Response(JSON.stringify(response), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=300, private' // Shorter cache for errors
                }
            })
        }

        // Resolve endpoint
        const resolveMatch = pathname.match(/^\/resolve\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/)
        if (resolveMatch) {
            const [, debridProvider, debridApiKey, id, hostUrl] = resolveMatch
            const resolvedUrl = await handleResolveRequest(debridProvider, debridApiKey, id, hostUrl, request)

            return new Response(null, {
                status: 302,
                headers: { ...corsHeaders, 'Location': resolvedUrl }
            })
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders })

    } catch (error) {
        console.error('Handler error:', error)
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}

// Generate configuration page HTML
async function generateConfigurePage(pathname) {
    const config = parseConfigurationFromPath(pathname)

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Debrid Search - Stremio Addon</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px; 
            margin: 40px auto; 
            padding: 20px; 
            line-height: 1.6;
            background: #1a1a1a;
            color: #ffffff;
        }
        .logo { text-align: center; margin-bottom: 30px; }
        .card { 
            background: #2a2a2a; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0;
            border: 1px solid #404040;
        }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; color: #cccccc; }
        input, select { 
            width: 100%; 
            padding: 10px; 
            border-radius: 4px; 
            border: 1px solid #555;
            background: #333;
            color: #fff;
            box-sizing: border-box;
        }
        .install-btn {
            background: #7b2cbf;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            margin: 10px 5px;
        }
        .install-btn:hover { background: #9d4edd; }
        .warning { 
            background: #664d00; 
            border-left: 4px solid #ffa500; 
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="logo">
        <h1>🎬 Debrid Search</h1>
        <p>Stremio Addon for Debrid Cloud Content</p>
    </div>
    
    <div class="card">
        <h3>Configuration</h3>
        <div class="form-group">
            <label for="debridProvider">Debrid Provider:</label>
            <select id="debridProvider" onchange="updateConfig()">
                <option value="realdebrid" ${config.debridProvider === 'realdebrid' ? 'selected' : ''}>Real-Debrid</option>
                <option value="alldebrid" ${config.debridProvider === 'alldebrid' ? 'selected' : ''}>All-Debrid</option>
                <option value="premiumize" ${config.debridProvider === 'premiumize' ? 'selected' : ''}>Premiumize</option>
                <option value="torbox" ${config.debridProvider === 'torbox' ? 'selected' : ''}>TorBox</option>
                <option value="debridlink" ${config.debridProvider === 'debridlink' ? 'selected' : ''}>Debrid-Link</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="apiKey">API Key:</label>
            <input type="password" id="apiKey" placeholder="Enter your API key" value="${config.apiKey || ''}" onchange="updateConfig()">
        </div>
        
        <div class="form-group">
            <label for="maxResults">Max Results:</label>
            <input type="number" id="maxResults" min="1" max="50" value="${config.maxResults || 10}" onchange="updateConfig()">
        </div>
    </div>
    
    <div class="warning">
        <strong>Note:</strong> This addon only shows streaming links for downloads and torrents already present in your Debrid account. It does not search for new content.
    </div>
    
    <div class="card" style="text-align: center;">
        <h3>Install to Stremio</h3>
        <a href="#" id="installLink" class="install-btn">Install Addon</a>
        <p style="font-size: 14px; color: #888;">
            Click to install this configured addon to Stremio
        </p>
    </div>

    <script>
        function updateConfig() {
            const provider = document.getElementById('debridProvider').value;
            const apiKey = document.getElementById('apiKey').value;
            const maxResults = document.getElementById('maxResults').value;
            
            const config = btoa(JSON.stringify({
                debridProvider: provider,
                apiKey: apiKey,
                maxResults: parseInt(maxResults) || 10
            }));
            
            const manifestUrl = window.location.origin + '/' + config + '/manifest.json';
            document.getElementById('installLink').href = 'stremio://' + manifestUrl;
        }
        
        updateConfig(); // Initialize
    </script>
</body>
</html>`
}

// Generate addon manifest
function generateManifest(pathname) {
    const config = parseConfigurationFromPath(pathname)

    return {
        id: 'community.debridsearch',
        name: 'Debrid Search',
        description: 'Search downloads and torrents in your Debrid cloud',
        version: '0.1.11',
        logo: 'https://i.imgur.com/jIqpCp5.png',
        resources: ['stream'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: [],
        behaviorHints: {
            configurable: true,
            configurationRequired: true
        }
    }
}

// Parse configuration from URL path
function parseConfigurationFromPath(pathname) {
    try {
        const pathParts = pathname.split('/')
        if (pathParts.length > 2 && pathParts[1] && pathParts[1] !== 'configure' && !pathParts[1].includes('.')) {
            const configStr = decodeURIComponent(pathParts[1])
            return JSON.parse(atob(configStr))
        }
    } catch (e) {
        console.log('Config parse error:', e.message)
    }

    return {
        debridProvider: 'realdebrid',
        apiKey: '',
        maxResults: 10
    }
}

// Handle stream requests
async function handleStreamRequest(configParam, type, id, extra, searchParams, baseUrl) {
    try {
        const config = configParam ? JSON.parse(atob(decodeURIComponent(configParam))) : {}

        if (!config.apiKey) {
            // Return informational stream instead of error for better UX
            return {
                streams: [{
                    name: "🔧 Configuration Required",
                    description: "Click to configure your Debrid API key",
                    externalUrl: `${baseUrl}/configure`,
                    behaviorHints: {
                        notWebReady: true
                    }
                }]
            }
        }

        // Parse extra parameters
        const extraData = {}
        if (extra && searchParams.size === 0) {
            // Parse from path
            const parts = extra.split('&')
            for (const part of parts) {
                const [key, value] = part.split('=')
                if (key && value) {
                    extraData[decodeURIComponent(key)] = decodeURIComponent(value)
                }
            }
        } else {
            // Parse from search params
            for (const [key, value] of searchParams) {
                extraData[key] = value
            }
        }

        // Get streams based on debrid provider
        const streams = await getStreamsFromDebrid(config, type, id, extraData, baseUrl)

        return { streams }

    } catch (error) {
        console.error('Stream request error:', error)
        return {
            streams: [{
                name: `❌ Error: ${error.message}`,
                description: "Failed to get streams from debrid provider",
                externalUrl: `${baseUrl}/configure`,
                behaviorHints: {
                    notWebReady: true
                }
            }]
        }
    }
}

// Handle resolve requests  
async function handleResolveRequest(debridProvider, apiKey, id, hostUrl, request) {
    try {
        const decodedHostUrl = decodeURIComponent(hostUrl)
        const clientIp = request.headers.get('cf-connecting-ip') ||
            request.headers.get('x-forwarded-for') ||
            '127.0.0.1'

        // Resolve URL based on debrid provider
        return await resolveDebridUrl(debridProvider, apiKey, id, decodedHostUrl, clientIp)

    } catch (error) {
        console.error('Resolve request error:', error)
        throw error
    }
}

// Get streams from debrid service
async function getStreamsFromDebrid(config, type, id, extraData, baseUrl) {
    try {
        // Import debrid clients dynamically to avoid bundling issues
        const { getDebridStreams } = await import('./debrid/index.js')

        // Extract IMDB ID from the ID parameter
        const imdbId = id.startsWith('tt') ? id : `tt${id}`

        return await getDebridStreams(config, type, imdbId, extraData, baseUrl)

    } catch (error) {
        console.error('Get streams error:', error)
        return [{
            name: `❌ Error: ${error.message}`,
            description: `Failed to get streams from ${config.debridProvider || 'unknown provider'}`,
            externalUrl: `${baseUrl}/configure`,
            behaviorHints: { notWebReady: true }
        }]
    }
}

// Resolve debrid URL
async function resolveDebridUrl(provider, apiKey, id, hostUrl, clientIp) {
    try {
        // Import debrid clients dynamically
        const { resolveDebridUrl: resolve } = await import('./debrid/index.js')

        return await resolve(provider, apiKey, id, hostUrl, clientIp)

    } catch (error) {
        console.error('Resolve URL error:', error)
        // Return a fallback URL or throw
        throw new Error(`Failed to resolve URL: ${error.message}`)
    }
}