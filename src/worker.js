addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

function logEvent(type, info = {}) {
    const time = new Date().toISOString();
    const logObj = { time, type, ...info };
    console.log(JSON.stringify(logObj));
}

const SITES = [ // 自行修改增加要监测的站点
    { url: 'https://teahush.link', name: '博客主站' },
    { url: 'https://flash.teahush.link', name: 'Flash收藏站' },
    { url: 'https://music.teahush.link', name: '音乐空间' },
    { url: 'https://page.teahush.link', name: 'Page空间' },
    { url: 'https://checkup.teahush.link', name: '星露谷物语查缺补漏' },
    { url: 'https://predictor.teahush.link', name: '星露谷物语随机预测器' },
    { url: 'https://owo.teahush.link/owo.json', name: '评论区表情包' },
    { url: 'https://twikoo.teahush.link/.netlify/functions/twikoo', name: 'Twikoo评论区' },
    { url: 'https://earthcdn.teahush.link/latest.png', name: '地球实时图像' },
];

async function handleRequest(request, env, ctx) {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === '/' || pathname === '/index.html') {
        const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";
        const ua = request.headers.get('user-agent') || "";
        const referer = request.headers.get("referer") || "";
        logEvent("access", { ip, ua, referer, url: request.url });
        
        const ifNoneMatch = request.headers.get('If-None-Match');
        const etag = `"${MONITOR_NAME}-v1"`;
        
        if (ifNoneMatch === etag) {
            return new Response(null, {
                status: 304,
                headers: {
                    'ETag': etag,
                    'Cache-Control': 'public, max-age=1800',
                }
            });
        }
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

if (pathname === '/' || pathname === '/index.html' || pathname.match(/\.(js|css|png|jpg|gif|svg|ico)$/)) {
    if (pathname === '/' || pathname === '/index.html') {
        const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";
        const ua = request.headers.get('user-agent') || "";
        const referer = request.headers.get("referer") || "";
        logEvent("access", { ip, ua, referer, url: request.url });
        
        const ifNoneMatch = request.headers.get('If-None-Match');
        const etag = `"${MONITOR_NAME}-v1"`;
        
        if (ifNoneMatch === etag) {
            return new Response(null, {
                status: 304,
                headers: {
                    'ETag': etag,
                    'Cache-Control': 'public, max-age=1800',
                }
            });
        }
    }
    
    try {
        let assetPath = pathname === '/' ? '/index.html' : pathname;
        
        let asset = await env.ASSETS.fetch(new Request(new URL(assetPath, request.url)));
        
        if (asset.status === 200) {
            
            if (assetPath.endsWith('.html')) {
                response.headers.set('Cache-Control', 'public, max-age=1800');
                response.headers.set('ETag', `"${MONITOR_NAME}-v1"`);
            } else if (assetPath.endsWith('.js')) {
                response.headers.set('Cache-Control', 'public, max-age=86400');
                response.headers.set('ETag', `"${MONITOR_NAME}-js-v1"`);
            } else if (assetPath.endsWith('.css')) {
                response.headers.set('Cache-Control', 'public, max-age=86400');
                response.headers.set('ETag', `"${MONITOR_NAME}-css-v1"`);
            }
            
            return response;
        }
    } catch (error) {
        console.error(`Error serving asset ${pathname}:`, error);
    }
}

    return new Response('Not Found', { status: 404 });
}

const fetchWithTimeout = async (url, options, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const headers = {
        'User-Agent': 'Status/1.0',
        ...(options?.headers || {})
    };
    try {
        const response = await fetch(url, { ...options, headers, signal: controller.signal });
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
    let batchSites = [];
    
    await Promise.all(
        SITES.map(async (site) => {
            let status, isUp = false, reason = '';
            try {
                const response = await fetchWithTimeout(site.url, { method: 'GET' }, 10000);
                status = response.status;
                isUp = status === 200;
                reason = isUp ? '' : `Status code: ${status}`;
            } catch (error) {
                status = '-';
                reason = error.message || error.toString();
            }
            batchSites.push({
                url: site.url,
                name: site.name,
                status,
                isUp,
                reason
            });

            let msg = `${site.name} 状态：${status}${isUp ? ' 正常' : ' 异常'}${reason ? '，原因：' + reason : ''}`;
            console.log(msg);
        })
    );

    let oldRaw = await STATUS.get('status');
    let fullData = oldRaw ? JSON.parse(oldRaw) : { updateTime: '', sites: [] };

    batchSites.forEach(st => {
        let oldSite = fullData.sites.find(o => o.url === st.url);
        let history = oldSite && oldSite.history ? [...oldSite.history] : [];
        history.push(st.isUp ? 1 : 0);
        if (history.length > 50) history = history.slice(-50);
        st.history = history;
    });

    fullData.updateTime = updateTime;
    fullData.sites = batchSites;

    await STATUS.put('status', JSON.stringify(fullData));
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

let statusCache = { data: null, time: 0 };
const STATUS_CACHE_TTL = 29 * 60 * 1000;

async function getStatus(env) {
    const now = Date.now();
    if (statusCache.data && (now - statusCache.time < STATUS_CACHE_TTL)) {
        console.log("状态缓存命中");
        
        const data = JSON.parse(statusCache.data);
        const updateTime = new Date(data.updateTime).getTime();
        const timeUntilNextUpdate = Math.max(0, Math.min(60, Math.floor((updateTime + 30*60*1000 - now)/1000)));
        
        return new Response(statusCache.data, { 
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${timeUntilNextUpdate}`,
                'X-Cache': 'HIT',
                'X-Cache-Time': new Date(statusCache.time).toISOString()
            } 
        });
    }
    
    console.log("状态缓存未命中");
    const raw = await env.STATUS.get('status');
    if (raw && raw !== '{"updateTime":"无数据","sites":[]}') {
        statusCache.data = raw;
        statusCache.time = now;
        
        const data = JSON.parse(raw);
        const updateTime = new Date(data.updateTime).getTime();
        const timeUntilNextUpdate = Math.max(0, Math.min(60, Math.floor((updateTime + 30*60*1000 - now)/1000)));
        
        return new Response(raw, { 
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${timeUntilNextUpdate}`,
                'X-Cache': 'MISS'
            } 
        });
    } else {
        return new Response('{"updateTime":"无数据","sites":[]}', { 
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            } 
        });
    }
}