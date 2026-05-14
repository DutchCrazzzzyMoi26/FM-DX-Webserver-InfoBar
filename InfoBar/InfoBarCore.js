(() => {
    'use strict';

    const API = '/info-bar';
    const HEADER_VALUE = 'InfoBar';
    const MIN_SECONDS = 30;
    const MAX_SECONDS = 300;
    const DEFAULT_SECONDS = 300;
    const SPEED = 70;
    const HEIGHT = 28;

    let data = {
        enabled: true,
        color: '#00000080',
        html: '',
        sourceName: '',
        updatedAt: '',
        pollIntervalSeconds: DEFAULT_SECONDS,
        lastCheckedAt: '',
        lastReadAt: '',
        lastError: '',
        filePathDisplay: '',
        pathDiagnostics: null
    };

    let pollHandle = null;
    let resizeHandle = null;
    let rendered = '';
    let queued = null;

    function clamp(value) {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n)) return DEFAULT_SECONDS;
        return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
    }

    function dateText(value) {
        if (!value) return '';
        try { return new Date(value).toLocaleString(); } catch (_) { return value; }
    }

    async function requestConfig(withSetupData = false) {
        const response = await fetch(`${API}/${withSetupData ? 'setup' : 'config'}`, {
            headers: { 'X-Plugin-Name': HEADER_VALUE }
        });

        if (!response.ok) throw new Error(`Failed to load config (${response.status})`);

        const raw = await response.json();
        data = {
            enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
            color: typeof raw.color === 'string' && raw.color ? raw.color : '#00000080',
            html: typeof raw.html === 'string' ? raw.html : '',
            sourceName: typeof raw.sourceName === 'string' ? raw.sourceName : '',
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
            pollIntervalSeconds: clamp(raw.pollIntervalSeconds),
            lastCheckedAt: typeof raw.lastCheckedAt === 'string' ? raw.lastCheckedAt : '',
            lastReadAt: typeof raw.lastReadAt === 'string' ? raw.lastReadAt : '',
            lastError: typeof raw.lastError === 'string' ? raw.lastError : '',
            filePathDisplay: typeof raw.filePathDisplay === 'string' ? raw.filePathDisplay : '',
            pathDiagnostics: raw.pathDiagnostics || null
        };

        return data;
    }

    function css() {
        if (document.getElementById('dc-info-bar-style')) return;

        const style = document.createElement('style');
        style.id = 'dc-info-bar-style';
        style.textContent = `
#dc-info-bar-frame {
    width: 100%;
    box-sizing: border-box;
    padding: 0 10px;
    display: flex;
    justify-content: center;
    overflow: hidden;
}

#dc-info-bar-panel {
    width: 100%;
    max-width: 1160px;
    height: var(--dc-info-height, ${HEIGHT}px);
    min-height: var(--dc-info-height, ${HEIGHT}px);
    margin-top: 20px;
    padding: 0 18px;
    box-sizing: border-box;
    border-radius: 15px;
    overflow: hidden;
    line-height: var(--dc-info-height, ${HEIGHT}px);
    color: var(--dc-info-text, var(--color-5, var(--color-4, var(--color-1, #fff))));
}

#dc-info-bar-window {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
}

#dc-info-bar-line {
    position: relative;
    display: inline-block;
    width: max-content;
    min-width: max-content;
    max-width: none;
    height: 100%;
    margin: 0;
    padding: 0;
    white-space: nowrap !important;
    line-height: var(--dc-info-height, ${HEIGHT}px);
    will-change: transform;
    animation-name: dcInfoBarSlide;
    animation-duration: var(--dc-info-duration, 90s);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}

#dc-info-bar-line:hover {
    animation-play-state: paused;
}

#dc-info-bar-line,
#dc-info-bar-line * {
    white-space: nowrap !important;
}

#dc-info-bar-line b,
#dc-info-bar-line strong,
#dc-info-bar-line i,
#dc-info-bar-line em,
#dc-info-bar-line u,
#dc-info-bar-line s,
#dc-info-bar-line small,
#dc-info-bar-line mark,
#dc-info-bar-line code,
#dc-info-bar-line pre,
#dc-info-bar-line blockquote,
#dc-info-bar-line span {
    color: inherit;
}

#dc-info-bar-line p,
#dc-info-bar-line div,
#dc-info-bar-line ul,
#dc-info-bar-line ol,
#dc-info-bar-line li,
#dc-info-bar-line blockquote,
#dc-info-bar-line pre,
#dc-info-bar-line code,
#dc-info-bar-line span {
    display: inline !important;
    margin: 0 !important;
    padding: 0 !important;
}

#dc-info-bar-line br {
    display: none !important;
}

#dc-info-bar-line a {
    color: currentColor;
    text-decoration: underline;
    font-weight: 600;
}

#dc-info-bar-line a:hover {
    text-decoration-thickness: 2px;
}

@keyframes dcInfoBarSlide {
    from { transform: translateX(var(--dc-info-start, 100vw)); }
    to { transform: translateX(var(--dc-info-end, -100%)); }
}

@media (prefers-reduced-motion: reduce) {
    #dc-info-bar-line {
        animation-duration: 1ms;
        animation-iteration-count: 1;
        transform: translateX(0) !important;
        position: static;
    }
}

.dc-info-settings {
    padding-bottom: 10px;
}

.dc-info-box {
    width: min(720px, calc(100vw - 48px));
    max-width: 720px;
    margin: 0 auto;
    padding: 14px 18px 16px;
    border: 1px solid var(--color-5-transparent);
    border-radius: 15px;
    box-sizing: border-box;
}

.dc-info-field {
    margin-bottom: 14px;
}

.dc-info-field label,
.dc-info-option label {
    display: block;
    margin-bottom: 7px;
    color: var(--color-5);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    text-align: center;
}

#dc-info-path {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
}

#dc-info-seconds {
    width: 200px;
    color: #fff !important;
}

#dc-info-path:focus,
#dc-info-seconds:focus,
#dc-info-color:focus,
#dc-info-color,
#dc-info-seconds {
    color: #fff !important;
}

.dc-info-muted {
    opacity: .78;
    font-size: 13px;
    margin-top: 8px;
    text-align: center;
}

.dc-info-error {
    color: #ffb4b4;
}

.dc-info-debug {
    margin-top: 8px;
    font-size: 12px;
    opacity: .72;
    line-height: 1.45;
    word-break: break-word;
    text-align: center;
}

.dc-info-actions,
.dc-info-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(120px, 1fr));
    gap: 10px;
    align-items: end;
    margin-top: 14px;
}

.dc-info-option {
    min-height: 58px;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--color-3);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.dc-info-option input[type="checkbox"] {
    transform: scale(1.15);
    margin: 4px 0 0;
}

#dc-info-color {
    width: 100%;
    max-width: 200px;
    box-sizing: border-box;
    text-align: center;
}

.dc-info-button {
    width: 100%;
    min-height: 44px;
    color: var(--color-1);
    background-color: var(--color-3);
    display: inline-flex;
    justify-content: center;
    align-items: center;
    font-size: 15px;
    border-radius: 10px;
    transition: .3s ease background-color;
    cursor: pointer;
    border: 0;
    text-align: center;
}

.dc-info-button:hover {
    background-color: var(--color-5);
}

#dc-info-status {
    margin-top: 10px;
    min-height: 20px;
    text-align: center;
}

@media (max-width: 760px) {
    .dc-info-actions,
    .dc-info-options {
        grid-template-columns: 1fr;
    }
}`;
        document.head.appendChild(style);
    }

    function textKey() {
        return `${data.updatedAt}|${data.html}`;
    }

    function renderKey() {
        return `${data.enabled}|${data.color}|${data.updatedAt}|${data.html}`;
    }

    function usableColor(value) {
        return value && value !== 'transparent' && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value);
    }

    function labelText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
    }

    function themeColor() {
        const wanted = new Set(['PI CODE', 'FREQUENCY', 'AF']);
        const elements = Array.from(document.body.querySelectorAll('div, span, p, label, button, a, h1, h2, h3, h4, h5'));

        for (const el of elements) {
            if (!el || el.closest('#dc-info-bar-frame') || el.closest('#dc-info-settings')) continue;
            if (!wanted.has(labelText(el.textContent))) continue;
            const color = window.getComputedStyle(el).color;
            if (usableColor(color)) return color;
        }

        const root = window.getComputedStyle(document.documentElement);
        const body = window.getComputedStyle(document.body);
        for (const token of ['--color-5', '--color-4', '--color-1']) {
            const value = (root.getPropertyValue(token) || body.getPropertyValue(token) || '').trim();
            if (value) return value;
        }

        return '';
    }

    function applyColorFromTheme() {
        const panel = document.getElementById('dc-info-bar-panel');
        if (!panel) return;
        const color = themeColor();
        if (color) panel.style.setProperty('--dc-info-text', color);
        else panel.style.removeProperty('--dc-info-text');
    }

    function measureRun() {
        const viewport = document.getElementById('dc-info-bar-window');
        const line = document.getElementById('dc-info-bar-line');
        if (!viewport || !line) return;

        line.style.animation = 'none';
        line.style.transform = 'translateX(0)';

        const lineWidth = Math.max(1, Math.ceil(line.scrollWidth));
        const viewWidth = Math.max(1, Math.ceil(viewport.clientWidth));
        const seconds = Math.max(20, Math.ceil((lineWidth + viewWidth) / SPEED));

        line.style.setProperty('--dc-info-start', `${viewWidth}px`);
        line.style.setProperty('--dc-info-end', `-${lineWidth}px`);
        line.style.setProperty('--dc-info-duration', `${seconds}s`);
        line.offsetHeight;
        line.style.animation = '';
        line.style.transform = '';
    }

    function laterMeasure() {
        requestAnimationFrame(() => requestAnimationFrame(measureRun));
    }

    function updateVisibleInfo() {
        if (!queued) return;
        const panel = document.getElementById('dc-info-bar-panel');
        const line = document.getElementById('dc-info-bar-line');
        if (!line) { queued = null; return; }

        const next = queued;
        queued = null;
        if (panel) panel.style.backgroundColor = next.color;
        line.innerHTML = next.html;
        line.dataset.textKey = next.textKey;
        line.dataset.renderKey = next.renderKey;
        rendered = next.renderKey;
        requestAnimationFrame(applyColorFromTheme);
        laterMeasure();
    }

    function waitForCycle(next) {
        queued = next;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) updateVisibleInfo();
    }

    function safeLinks(parent) {
        parent.addEventListener('click', (event) => {
            const link = event.target.closest ? event.target.closest('a') : null;
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
                event.preventDefault();
                return;
            }
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }, true);
    }

    function cycleHook(line) {
        if (!line || line.dataset.cycleHook === '1') return;
        line.dataset.cycleHook = '1';
        line.addEventListener('animationiteration', (event) => {
            if (event.animationName === 'dcInfoBarSlide') updateVisibleInfo();
        });
    }

    function anchorElement() {
        const selectors = ['.canvas-container', '#canvas-container', '[class*="canvas-container"]'];
        for (const selector of selectors) {
            const found = Array.from(document.querySelectorAll(selector)).find((el) => {
                if (!el || el.closest('#dc-info-bar-frame')) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 300 && rect.height > 20;
            });
            if (found) return found;
        }

        const canvas = document.querySelector('canvas');
        if (canvas) return canvas.closest('div') || canvas;
        return null;
    }

    function placeFrame(frame) {
        const anchor = anchorElement();
        if (anchor && anchor.parentNode) anchor.insertAdjacentElement('afterend', frame);
        else document.body.insertAdjacentElement('afterbegin', frame);
    }

    function paintInfoBar() {
        css();
        const key = renderKey();
        const currentTextKey = textKey();
        const existing = document.getElementById('dc-info-bar-frame');

        if (!data.enabled || !data.html) {
            queued = null;
            if (existing) existing.remove();
            rendered = key;
            return;
        }

        if (existing) {
            const panel = document.getElementById('dc-info-bar-panel');
            const line = document.getElementById('dc-info-bar-line');
            applyColorFromTheme();

            if (line) {
                cycleHook(line);
                const visible = line.dataset.textKey || '';
                const next = { html: data.html, color: data.color, renderKey: key, textKey: currentTextKey };

                if (visible && visible !== currentTextKey) {
                    waitForCycle(next);
                } else if (rendered !== key) {
                    if (panel) panel.style.backgroundColor = data.color;
                    line.dataset.textKey = currentTextKey;
                    line.dataset.renderKey = key;
                    rendered = key;
                    if (!visible) laterMeasure();
                }
            }
            return;
        }

        const frame = document.createElement('div');
        frame.id = 'dc-info-bar-frame';

        const panel = document.createElement('div');
        panel.id = 'dc-info-bar-panel';
        panel.style.backgroundColor = data.color;

        const viewport = document.createElement('div');
        viewport.id = 'dc-info-bar-window';

        const line = document.createElement('div');
        line.id = 'dc-info-bar-line';
        line.innerHTML = data.html;
        line.dataset.textKey = currentTextKey;
        line.dataset.renderKey = key;
        safeLinks(line);
        cycleHook(line);

        viewport.appendChild(line);
        panel.appendChild(viewport);
        frame.appendChild(panel);
        placeFrame(frame);

        requestAnimationFrame(applyColorFromTheme);
        setTimeout(applyColorFromTheme, 500);
        laterMeasure();
        rendered = key;
    }

    function poll() {
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = setInterval(async () => {
            try {
                const before = data.pollIntervalSeconds;
                await requestConfig(false);
                paintInfoBar();
                if (before !== data.pollIntervalSeconds) poll();
            } catch (err) {
                console.warn('Info Bar:', err);
            }
        }, clamp(data.pollIntervalSeconds) * 1000);
    }

    function el(tag, attrs = {}, text = '') {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') node.className = value;
            else if (key === 'htmlFor') node.htmlFor = value;
            else if (key === 'style') node.setAttribute('style', value);
            else node.setAttribute(key, value);
        });
        if (text) node.textContent = text;
        return node;
    }

    function status(message, ok = true) {
        const target = document.getElementById('dc-info-status');
        if (!target) return;
        target.textContent = message;
        target.style.color = ok ? '' : '#ffb4b4';
    }

    function refreshSetupText() {
        const current = document.getElementById('dc-info-current');
        if (current) {
            const parts = [];
            if (data.sourceName) parts.push(`File: ${data.sourceName}`);
            if (data.lastReadAt) parts.push(`last read: ${dateText(data.lastReadAt)}`);
            if (data.lastCheckedAt) parts.push(`last checked: ${dateText(data.lastCheckedAt)}`);
            current.textContent = parts.length ? parts.join(' | ') : 'No file has been read yet.';
        }

        const error = document.getElementById('dc-info-error');
        if (error) error.textContent = data.lastError ? `Error: ${data.lastError}` : '';

        const debug = document.getElementById('dc-info-debug');
        if (!debug) return;
        const d = data.pathDiagnostics;
        if (!d) {
            debug.textContent = '';
            return;
        }

        debug.textContent = [
            `Server platform: ${d.platform}`,
            d.normalizedPath ? `path: ${d.normalizedPath}` : '',
            d.directory ? `folder exists: ${d.directoryExists ? 'yes' : 'no'} (${d.directory})` : '',
            typeof d.driveExists === 'boolean' ? `drive visible: ${d.driveExists ? 'yes' : 'no'} (${d.drive})` : '',
            `file exists: ${d.fileExists ? 'yes' : 'no'}`,
            `readable: ${d.readable ? 'yes' : 'no'}`
        ].filter(Boolean).join(' | ');
    }

    async function save(readNow = false) {
        const saveButton = document.getElementById('dc-info-save');
        const checkButton = document.getElementById('dc-info-check');
        const payload = {
            color: (document.getElementById('dc-info-color') || {}).value || '#00000080',
            enabled: Boolean((document.getElementById('dc-info-enabled') || {}).checked),
            filePath: (document.getElementById('dc-info-path') || {}).value || '',
            pollIntervalSeconds: clamp((document.getElementById('dc-info-seconds') || {}).value || DEFAULT_SECONDS),
            forceRead: true,
            readNow
        };

        if (saveButton) saveButton.disabled = true;
        if (checkButton) checkButton.disabled = true;
        status(readNow ? 'Checking now...' : 'Saving...');

        try {
            const response = await fetch(`${API}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Plugin-Name': HEADER_VALUE },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.success === false) throw new Error(result.error || `Action failed (${response.status})`);

            data = result.config || data;
            const interval = document.getElementById('dc-info-seconds');
            if (interval) interval.value = data.pollIntervalSeconds;
            refreshSetupText();
            status(readNow ? 'File checked again.' : 'Saved and file checked.');
        } catch (err) {
            console.error('Info Bar:', err);
            status(err.message || 'Action failed.', false);
        } finally {
            if (saveButton) saveButton.disabled = false;
            if (checkButton) checkButton.disabled = false;
        }
    }

    function settings() {
        if (!window.location.pathname.startsWith('/setup')) return;

        const container = document.getElementById('plugin-settings');
        if (!container || document.getElementById('dc-info-settings')) return;

        css();
        if (container.textContent.trim() === 'No plugin settings are available.') container.innerHTML = '';

        const wrap = el('div', { id: 'dc-info-settings', className: 'dc-info-settings' });
        wrap.appendChild(el('hr', { style: 'width: 20%; border-color: var(--color-5-transparent);' }));
        wrap.appendChild(el('h4', {}, 'Info Bar settings'));
        wrap.appendChild(el('br'));

        const box = el('div', { className: 'dc-info-box' });

        const pathField = el('div', { className: 'dc-info-field' });
        pathField.appendChild(el('label', { htmlFor: 'dc-info-path' }, 'Path to TXT file'));
        const pathInput = el('input', {
            id: 'dc-info-path',
            className: 'input-text br-15',
            type: 'text',
            placeholder: 'C:\\FM-DX\\message.txt',
            autocomplete: 'off'
        });
        pathInput.value = data.filePathDisplay || '';
        pathField.appendChild(pathInput);
        pathField.appendChild(el('div', { className: 'dc-info-muted' }, 'This must be a local path on the same computer that runs FM-DX Webserver. Only .txt files are accepted.'));
        box.appendChild(pathField);

        const intervalField = el('div', { className: 'dc-info-field' });
        intervalField.appendChild(el('label', { htmlFor: 'dc-info-seconds' }, 'Check interval in seconds'));
        const interval = el('input', {
            id: 'dc-info-seconds',
            className: 'input-text w-200 br-15',
            type: 'number',
            min: String(MIN_SECONDS),
            max: String(MAX_SECONDS),
            step: '1'
        });
        interval.value = data.pollIntervalSeconds;
        intervalField.appendChild(interval);
        intervalField.appendChild(el('div', { className: 'dc-info-muted' }, 'Minimum 30 seconds, maximum 300 seconds.'));
        box.appendChild(intervalField);

        box.appendChild(el('div', { id: 'dc-info-current', className: 'dc-info-muted' }));
        box.appendChild(el('div', { id: 'dc-info-error', className: 'dc-info-muted dc-info-error' }));
        box.appendChild(el('div', { id: 'dc-info-debug', className: 'dc-info-debug' }));
        box.appendChild(el('div', { className: 'dc-info-muted' }, 'Scripts, iframes, forms, onclick attributes and javascript links are removed.'));

        const actions = el('div', { className: 'dc-info-actions' });
        const saveButton = el('button', { id: 'dc-info-save', className: 'dc-info-button', type: 'button' });
        saveButton.innerHTML = '<span><i style="padding-right: 7px;" class="fa-solid fa-save"></i>Save</span>';
        saveButton.addEventListener('click', () => save(false));
        actions.appendChild(saveButton);

        const checkButton = el('button', { id: 'dc-info-check', className: 'dc-info-button', type: 'button' });
        checkButton.innerHTML = '<span><i style="padding-right: 7px;" class="fa-solid fa-rotate"></i>Check now</span>';
        checkButton.addEventListener('click', () => save(true));
        actions.appendChild(checkButton);
        box.appendChild(actions);

        const options = el('div', { className: 'dc-info-options' });
        const showOption = el('div', { className: 'dc-info-option' });
        showOption.appendChild(el('label', { htmlFor: 'dc-info-enabled' }, 'Show bar'));
        const enabled = el('input', { id: 'dc-info-enabled', type: 'checkbox' });
        enabled.checked = data.enabled;
        showOption.appendChild(enabled);
        options.appendChild(showOption);

        const colorOption = el('div', { className: 'dc-info-option' });
        colorOption.appendChild(el('label', { htmlFor: 'dc-info-color' }, 'Bar color'));
        const color = el('input', {
            id: 'dc-info-color',
            className: 'input-text br-15',
            type: 'text',
            placeholder: '#00000080'
        });
        color.value = data.color;
        colorOption.appendChild(color);
        options.appendChild(colorOption);
        box.appendChild(options);

        box.appendChild(el('div', { id: 'dc-info-status' }));
        wrap.appendChild(box);
        wrap.appendChild(el('hr', { style: 'width: 20%; border-color: var(--color-5-transparent);' }));
        container.appendChild(wrap);
        refreshSetupText();
    }

    window.addEventListener('resize', () => {
        clearTimeout(resizeHandle);
        resizeHandle = setTimeout(measureRun, 150);
    });

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await requestConfig(window.location.pathname.startsWith('/setup'));
        } catch (err) {
            console.warn('Info Bar:', err);
        }

        if (window.location.pathname.startsWith('/setup')) {
            settings();
            return;
        }

        paintInfoBar();
        poll();
    });

    window.InfoBar = {
        reload: async () => {
            await requestConfig(false);
            paintInfoBar();
        },
        recalc: measureRun
    };
})();
