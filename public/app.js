document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const btnStart = document.getElementById('btn-start');
    const valDownload = document.getElementById('val-download');
    const valUpload = document.getElementById('val-upload');
    
    const liveSpeed = document.getElementById('live-speed');
    const liveUnit = document.getElementById('live-unit');
    const statusText = document.getElementById('status-text');
    const loaderDownload = document.getElementById('loader-download');
    const loaderUpload = document.getElementById('loader-upload');

    const speedProgress = document.getElementById('speed-progress');
    const needle = document.getElementById('needle');
    
    const svgTicks = document.getElementById('ticks-container');
    const svgLabels = document.getElementById('labels-container');
    const historyList = document.getElementById('history-list');

    // Constants
    const TEST_DURATION = 5000; // 5 seconds per phase
    const ARC_LENGTH = 251.2;
    let MAX_SPEED = 1000; // global gigabit limit
    let lastScale = 1000;

    // Draw Speedometer Ticks & Labels
    function drawTicks(targetScale = MAX_SPEED) {
        svgTicks.innerHTML = '';
        svgLabels.innerHTML = '';
        const numTicks = 30; // More ticks for precision
        const numLabels = 6;  // 0, 200, 400, 600, 800, 1000 (example)
        
        for (let i = 0; i <= numTicks; i++) {
            const angle = Math.PI - (i * Math.PI) / numTicks;
            const isMajor = i % (numTicks / (numLabels - 1)) === 0;
            
            const r1 = isMajor ? 70 : 74;
            const r2 = 80;
            
            const x1 = 100 + r1 * Math.cos(angle);
            const y1 = 100 - r1 * Math.sin(angle);
            const x2 = 100 + r2 * Math.cos(angle);
            const y2 = 100 - r2 * Math.sin(angle);
    
            const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
            tick.setAttribute("x1", x1);
            tick.setAttribute("y1", y1);
            tick.setAttribute("x2", x2);
            tick.setAttribute("y2", y2);
            tick.className.baseVal = isMajor ? "tick major" : "tick";
            tick.dataset.index = i;
            svgTicks.appendChild(tick);
            
            if (isMajor) {
                const labelVal = Math.round((i / numTicks) * targetScale);
                const rx = 100 + 60 * Math.cos(angle);
                const ry = 100 - 60 * Math.sin(angle);
                
                const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
                txt.setAttribute("x", rx);
                txt.setAttribute("y", ry);
                txt.textContent = labelVal;
                svgLabels.appendChild(txt);
            }
        }
    }
    drawTicks();

    // Reset UI
    function resetUI() {
        liveSpeed.innerText = '0.00';
        updateDial(0);
        document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('active'));
        loaderDownload.style.width = '0%';
        loaderUpload.style.width = '0%';
    }

    // Update Speedometer UI
    function updateDial(value, maxScale = MAX_SPEED) {
        // dynamic scaling if speed exceeds max
        const oldMax = MAX_SPEED;
        
        // If we are passed a specific max (like 100 for ping), use that.
        // Otherwise, use and grow the session's MAX_SPEED.
        if (value > MAX_SPEED) {
            while(value > MAX_SPEED) { MAX_SPEED *= 2; }
        }
        
        const currentScale = Math.max(MAX_SPEED, maxScale);
        
        if (currentScale !== lastScale) {
            lastScale = currentScale;
            drawTicks(currentScale); // Redraw labels for the current scale
        }

        // value maps to 0..1
        let ratio = value / currentScale;
        ratio = Math.max(0, Math.min(1, ratio));

        // Offset: 251.2 (0%) to 0 (100%)
        speedProgress.style.strokeDashoffset = ARC_LENGTH - (ratio * ARC_LENGTH);
        
        // Needle angle: -90 (0%) to 90 (100%)
        const angle = -90 + (ratio * 180);
        needle.setAttribute('transform', `rotate(${angle} 100 100)`);
        
        // Highlight ticks
        const numTicks = 30;
        const activeCount = Math.floor(ratio * numTicks);
        const allTicks = svgTicks.querySelectorAll('.tick');
        allTicks.forEach((t, idx) => {
            if (idx <= activeCount) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        liveSpeed.innerText = value.toFixed(2);
    }

    // Sleep Helper
    const sleep = ms => new Promise(r => setTimeout(r, ms));


    // Measure Download
    async function measureDownload() {
        statusText.innerText = "Testing Download Speed...";
        document.getElementById('card-download').classList.add('active');
        liveUnit.innerText = 'Mbps';
        
        const startTime = performance.now();
        let loaded = 0;
        let lastTime = startTime;
        let speeds = [];

        try {
            const response = await fetch(`/download?t=${Date.now()}`);
            const reader = response.body.getReader();

            while (performance.now() - startTime < TEST_DURATION) {
                const {done, value} = await reader.read();
                if (done) break;

                loaded += value.length;
                const currentTime = performance.now();
                const diffTime = (currentTime - lastTime) / 1000;
                
                if (diffTime > 0.1) {
                    const mbps = (loaded * 8) / (currentTime - startTime) / 1000;
                    speeds.push(mbps);
                    updateDial(mbps);
                    lastTime = currentTime;
                    
                    const p = Math.min(100, ((currentTime - startTime) / TEST_DURATION) * 100);
                    loaderDownload.style.width = `${p}%`;
                }
            }
            // Cancel stream early to stop downloading if time exceeds
            reader.cancel();
        } catch(e) { console.error('Download error:', e); }

        const finalSpeed = speeds.length > 0 ? speeds.reduce((a,b)=>a+b)/speeds.length : 0;
        valDownload.innerText = finalSpeed.toFixed(2);
        
        document.getElementById('card-download').classList.remove('active');
        loaderDownload.style.width = `100%`;
        updateDial(0);
        return finalSpeed;
    }

    // Measure Upload
    async function measureUpload() {
        statusText.innerText = "Testing Upload Speed...";
        document.getElementById('card-upload').classList.add('active');
        liveUnit.innerText = 'Mbps';

        // we will generate chunks and upload continuously for TEST_DURATION
        const chunk = new Uint8Array(1024 * 1024 * 5); // 5 MB chunks
        const startTime = performance.now();
        let totalUploaded = 0;
        let speeds = [];

        try {
            while (performance.now() - startTime < TEST_DURATION) {
                const sTime = performance.now();
                await fetch(`/upload`, {
                    method: 'POST',
                    body: chunk,
                    headers: { 'Content-Type': 'application/octet-stream' }
                });
                const eTime = performance.now();
                
                totalUploaded += chunk.length;
                const mbps = (totalUploaded * 8) / (eTime - startTime) / 1000;
                speeds.push(mbps);
                
                updateDial(mbps);
                const p = Math.min(100, ((eTime - startTime) / TEST_DURATION) * 100);
                loaderUpload.style.width = `${p}%`;
            }
        } catch(e) { console.error('Upload error:', e); }

        const finalSpeed = speeds.length > 0 ? speeds.reduce((a,b)=>a+b)/speeds.length : 0;
        valUpload.innerText = finalSpeed.toFixed(2);
        
        document.getElementById('card-upload').classList.remove('active');
        loaderUpload.style.width = `100%`;
        updateDial(0);
        return finalSpeed;
    }

    // History Functions
    function saveHistory(dl, ul) {
        let history = JSON.parse(localStorage.getItem('neon_speed_history') || '[]');
        history.unshift({
            date: new Date().toLocaleString(),
            dl: dl.toFixed(2),
            ul: ul.toFixed(2)
        });
        if(history.length > 5) history.pop();
        localStorage.setItem('neon_speed_history', JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        let history = JSON.parse(localStorage.getItem('neon_speed_history') || '[]');
        historyList.innerHTML = '';
        history.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="hist-date">${item.date}</div>
                <div class="hist-metrics">
                    <span class="down">↓${item.dl} Mbps</span>
                    <span class="up">↑${item.ul} Mbps</span>
                </div>
            `;
            historyList.appendChild(li);
        });
    }

    // Run Test Sequence
    btnStart.addEventListener('click', async () => {
        btnStart.disabled = true;
        btnStart.innerText = "TESTING...";
        resetUI();

        const dl = await measureDownload();
        await sleep(500);
        
        const ul = await measureUpload();
        
        statusText.innerText = "Test Complete!";
        btnStart.innerText = "TEST AGAIN";
        btnStart.disabled = false;
        
        saveHistory(dl, ul);
    });

    renderHistory();
});
