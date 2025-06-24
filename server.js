const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    fs.readFile('index.html', (err, data) => {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading index.html');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server });

// Hàm gửi tin nhắn tới tất cả client
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', ws => {
    // TÍNH NĂNG MỚI: Tạo tên người dùng ngẫu nhiên gồm 5 chữ số
    const randomNumber = Math.floor(10000 + Math.random() * 90000);
    ws.username = `User ${randomNumber}`;

    console.log(`${ws.username} connected.`);
    // Thông báo cho mọi người có người mới tham gia
    broadcast(`system:${ws.username} has joined the chat.`);

    ws.on('message', message => {
        const messageString = message.toString();

        // TÍNH NĂNG MỚI: Xử lý yêu cầu xóa lịch sử chat
        if (messageString === '__CLEAR_CHAT__') {
            console.log(`Chat history cleared by a user.`);
            // Gửi tín hiệu xóa đến tất cả client
            broadcast('__CLEAR_CHAT_CONFIRMED__');
        } else {
            // Thêm tên người gửi vào trước tin nhắn
            console.log(`Message from ${ws.username}: ${messageString}`);
            broadcast(`${ws.username}: ${messageString}`);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected.`);
        // Thông báo cho mọi người có người đã rời đi
        broadcast(`system:${ws.username} has left the chat.`);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});