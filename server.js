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

// Hàm gửi tin nhắn cho tất cả mọi người
function broadcast(data) {
    const messageString = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(messageString);
    });
}

// THÊM MỚI: Hàm lấy và gửi danh sách người dùng hiện tại
function broadcastUserList() {
    const userList = [];
    wss.clients.forEach(client => {
        // Chỉ thêm những user đã đặt tên vào danh sách
        if (client.username) {
            userList.push({ username: client.username, color: client.color });
        }
    });
    // Gửi danh sách này đi với type là 'user_list'
    broadcast({ type: 'user_list', users: userList });
}

wss.on('connection', ws => {
    console.log('Client connected, waiting for username.');

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);

            if (data.type === 'set_username') {
                ws.username = data.content;
                ws.color = USER_COLORS[wss.clients.size % USER_COLORS.length];
                console.log(`${ws.username} has set their name.`);
                
                // Gửi thông báo hệ thống và CẬP NHẬT DANH SÁCH USER
                broadcast({ type: 'system', content: `${ws.username} has joined the chat.` });
                broadcastUserList(); // Gửi danh sách mới nhất
                return;
            }

            if (!ws.username) return;

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
        if (ws.username) {
            console.log(`${ws.username} disconnected.`);
            // Gửi thông báo hệ thống và CẬP NHẬT DANH SÁCH USER
            broadcast({ type: 'system', content: `${ws.username} has left the chat.` });
            broadcastUserList(); // Gửi danh sách mới nhất
        } else {
            console.log('A client disconnected before setting a name.');
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));