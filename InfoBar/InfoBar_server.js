'use strict';

const fs = require('fs');
const path = require('path');
const { logInfo, logWarn, logError } = require('../../server/console');

const PLUGIN_ID = 'InfoBar';
const API_BASE = '/info-bar';
const MAX_TXT_BYTES = 128 * 1024;
const MIN_SECONDS = 30;
const MAX_SECONDS = 300;
const DEFAULT_SECONDS = 300;

const serverRoot = path.dirname(require.main.filename);
const storeDir = path.join(serverRoot, 'plugins_configs');
const storeFile = path.join(storeDir, 'InfoBar.json');

const defaults = {
    enabled: true,
    color: '#00000080',
    html: '',
    sourceName: '',
    updatedAt: '',
    filePath: '',
    pollIntervalSeconds: DEFAULT_SECONDS,
    lastCheckedAt: '',
    lastReadAt: '',
    lastMtimeMs: 0,
    lastError: '',
    allowRemoteConfig: false
};

let state = { ...defaults };
let timer = null;
let reading = false;

function makeStore() {
    if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
    if (!fs.existsSync(storeFile)) fs.writeFileSync(storeFile, JSON.stringify(defaults, null, 2), 'utf8');
}

function seconds(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return DEFAULT_SECONDS;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
}

