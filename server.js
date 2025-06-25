const http = require('http');
const express = require('express'); // THÊM express
const WebSocket = require('ws');
const path = require('path');

const USER_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', 
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFAB91', '#B2DFDB'
];

// Khởi tạo ứng dụng express
const app = express();
// Phục vụ các file tĩnh từ thư mục 'public'
// Giờ đây các file trong public/sounds/ hoặc public/stickers/ đều có thể truy cập được
app.use(express.static(path.join(__dirname, 'public')));

// Phục vụ file index.html khi người dùng truy cập vào trang chính
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// THÊM MỚI: Route để phục vụ file Service Worker
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Tạo server HTTP từ ứng dụng express
const server = http.createServer(app);
// Gắn WebSocket server vào HTTP server
const wss = new WebSocket.Server({ server });

// Toàn bộ logic WebSocket từ đây trở xuống không thay đổi
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

