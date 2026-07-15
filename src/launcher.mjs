import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARY_PATH = resolve(__dirname, 'spring-app.bin');
const IDLE_TIMEOUT = 300_000;
const STARTUP_TIMEOUT = 30_000;

let appProcess = null;
let appPort = null;
let lastUsed = Date.now();
let idleTimer = null;

function log(...args) {
  console.log('[vercel-spring]', ...args);
}

function detectPort(data) {
  const text = typeof data === 'string' ? data : data.toString();
  const patterns = [
    /port\(s\):\s*(\d+)/i,
    /Tomcat.*started.*port.*?(\d+)/i,
    /Netty.*started.*port.*?(\d+)/i,
    /listening on [\w.:]+:(\d+)/i,
    /port:\s*(\d+)/i,
    /Started\s+\S+\s+in\s+[\d.]+\s+seconds.*port\(s\):\s*(\d+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function killApp() {
  if (appProcess) {
    appProcess.kill('SIGTERM');
    appProcess = null;
    appPort = null;
  }
}

async function startApp() {
  return new Promise((resolvePromise, reject) => {
    log('Starting Spring Boot native binary...');
    const child = spawn(BINARY_PATH, ['--server.port=0'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    appProcess = child;
    lastUsed = Date.now();
    let started = false;

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (!started) {
        const port = detectPort(data);
        if (port) {
          appPort = port;
          started = true;
          log('App ready on port', port);
          resolvePromise();
        }
      }
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      if (!started) {
        const port = detectPort(data);
        if (port) {
          appPort = port;
          started = true;
          log('App ready on port (stderr)', port);
          resolvePromise();
        }
      }
    });

    child.on('error', (err) => {
      if (!started) { started = true; reject(err); }
    });

    child.on('exit', (code) => {
      log('Native binary exited with code', code);
      appProcess = null;
      appPort = null;
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        reject(new Error('Startup timed out after ' + STARTUP_TIMEOUT + 'ms'));
      }
    }, STARTUP_TIMEOUT);
  });
}

async function ensureRunning() {
  if (appProcess && appProcess.exitCode === null && appPort !== null) {
    lastUsed = Date.now();
    return appPort;
  }
  killApp();
  await startApp();
  return appPort;
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (appProcess && Date.now() - lastUsed > IDLE_TIMEOUT) {
      log('Idle timeout reached, stopping app');
      killApp();
    }
  }, IDLE_TIMEOUT + 5000);
}

export default async function handler(req, res) {
  try {
    const port = await ensureRunning();
    resetIdleTimer();

    const url = new URL(req.url, 'http://localhost:' + port);
    log(req.method, req.url);

    const headers = {};
    if (req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        if (['host', 'connection', 'content-length'].includes(k)) continue;
        headers[k] = v;
      }
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined));
      });
    }

    const response = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    res.statusCode = response.status;
    if (response.statusText) {
      res.statusMessage = response.statusText;
    }
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) { res.end(); return; }
          res.write(value);
          pump();
        }).catch(err => {
          log('Stream error:', err.message);
          res.end();
        });
      };
      pump();
    } else {
      res.end();
    }
  } catch (err) {
    log('Error:', err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
  }
}
