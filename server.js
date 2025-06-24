const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const USER_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', 
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFAB91', '#B2DFDB',
    '#C5E1A5', '#E6EE9C', '#FFF59D', '#FFE082', '#FFCC80'
];

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile('index.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

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
    ws.username = `User ${Math.floor(10000 + Math.random() * 90000)}`;
    ws.color = USER_COLORS[(wss.clients.size - 1) % USER_COLORS.length];

    console.log(`${ws.username} connected with color ${ws.color}.`);
    broadcast({ type: 'system', content: `${ws.username} has joined the chat.` });

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);

            // **LOGIC MỚI: Xử lý các loại tin nhắn khác nhau**
            switch (data.type) {
                case 'clear_request':
                    // Nếu là yêu cầu xóa, gửi lại tín hiệu xác nhận cho tất cả client
                    console.log(`Chat history cleared by ${ws.username}`);
                    broadcast({ type: 'clear_confirmed' });
                    break;
                case 'text':
                case 'sticker':
                    // Nếu là tin nhắn text/sticker, gắn thông tin người gửi và gửi đi
                    data.username = ws.username;
                    data.color = ws.color;
                    broadcast(data);
                    break;
            }
        } catch (error) {
            console.error('Invalid message format:', message);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected.`);
        broadcast({ type: 'system', content: `${ws.username} has left the chat.` });
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});