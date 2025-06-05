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