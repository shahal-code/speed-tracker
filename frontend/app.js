document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const mainSpeed = document.getElementById('main-speed');
    const mainUnit = document.getElementById('main-unit');
    const btnMoreInfo = document.getElementById('btn-more-info');
    const btnRestart = document.getElementById('btn-restart');
    const extraMetrics = document.getElementById('extra-metrics');
    const valLatency = document.getElementById('val-latency');
    const valUpload = document.getElementById('val-upload');
    const statusIcon = document.getElementById('status-icon');
    const extraProgress = document.getElementById('extra-progress');

    // Constants
    const TEST_DURATION = 6000; // 6 seconds for primary test
    const LATENCY_SAMPLES = 10;
    
    let isTesting = false;

    // Helper: Random number for flickering effect
    function getFlickerValue(currentValue) {
        const variation = currentValue * 0.05; // 5% variation
        return currentValue + (Math.random() * variation * 2 - variation);
    }

    // Measure Latency (Ping)
    async function measureLatency() {
        let pings = [];
        for (let i = 0; i < LATENCY_SAMPLES; i++) {
            const start = performance.now();
            try {
                await fetch(`${window.BACKEND_URL}/ping?t=${Date.now()}`);
                pings.push(performance.now() - start);
            } catch (e) { console.error('Ping error:', e); }
            await new Promise(r => setTimeout(r, 100)); // gap between pings
        }
        const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
        return avgPing;
    }

    // Measure Download
    async function measureDownload() {
        isTesting = true;
        document.body.classList.add('testing');
        statusIcon.classList.add('active');
        
        const startTime = performance.now();
        let loaded = 0;
        let speeds = [];
        let displayValue = 0;

        // Flicker interval for realism
        const flickerInterval = setInterval(() => {
            if (displayValue > 0) {
                mainSpeed.innerText = Math.round(getFlickerValue(displayValue));
            }
        }, 80);

        try {
            const response = await fetch(`${window.BACKEND_URL}/download?t=${Date.now()}`);
            const reader = response.body.getReader();

            while (performance.now() - startTime < TEST_DURATION) {
                const {done, value} = await reader.read();
                if (done) break;

                loaded += value.length;
                const currentTime = performance.now();
                const mbps = (loaded * 8) / (currentTime - startTime) / 1000;
                
                if (mbps > 0.1) {
                    speeds.push(mbps);
                    displayValue = mbps;
                }
            }
            reader.cancel();
        } catch(e) { console.error('Download error:', e); }

        clearInterval(flickerInterval);
        
        const finalSpeed = speeds.length > 3 ? 
            speeds.slice(Math.floor(speeds.length/2)).reduce((a,b)=>a+b)/Math.ceil(speeds.length/2) : 
            (speeds.length > 0 ? speeds[speeds.length-1] : 0);
        
        mainSpeed.innerText = Math.round(finalSpeed);
        document.body.classList.remove('testing');
        btnMoreInfo.hidden = false;
        isTesting = false;
        
        return finalSpeed;
    }

    // Measure Upload
    async function measureUpload() {
        const chunk = new Uint8Array(1024 * 1024 * 2); // 2 MB chunks for upload
        const startTime = performance.now();
        let totalUploaded = 0;
        let speeds = [];

        try {
            while (performance.now() - startTime < TEST_DURATION) {
                const sTime = performance.now();
                await fetch(`${window.BACKEND_URL}/upload`, {
                    method: 'POST',
                    body: chunk,
                    headers: { 'Content-Type': 'application/octet-stream' }
                });
                const eTime = performance.now();
                
                totalUploaded += chunk.length;
                const mbps = (totalUploaded * 8) / (eTime - startTime) / 1000;
                speeds.push(mbps);
                
                // Update progress bar
                const p = Math.min(100, ((eTime - startTime) / TEST_DURATION) * 100);
                extraProgress.style.width = `${p}%`;
                
                valUpload.innerText = mbps.toFixed(1);
            }
        } catch(e) { console.error('Upload error:', e); }

        const finalSpeed = speeds.length > 0 ? speeds.reduce((a,b)=>a+b)/speeds.length : 0;
        valUpload.innerText = finalSpeed.toFixed(1);
        extraProgress.style.width = `100%`;
        return finalSpeed;
    }

    // Run Full "Show More" Sequence
    async function runExtraMetrics() {
        extraMetrics.classList.remove('hidden');
        btnMoreInfo.disabled = true;
        
        // 1. Measure Latency
        valLatency.innerText = 'measuring...';
        const ping = await measureLatency();
        valLatency.innerText = Math.round(ping);
        
        // 2. Measure Upload
        valUpload.innerText = '...';
        await measureUpload();
        
        btnMoreInfo.innerText = "Results updated";
    }

    // UI Events
    btnMoreInfo.addEventListener('click', runExtraMetrics);
    
    btnRestart.addEventListener('click', () => {
        location.reload();
    });

    // AUTO-START
    setTimeout(measureDownload, 1000); // Small delay for visual impact
});
