const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

// 1. Tạo một server HTTP để phục vụ file HTML
const server = http.createServer((req, res) => {
    fs.readFile('index.html', (err, data) => {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading index.html');
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(data);
    });
});

// 2. Tạo một server WebSocket
const wss = new WebSocket.Server({ server });

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('message', message => {
        broadcast(message.toString());
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// 3. Khởi chạy server trên cổng của Render hoặc cổng 8080 ở local
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});