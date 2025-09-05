// Cloudflare Pages Functions handler
// This file handles all routes using the existing serverless setup

import serverless from './serverless-cf.js'

export async function onRequest(context) {
    const { request, env } = context

    // Set environment variables from Cloudflare
    if (env) {
        Object.keys(env).forEach(key => {
            process.env[key] = env[key]
        })
    }

    // Create a simplified response object compatible with Cloudflare Workers
    const res = {
        statusCode: 200,
        headers: {},
        body: '',

        writeHead(status, headers = {}) {
            this.statusCode = status
            Object.assign(this.headers, headers)
        },

        setHeader(name, value) {
            this.headers[name] = value
        },

        end(data = '') {
            this.body = data
        },

        redirect(url) {
            this.statusCode = 302
            this.headers['Location'] = url
            this.body = ''
        }
    }

    // Create a request object compatible with Express
    const req = {
        method: request.method,
        url: new URL(request.url).pathname + new URL(request.url).search,
        headers: Object.fromEntries(request.headers.entries()),
        params: {},
        query: Object.fromEntries(new URL(request.url).searchParams.entries())
    }

    // Add body for POST requests
    if (request.method === 'POST') {
        req.body = await request.text()
    }

    // Call the serverless handler
    await new Promise((resolve) => {
        serverless(req, res, resolve)
    })

    // Return Cloudflare-compatible response
    return new Response(res.body, {
        status: res.statusCode,
        headers: res.headers
    })
}
