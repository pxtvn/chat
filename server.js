const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const USER_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', 
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFAB91', '#B2DFDB'
];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(data) {
    const messageString = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

wss.on('connection', ws => {
    console.log('Client connected, waiting for username.');
    // Ban đầu, chưa gán tên, chỉ chờ client gửi đến

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);

            // THÊM MỚI: Xử lý khi client gửi tên
            if (data.type === 'set_username') {
                // Gán tên và màu cho kết nối này
                ws.username = data.content;
                ws.color = USER_COLORS[wss.clients.size % USER_COLORS.length];
                console.log(`${ws.username} has set their name with color ${ws.color}.`);
                // Thông báo cho mọi người có người mới tham gia
                broadcast({ type: 'system', content: `${ws.username} has joined the chat.` });
                return; // Dừng lại sau khi đã đặt tên
            }

            // Nếu kết nối chưa có tên, không xử lý các tin nhắn khác
            if (!ws.username) {
                return;
            }

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
        } catch (error) { console.error('Invalid message format:', error); }
    });

    ws.on('close', () => {
        // Chỉ thông báo nếu người dùng đã đặt tên
        if (ws.username) {
            console.log(`${ws.username} disconnected.`);
            broadcast({ type: 'system', content: `${ws.username} has left the chat.` });
        } else {
            console.log('A client disconnected before setting a name.');
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));