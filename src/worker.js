addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

function logEvent(type, info = {}) {
    const time = new Date().toISOString();
    const logObj = { time, type, ...info };
    console.log(JSON.stringify(logObj));
}

const GITHUB_URL = 'https://github.com/2010HCY'; // GitHub按钮链接
const BLOG_URL = 'https://100713.xyz'; // 博客链接
const MONITOR_NAME = '站点监测'; // 你要叫什么名字，随便填

const SITES = [ // 自行修改增加要监测的站点
    { url: 'https://100713.xyz', name: '博客主站' },
    { url: 'https://flash.100713.xyz', name: 'Flash收藏站' },
    { url: 'https://music.100713.xyz', name: '音乐空间' },
    { url: 'https://page.100713.xyz', name: 'Page空间' },
    { url: 'https://checkup.100713.xyz', name: '星露谷物语查缺补漏' },
    { url: 'https://predictor.100713.xyz', name: '星露谷物语随机预测器' },
    { url: 'https://owo.100713.xyz/owo.json', name: '评论区表情包' },
    { url: 'https://twikoo.100713.xyz/.netlify/functions/twikoo', name: 'Twikoo评论区' },
    { url: 'https://earth.100713.xyz', name: '地球实时图像' },
];

async function handleRequest(request, env, ctx) {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === '/' || pathname === '/index.html') {
        const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";
        const ua = request.headers.get('user-agent') || "";
        const referer = request.headers.get("referer") || "";
        logEvent("access", { ip, ua, referer, url: request.url });
    }

    if (pathname === "/api/logs") {
        const logsRaw = await env.LOGS.get("logs");
        return new Response(logsRaw || '[]', {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (pathname === "/api/refresh") {
        const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";
        const ua = request.headers.get('user-agent') || "";
        console.log("使用API令牌刷新");
        logEvent("manual-refresh", {
            ip,
            ua,
            url: request.url,
            key: searchParams.get('key') || ""
        });
    
        if (searchParams.get('key') !== env.KEY) {
            return new Response('Forbidden', { status: 403 });
        }
        await refreshAllSiteStatus(env.STATUS, false);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (pathname === "/api/status") {
        return getStatus(env);
    }

    if (request.url.endsWith('/')) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="icon" href="https://100713.xyz/medias/Hlogo徽章.svg">
    <title>${MONITOR_NAME}</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="monitor-name">${MONITOR_NAME}</div>
            <div class="buttons">
                <a href="${GITHUB_URL}" target="_blank" class="button github-button"><i class="fab fa-github"></i> GitHub</a>
                <a href="${BLOG_URL}" target="_blank" class="button blog-button"><i class="fas fa-blog"></i>Blog</a>
            </div>
        </div>
        <div id="status-list">
            <!-- Status items will be added here by JavaScript -->
        </div>
    </div>
    <div id="update-info" style="text-align:center; margin-top:24px; margin-bottom: 20px; color:#555"></div>
    <script src="/script.js"></script>
</body>
</html>`;
        return new Response(htmlContent, {
            headers: { 'Content-Type': 'text/html' , 'Cache-Control': 'public, max-age=1800' },
        });
    }

    if (request.url.endsWith('/script.js')) {
        const scriptContent = `
const statusList = document.getElementById("status-list");
const updateInfo = document.getElementById("update-info");
const refreshInterval = 1800000; // 30分钟
let lastUpdateTime = null;
let nextRefreshTime = null;

function toLocalTime(isoTime) {
    const d = new Date(isoTime);
    return d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0') + ' ' +
        String(d.getHours()).padStart(2,'0') + ':' +
        String(d.getMinutes()).padStart(2,'0') + ':' +
        String(d.getSeconds()).padStart(2,'0');
}

async function fetchStatus() {
    try {
        const response = await fetch("/api/status");
        const data = await response.json();
        lastUpdateTime = data.updateTime;
        if (lastUpdateTime) {
            nextRefreshTime = new Date(lastUpdateTime).getTime() + refreshInterval;
        } else {
            nextRefreshTime = Date.now() + refreshInterval;
        }
        renderStatus(data.sites);
        updateCountdown();
    } catch (error) {
        statusList.innerHTML = '<div class="error">Failed to load status. Please try again later.</div>';
        updateInfo.textContent = "";
    }
}

function renderStatus(sites) {
    statusList.innerHTML = "";
    sites.forEach(site => {
        const statusItem = document.createElement("div");
        statusItem.classList.add("status-item");

        const statusIndicator = document.createElement("div");
        statusIndicator.classList.add("status-indicator");
        statusIndicator.classList.add(site.isUp ? "up" : "down");

        const websiteName = document.createElement("a");
        websiteName.classList.add("website-name");
        websiteName.textContent = site.name;
        websiteName.href = site.url;
        websiteName.target = "_blank";

        const statusText = document.createElement("span");
        statusText.textContent = site.isUp ? "正常" : "异常";
        statusText.classList.add(site.isUp ? "up" : "down");
        statusText.style.marginRight = "10px";
        statusText.style.marginLeft = "10px";

        const statusBars = document.createElement('div');
        statusBars.classList.add('status-bars');
        const last50History = site.history.slice(-50);
        for (let i = 49; i >= 0; i--) {
            const bar = document.createElement('div');
            bar.classList.add('status-bar');
            if (last50History[49 - i] !== undefined) {
                bar.classList.add(last50History[49 - i] === 1 ? 'up' : 'down');
            }
            statusBars.appendChild(bar);
        }
        const upCount = site.history.filter(status => status === 1).length;
        const overallPercentage = site.history.length > 0 ? ((upCount / site.history.length) * 100).toFixed(2) + "%" : "N/A";
        const percentageDisplay = document.createElement("div");
        percentageDisplay.classList.add("percentage-display");
        percentageDisplay.textContent = overallPercentage;

        statusItem.appendChild(statusIndicator);
        statusItem.appendChild(websiteName);
        statusItem.appendChild(statusText);
        statusItem.appendChild(statusBars);
        statusItem.appendChild(percentageDisplay);
        statusList.appendChild(statusItem);
    });
}

function updateCountdown() {
    let text1 = '';
    let text2 = '';
    if (lastUpdateTime) {
        text1 = "更新时间: " + toLocalTime(lastUpdateTime);
        const now = Date.now();
        let timeLeft = nextRefreshTime - now;
        if (timeLeft < 0) timeLeft = 0;
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        text2 = "将于 " + minutes + ":" + seconds.toString().padStart(2, '0') + " 后刷新";
    }
    updateInfo.innerHTML = text1 + "<br>" + text2;
}

fetchStatus(); // 首次加载
setInterval(updateCountdown, 1000);
`;
        return new Response(scriptContent, {
            headers: { 'Content-Type': 'application/javascript' , 'Cache-Control': 'public, max-age=86400' },
        });
    }

    if (request.url.endsWith('/style.css')) {
        const styleContent = `
body {
    font-family: sans-serif;
    background-color: #f0f0f0;
    margin: 0;
    padding: 0;
}
.container {
    max-width: 800px;
    margin: 20px auto;
    padding: 20px;
    background-color: #fff;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
}
.monitor-name {
    font-size: 24px;
    font-weight: bold;
    margin-right: 10px;
}
a {
    color: oklch(0.55 0.12 112);
    text-decoration: none;
    position: relative;
}
.countdown {
    margin-right: auto;
}
.buttons {
    display: flex;
}
.button {
    padding: 8px 16px;
    margin-left: 10px;
    border-radius: 5px;
    text-decoration: none;
    color: #fff;
    font-weight: bold;
}
.github-button {
    background-color: #8cc269;
}
.blog-button {
    background-color: #d2d97a;
}
.status-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 5px;
    border: 1px solid #ddd;
    position: relative;
}
.status-item:hover {
    background-color: #f9f9f9;
}
.status-item .status-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-right: 10px;
}
.status-item .status-indicator.up {
    background-color: green;
}
.status-item .status-indicator.down {
    background-color: red;
}
.status-item .website-name {
    flex-grow: 1;
    font-weight: bold;
    margin-right: 10px;
}
.status-bars {
    display: flex;
    align-items: center;
    margin-left: auto;
}
.status-bar {
    width: 6px;
    height: 10px;
    margin: 0 1px;
    background-color: #ddd;
}
.status-bar.up {
    background-color: green;
}
.status-bar.down {
    background-color: red;
}
.loading,
.error {
    text-align: center;
    font-weight: bold;
    color: #555;
}
.status-link {
    margin-right: 10px;
    color: #007bff;
    text-decoration: none;
    white-space: nowrap;
}
.status-link:hover {
    text-decoration: underline;
}
.percentage-display {
    position: absolute;
    top: 2px;
    right: 5px;
    font-size: 12px;
    color: #555;
}
.progress-bar-container {
    width: 100%;
    height: 20px;
    background-color: #f0f0f0;
    border-radius: 5px;
    overflow: hidden;
    margin: 20px 0;
}
.progress-bar {
    height: 100%;
    width: 0;
    background-color: #4caf50;
    transition: width 0.2s ease;
}
@media (max-width: 600px) {
    .container {
        padding: 10px;
    }
    .header {
        flex-direction: column;
        align-items: stretch;
    }
    .monitor-name{
        margin-right:0;
        margin-bottom:10px;
    }
    .buttons {
        margin-top: 10px;
        justify-content: center;
    }
    .countdown{
        order:-1;
    }
    .status-item {
        flex-direction: column;
        align-items: flex-start;
    }
    .status-bars {
        margin-left: 0;
        margin-top: 10px;
        width: 100%;
    }
     .status-bar {
         flex: 1;
    }
    .percentage-display {
        position: static;
        margin-top: 5px;
        text-align:right;
    }
}`;
        return new Response(styleContent, {
            headers: { 'Content-Type': 'text/css' ,'Cache-Control': 'public, max-age=86400' },
        });
    }

    return new Response('Not Found', { status: 404 });
}

const fetchWithTimeout = async (url, options, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

async function refreshAllSiteStatus(STATUS, isAuto = false) {
    let now = new Date();
    let updateTime = now.toISOString();
    await Promise.all(
        SITES.map(async (site) => {
            const key = `status:${site.url}`;
            let history = [];
            let logDetail = { site: site.url, siteName: site.name };
            let status;
            let isUp = false;
            let reason = '';
            try {
                const response = await fetchWithTimeout(site.url, { method: 'GET', headers: { 'User-Agent': 'Cloudflare-Worker' } }, 10000);
                status = response.status;
                isUp = status === 200;
                let historyString = await STATUS.get(key);
                history = historyString ? JSON.parse(historyString) : [];
                history.push(isUp ? 1 : 0);
                if (history.length > 50) history = history.slice(-50);
                await STATUS.put(key, JSON.stringify(history));
                reason = isUp ? '' : `Status code: ${status}`;
            } catch (error) {
                let historyString = await STATUS.get(key);
                history = historyString ? JSON.parse(historyString) : [];
                if (history.length > 50) history = history.slice(-50);
                history.push(0);
                await STATUS.put(key, JSON.stringify(history));
                status = '-';
                reason = error.message || error.toString();
            }

            let msg = `${site.name} 状态：${status}${isUp ? ' 正常' : ' 异常'}${reason ? '，原因：' + reason : ''}`;
            console.log(msg);
        })
    );
    await STATUS.put("updateTime", updateTime);
}

export default {
    async scheduled(controller, env, ctx) {
        await refreshAllSiteStatus(env.STATUS);
        console.log('cron: refreshed sites status');
    },
    async fetch(request, env, ctx) {
        return handleRequest(request, env, ctx);
    }
}

async function getStatus(env) {
    const updateTime = await env.STATUS.get("updateTime");
    const statusData = await Promise.all(
        SITES.map(async (site) => {
            const key = `status:${site.url}`;
            let historyString = await env.STATUS.get(key);
            let history = historyString ? JSON.parse(historyString) : [];
            const isUp = history.length > 0 ? !!history[history.length-1] : false;
            return { url: site.url, name: site.name, isUp: isUp, history: history };
        })
    );
    return new Response(JSON.stringify({ updateTime, sites: statusData }), {
        headers: { 'Content-Type': 'application/json' },
    });
}