function cleanString(value) {
    return String(value || '')
        .replace(/^\uFEFF/, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim();
}

function localPath(value) {
    if (typeof value !== 'string') return '';
    let result = cleanString(value).replace(/^["']+|["']+$/g, '').trim();
    result = result.replace(/^file:\/\/\/?/i, '');
    result = result.replace(/^\/([a-zA-Z]:[\\/])/, '$1');
    if (process.platform === 'win32') result = result.replace(/\//g, '\\');
    return result;
}

function visibleName(value) {
    const result = localPath(value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
    const base = path.basename(result) || path.win32.basename(result) || result.split(/[\\/]/).pop() || '';
    return base.slice(0, 120);
}

function txtPath(value) {
    const result = localPath(value);
    if (!result || result.length > 600) return '';
    return result.toLowerCase().endsWith('.txt') ? result : '';
}

function windowsDrive(value) {
    return /^[a-zA-Z]:[\\/]/.test(String(value || ''));
}

function pathInfo(filePath) {
    const normalizedPath = txtPath(filePath);
    const info = {
        platform: process.platform,
        cwd: process.cwd(),
        rootDir: serverRoot,
        normalizedPath,
        directory: '',
        directoryExists: false,
        fileExists: false,
        readable: false,
        drive: '',
        driveExists: null
    };

    if (!normalizedPath) return info;

    try {
        info.directory = path.dirname(normalizedPath);
        info.directoryExists = fs.existsSync(info.directory);
    } catch (_) {}

    if (windowsDrive(normalizedPath)) {
        info.drive = normalizedPath.slice(0, 3);
        try { info.driveExists = fs.existsSync(info.drive); } catch (_) { info.driveExists = false; }
    }

    try { info.fileExists = fs.existsSync(normalizedPath); } catch (_) {}
    try { fs.accessSync(normalizedPath, fs.constants.R_OK); info.readable = true; } catch (_) {}

    return info;
}

function missingMessage(filePath) {
    const info = pathInfo(filePath);

    if (windowsDrive(filePath) && process.platform !== 'win32') {
        return `File not found. Node is running on '${process.platform}', so the Windows path '${filePath}' is not a local path in this environment.`;
    }

    if (info.drive && info.driveExists === false) {
        return `File not found. The drive '${info.drive}' is not visible to FM-DX Webserver.`;
    }

    if (info.directory && info.directoryExists === false) {
        return `File not found. The folder does not exist or is not accessible: ${info.directory}`;
    }

    return `File not found or not accessible: ${filePath}`;
}

function safeColor(value) {
    if (typeof value !== 'string') return '';
    const color = value.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
    if (/^rgba?\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(color)) return color;
    return color.toLowerCase() === 'transparent' ? 'transparent' : '';
}

function htmlEscape(value) {
    return String(value)
        .replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]))
        .replace(/&amp;(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g, '&$1;');
}

function cleanUrl(value) {
    if (typeof value !== 'string') return '';
    let url = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
    if (!url) return '';
    url = url.replace(/&colon;/gi, ':').replace(/&#58;/g, ':').replace(/&#x3a;/gi, ':');
    const l = url.toLowerCase();
    return (l.startsWith('http://') || l.startsWith('https://') || l.startsWith('mailto:') || l.startsWith('tel:') || l.startsWith('/') || l.startsWith('#')) ? url : '';
}

function attr(source, name) {
    const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
    const m = String(source || '').match(re);
    return m ? (m[2] || m[3] || m[4] || '') : '';
}

function tidyHtml(input) {
    if (typeof input !== 'string') return '';

    let source = input
        .replace(/^\uFEFF/, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    source = source.replace(/<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select|option|meta|link|base|frame|frameset|audio|video|source|canvas|template|slot)\b[\s\S]*?<\/\1\s*>/gi, '');
    source = source.replace(/<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select|option|meta|link|base|frame|frameset|audio|video|source|canvas|template|slot)\b[^>]*\/?>/gi, '');

    const allowed = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li', 'small', 'mark', 'code', 'pre', 'blockquote']);
    const tag = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
    let out = '';
    let pos = 0;
    let match;

    while ((match = tag.exec(source)) !== null) {
        out += htmlEscape(source.slice(pos, match.index));
        pos = tag.lastIndex;

        const full = match[0];
        const name = match[1].toLowerCase();
        const attrs = match[2] || '';
        const close = /^<\s*\//.test(full);

        if (!allowed.has(name)) continue;
        if (name === 'br') { out += '<br>'; continue; }
        if (close) { out += `</${name}>`; continue; }

        if (name === 'a') {
            const href = cleanUrl(attr(attrs, 'href'));
            const title = attr(attrs, 'title').slice(0, 200);
            const titlePart = title ? ` title="${htmlEscape(title)}"` : '';
            out += href ? `<a href="${htmlEscape(href)}"${titlePart} target="_blank" rel="noopener noreferrer">` : '<a>';
            continue;
        }

        out += `<${name}>`;
    }

    out += htmlEscape(source.slice(pos));
    return out.trim();
}

function loadState() {
    try {
        const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
        state = {
            enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
            color: safeColor(parsed.color) || defaults.color,
            html: typeof parsed.html === 'string' ? parsed.html : '',
            sourceName: typeof parsed.sourceName === 'string' ? visibleName(parsed.sourceName) : '',
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
            filePath: txtPath(parsed.filePath) || '',
            pollIntervalSeconds: seconds(parsed.pollIntervalSeconds),
            lastCheckedAt: typeof parsed.lastCheckedAt === 'string' ? parsed.lastCheckedAt : '',
            lastReadAt: typeof parsed.lastReadAt === 'string' ? parsed.lastReadAt : '',
            lastMtimeMs: Number.isFinite(Number(parsed.lastMtimeMs)) ? Number(parsed.lastMtimeMs) : 0,
            lastError: typeof parsed.lastError === 'string' ? parsed.lastError.slice(0, 300) : '',
            allowRemoteConfig: typeof parsed.allowRemoteConfig === 'boolean' ? parsed.allowRemoteConfig : false
        };
        logInfo(`${PLUGIN_ID}: config loaded`);
    } catch (err) {
        logError(`${PLUGIN_ID}: config reset`, err);
        state = { ...defaults };
        saveState();
    }
}

function saveState() {
    fs.writeFileSync(storeFile, JSON.stringify(state, null, 2), 'utf8');
}

function localRequest(req) {
    const values = [
        req.ip,
        req.connection && req.connection.remoteAddress,
        req.socket && req.socket.remoteAddress,
        req.headers && req.headers['x-forwarded-for']
    ].filter(Boolean).join(',');

    return /(^|,|\s)(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1|localhost)(,|\s|$)/i.test(values) || /^::ffff:127\./.test(values) || /^127\./.test(values);
}

function allowWrite(req, res) {
    if (state.allowRemoteConfig || localRequest(req)) return true;
    res.status(403).json({ success: false, error: 'By default, settings can only be changed locally on the FM-DX Webserver computer.' });
    return false;
}

function publicState() {
    return {
        enabled: state.enabled,
        color: state.color,
        html: state.html,
        sourceName: state.sourceName,
        updatedAt: state.updatedAt,
        pollIntervalSeconds: state.pollIntervalSeconds,
        lastCheckedAt: state.lastCheckedAt,
        lastReadAt: state.lastReadAt,
        lastError: state.lastError
    };
}

function setupState() {
    return {
        ...publicState(),
        filePathDisplay: state.filePath || '',
        pathDiagnostics: state.filePath ? pathInfo(state.filePath) : null
    };
}

function setError(message) {
    state.lastError = String(message || '').slice(0, 300);
}

function readTxt(force = false) {
    if (reading || !state.filePath) return false;
    reading = true;

    try {
        const filePath = txtPath(state.filePath);
        if (!filePath) throw new Error('No valid .txt file path has been configured.');

        state.lastCheckedAt = new Date().toISOString();

        if (!fs.existsSync(filePath)) throw new Error(missingMessage(filePath));

        const stat = fs.statSync(filePath);
        if (!stat.isFile()) throw new Error('The configured path exists, but it is not a file.');

        try { fs.accessSync(filePath, fs.constants.R_OK); } catch (_) { throw new Error('The TXT file exists, but FM-DX Webserver cannot read it.'); }
        if (stat.size > MAX_TXT_BYTES) throw new Error(`TXT file is too large. Maximum ${MAX_TXT_BYTES} bytes.`);

        if (!force && Number(stat.mtimeMs) === Number(state.lastMtimeMs)) {
            setError('');
            saveState();
            return false;
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        state.html = tidyHtml(raw);
        state.sourceName = visibleName(filePath);
        state.updatedAt = new Date().toISOString();
        state.lastReadAt = state.updatedAt;
        state.lastMtimeMs = Number(stat.mtimeMs) || Date.now();
        setError('');
        saveState();
        logInfo(`${PLUGIN_ID}: ${state.sourceName} refreshed`);
        return true;
    } catch (err) {
        state.lastCheckedAt = new Date().toISOString();
        setError(err.message || 'Failed to read TXT file.');
        saveState();
        logWarn(`${PLUGIN_ID}: ${state.lastError}`);
        return false;
    } finally {
        reading = false;
    }
}

function scheduleRead() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => readTxt(false), seconds(state.pollIntervalSeconds) * 1000);
    if (timer.unref) timer.unref();
}

function boolValue(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function saveHandler(req, res) {
    if (!allowWrite(req, res)) return;

    const body = req.body || {};

    try {
        const color = safeColor(body.color);
        if (color) state.color = color;

        state.enabled = boolValue(body.enabled, state.enabled);
        state.pollIntervalSeconds = seconds(body.pollIntervalSeconds);

        if (Object.prototype.hasOwnProperty.call(body, 'filePath')) {
            const nextPath = txtPath(body.filePath);
            if (String(body.filePath || '').trim() && !nextPath) {
                res.status(400).json({ success: false, error: 'Enter a valid local path to a .txt file.' });
                return;
            }

            if (nextPath !== state.filePath) {
                state.filePath = nextPath;
                state.sourceName = visibleName(nextPath);
                state.lastMtimeMs = 0;
                state.lastReadAt = '';
                setError('');
            }
        }

        saveState();
        scheduleRead();

        if (body.forceRead === true || body.readNow === true) readTxt(true);

        res.json({ success: true, config: setupState() });
    } catch (err) {
        logError(`${PLUGIN_ID}: save failed`, err);
        res.status(500).json({ success: false, error: 'Save failed.' });
    }
}

makeStore();
loadState();
readTxt(true);
scheduleRead();

process.nextTick(() => {
    try {
        const endpointsRouter = require('../../server/endpoints');
        endpointsRouter.get(`${API_BASE}/config`, (req, res) => res.json(publicState()));
        endpointsRouter.get(`${API_BASE}/setup`, (req, res) => res.json(setupState()));
        endpointsRouter.get(`${API_BASE}/diagnostics`, (req, res) => res.json(setupState()));
        endpointsRouter.post(`${API_BASE}/config`, saveHandler);
        logInfo(`${PLUGIN_ID}: endpoints registered`);
    } catch (err) {
        logError(`${PLUGIN_ID}: endpoint registration failed`, err);
    }
});
