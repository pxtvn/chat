const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const USER_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', 
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFAB91', '#B2DFDB'
];

// 1. Khởi tạo ứng dụng express
const app = express();

// 2. Cấu hình express để phục vụ các file tĩnh (icons, sounds, manifest) từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 3. Cấu hình express để phục vụ file PWA Service Worker
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// 4. Cấu hình express để phục vụ file index.html cho tất cả các request còn lại
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. Tạo server HTTP DUY NHẤT từ ứng dụng express đã được cấu hình
const server = http.createServer(app);

// 6. Gắn WebSocket server vào HTTP server đó
const wss = new WebSocket.Server({ server });

// --- Toàn bộ logic WebSocket giữ nguyên, không thay đổi ---
function broadcast(data) {
    const messageString = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

wss.on('connection', ws => {
    ws.username = `User ${Math.floor(10000 + Math.random() * 90000)}`;
    ws.color = USER_COLORS[(wss.clients.size - 1) % USER_COLORS.length];
    broadcast({ type: 'system', content: `${ws.username} has joined the chat.` });

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);
            switch (data.type) {
                case 'clear_request':
                    broadcast({ type: 'clear_confirmed' });
                    break;
                case 'text':
                    data.username = ws.username;
                    data.color = ws.color;
                    broadcast(data);
                    break;
            }
        } catch (error) { console.error('Invalid message format'); }
    });

    ws.on('close', () => {
        broadcast({ type: 'system', content: `${ws.username} has left the chat.` });
    });
});
// --- Kết thúc logic WebSocket ---

// 7. Khởi động server HTTP (Render sẽ cung cấp cổng)
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));