const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// REMOVED: Serving frontend static files is now handled separately on frontend hosting (S3/CloudFront)

// Create a 20MB buffer for the download test to simulate a large payload
const DOWNLOAD_SIZE = 20 * 1024 * 1024; // 20 MB
const downloadBuffer = crypto.randomBytes(DOWNLOAD_SIZE);

// 1. Ping endpoint (lightweight response for latency measurement)
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// 2. Download endpoint (sends 20MB data payload)
app.get('/download', (req, res) => {
    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': downloadBuffer.length
    });
    res.status(200).send(downloadBuffer);
});

// 3. Upload endpoint (accepts up to 50MB streams without crashing)
app.post('/upload', express.raw({ limit: '50mb', type: '*/*' }), (req, res) => {
    if (!req.body) {
        return res.status(400).send('No data received');
    }
    // Respond with amount of data received to verify
    res.status(200).json({ receivedBytes: req.body.length });
});

app.listen(PORT, () => {
    console.log(`Speed Test server running on http://localhost:${PORT}`);
});
