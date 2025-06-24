const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

// Danh sách các màu sắc đẹp, có độ tương phản tốt trên nền tối
const USER_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', 
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFAB91', '#B2DFDB',
    '#C5E1A5', '#E6EE9C', '#FFF59D', '#FFE082', '#FFCC80'
];

// **BƯỚC 1: TẠO LẠI HTTP SERVER**
// Server này sẽ xử lý cả việc phục vụ file HTML và các kết nối WebSocket
const server = http.createServer((req, res) => {
    // Chỉ phục vụ file index.html khi người dùng truy cập trang chính
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

// **BƯỚC 2: GẮN WEBSOCKET SERVER VÀO HTTP SERVER ĐÃ CÓ**
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
    // Logic gán tên và màu sắc người dùng (giữ nguyên, đã đúng)
    ws.username = `User ${Math.floor(10000 + Math.random() * 90000)}`;
    ws.color = USER_COLORS[(wss.clients.size - 1) % USER_COLORS.length];

    console.log(`${ws.username} connected with color ${ws.color}.`);
    broadcast({ type: 'system', content: `${ws.username} has joined the chat.` });

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);
            data.username = ws.username;
            data.color = ws.color;
            broadcast(data);
        } catch (error) {
            console.error('Invalid message format:', message);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected.`);
        broadcast({ type: 'system', content: `${ws.username} has left the chat.` });
    });
});

// **BƯỚC 3: KHỞI ĐỘNG HTTP SERVER**
// Render sẽ cung cấp cổng qua biến môi trường. 10000 là cổng mặc định được Render khuyên dùng.
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});