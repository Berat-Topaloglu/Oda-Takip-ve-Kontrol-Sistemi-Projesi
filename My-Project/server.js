const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);

    // Default to index.html for root path
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Dosya Bulunamadı</h1>', 'utf-8');
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Sunucu Hatası: ${error.code}`, 'utf-8');
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 SUNUCU BAŞLATILDI!');
    console.log('='.repeat(60));
    console.log(`📡 Adres: http://localhost:${PORT}`);
    console.log(`📁 Dizin: ${__dirname}`);
    console.log(`⏰ Başlatma Zamanı: ${new Date().toLocaleString('tr-TR')}`);
    console.log('='.repeat(60));
    console.log('Sunucuyu durdurmak için CTRL+C tuşlarına basın.');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Sunucu kapatılıyor...');
    server.close(() => {
        console.log('✅ Sunucu başarıyla kapatıldı.');
        process.exit(0);
    });
});
