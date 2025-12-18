'use strict';

const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const fs = require('fs');
const { URL } = require('url');

const TARGET_BASE_URL =
  process.env.TARGET_BASE_URL ||
  'http://backstage-mcp-catalog-test.rhdh-operator.svc.cluster.local';
const LISTEN_PORT = parseInt(process.env.PORT || '8080', 10);
const AUTH_TOKEN_FILE =
  process.env.AUTH_TOKEN_FILE || '/var/run/secrets/backstage/token';
const STATIC_AUTH_TOKEN = process.env.AUTH_TOKEN;
const ALLOWED_PATH_PREFIXES = (process.env.ALLOWED_PATH_PREFIXES ||
  '/api/catalog,/healthz').split(',').map((prefix) => prefix.trim()).filter(Boolean);
const TLS_CERT_FILE = process.env.TLS_CERT_FILE;
const TLS_KEY_FILE = process.env.TLS_KEY_FILE;

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function resolveAuthToken() {
  if (STATIC_AUTH_TOKEN) {
    return STATIC_AUTH_TOKEN.trim();
  }

  try {
    const raw = fs.readFileSync(AUTH_TOKEN_FILE, 'utf8');
    return raw.trim();
  } catch (err) {
    console.error(
      `[proxy] Unable to read auth token from ${AUTH_TOKEN_FILE}: ${err.message}`
    );
    return null;
  }
}

function isPathAllowed(path) {
  if (!ALLOWED_PATH_PREFIXES.length) {
    return true;
  }

  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function createAgent(targetUrl) {
  if (targetUrl.startsWith('https://')) {
    return new https.Agent({
      keepAlive: true,
      rejectUnauthorized: false,
    });
  }

  return new http.Agent({
    keepAlive: true,
  });
}

const proxy = httpProxy.createProxyServer({
  target: TARGET_BASE_URL,
  changeOrigin: true,
  xfwd: true,
  agent: createAgent(TARGET_BASE_URL),
  secure: false, // allow cluster-local TLS with service-ca
});

proxy.on('proxyReq', (proxyReq, req) => {
  const token = resolveAuthToken();
  if (!token) {
    throw new Error('Proxy auth token is missing');
  }

  proxyReq.setHeader('Authorization', `Bearer ${token}`);

  hopByHopHeaders.forEach((header) => {
    proxyReq.removeHeader(header);
  });
});

proxy.on('proxyRes', (proxyRes) => {
  hopByHopHeaders.forEach((header) => {
    proxyRes.headers && delete proxyRes.headers[header];
  });
});

proxy.on('error', (err, req, res) => {
  const message = err && err.message ? err.message : 'Unknown proxy error';
  console.error(`[proxy] ${message}`);

  if (res.headersSent) {
    res.end();
    return;
  }

  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: 'upstream_unreachable',
      message,
    })
  );
});

function logRequest(req, res, statusSource = 'PROXY') {
  const latency = Date.now() - req._proxyStartTime;
  console.log(
    `[proxy] ${req.method} ${req.url} -> ${res.statusCode} (${latency}ms) [${statusSource}]`
  );
}

function loadTlsConfig() {
  if (!TLS_CERT_FILE || !TLS_KEY_FILE) {
    return null;
  }
  try {
    return {
      cert: fs.readFileSync(TLS_CERT_FILE),
      key: fs.readFileSync(TLS_KEY_FILE),
    };
  } catch (err) {
    console.error(
      `[proxy] Failed to load TLS certificate or key (${TLS_CERT_FILE}, ${TLS_KEY_FILE}): ${err.message}`
    );
    return null;
  }
}

const tlsConfig = loadTlsConfig();

function handleRequest(req, res) {
  const { url } = req;
  const path = new URL(url, 'http://placeholder').pathname;

  if (!isPathAllowed(path)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'forbidden',
        message: 'Path not allowed',
      })
    );
    return;
  }

  if (path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  req._proxyStartTime = Date.now();
  res.on('finish', () => logRequest(req, res, 'UPSTREAM'));

  proxy.web(
    req,
    res,
    {
      target: TARGET_BASE_URL,
    },
    (err) => {
      console.error(`[proxy] proxy.web error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end(
        JSON.stringify({
          error: 'proxy_error',
          message: err.message,
        })
      );
      logRequest(req, res, 'ERROR');
    }
  );
}

const server = tlsConfig
  ? https.createServer(tlsConfig, handleRequest)
  : http.createServer(handleRequest);

server.listen(LISTEN_PORT, () => {
  const scheme = tlsConfig ? 'https' : 'http';
  console.log(
    `[proxy] Listening on ${scheme}://0.0.0.0:${LISTEN_PORT}, forwarding to ${TARGET_BASE_URL}`
  );
});
