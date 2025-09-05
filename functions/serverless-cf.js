// Cloudflare-optimized version of serverless handler
// This version removes middleware that doesn't work in Workers runtime

import Router from 'router'
import addonInterface from "../addon.js"
import landingTemplate from "../lib/util/landingTemplate.js"
import StreamProvider from '../lib/stream-provider.js'
import { decode } from 'urlencode'
import qs from 'querystring'
import { getManifest } from '../lib/util/manifest.js'
import { parseConfiguration } from '../lib/util/configuration.js'
import { BadTokenError, BadRequestError, AccessDeniedError } from '../lib/util/error-codes.js'

const router = new Router();

// Simple rate limiting for Cloudflare (using KV storage would be better for production)
const rateLimitMap = new Map()

function simpleRateLimit(clientIp) {
    const now = Date.now()
    const windowStart = now - (60 * 60 * 1000) // 1 hour window

    if (!rateLimitMap.has(clientIp)) {
        rateLimitMap.set(clientIp, [now])
        return false
    }

    const requests = rateLimitMap.get(clientIp).filter(time => time > windowStart)
    requests.push(now)
    rateLimitMap.set(clientIp, requests)

    return requests.length > 300 // 300 requests per hour
}

function getClientIp(request) {
    return request.headers['cf-connecting-ip'] ||
        request.headers['x-forwarded-for'] ||
        request.headers['x-real-ip'] ||
        '127.0.0.1'
}

router.get('/', (_, res) => {
    res.redirect('/configure')
})

router.get('/:configuration?/configure', (req, res) => {
    const config = parseConfiguration(req.params.configuration)
    const landingHTML = landingTemplate(addonInterface.manifest, config)
    res.setHeader('content-type', 'text/html')
    res.end(landingHTML)
})

router.get('/:configuration?/manifest.json', (req, res) => {
    const config = parseConfiguration(req.params.configuration)
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(getManifest(config)))
})

router.get(`/:configuration?/:resource/:type/:id/:extra?.json`, (req, res, next) => {
    const { resource, type, id } = req.params
    const config = parseConfiguration(req.params.configuration)
    const extra = req.params.extra ? qs.parse(req.url.split('/').pop().slice(0, -5)) : {}

    addonInterface.get(resource, type, id, extra, config)
        .then(resp => {
            let cacheHeaders = {
                cacheMaxAge: 'max-age',
                staleRevalidate: 'stale-while-revalidate',
                staleError: 'stale-if-error'
            }

            const cacheControl = Object.keys(cacheHeaders)
                .map(prop => Number.isInteger(resp[prop]) && cacheHeaders[prop] + '=' + resp[prop])
                .filter(val => !!val).join(', ')

            res.setHeader('Cache-Control', `${cacheControl}, private`)
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(resp))
        })
        .catch(err => {
            console.error(err)
            handleError(err, res)
        })
})

router.get('/resolve/:debridProvider/:debridApiKey/:id/:hostUrl', (req, res) => {
    const clientIp = getClientIp(req)
    StreamProvider.resolveUrl(req.params.debridProvider, req.params.debridApiKey, req.params.id, decode(req.params.hostUrl), clientIp)
        .then(url => {
            res.redirect(url)
        })
        .catch(err => {
            console.log(err)
            handleError(err, res)
        })
})

router.get('/ping', (_, res) => {
    res.statusCode = 200
    res.end()
})

function handleError(err, res) {
    if (err == BadTokenError) {
        res.writeHead(401)
        res.end(JSON.stringify({ err: 'Bad token' }))
    } else if (err == AccessDeniedError) {
        res.writeHead(403)
        res.end(JSON.stringify({ err: 'Access denied' }))
    } else if (err == BadRequestError) {
        res.writeHead(400)
        res.end(JSON.stringify({ err: 'Bad request' }))
    } else {
        res.writeHead(500)
        res.end(JSON.stringify({ err: 'Server error' }))
    }
}

export default function (req, res) {
    // Simple rate limiting
    const clientIp = getClientIp(req)
    if (simpleRateLimit(clientIp)) {
        res.writeHead(429)
        res.end(JSON.stringify({ err: 'Rate limit exceeded' }))
        return
    }

    router(req, res, function () {
        res.statusCode = 404;
        res.end();
    });
}
