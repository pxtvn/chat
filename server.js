const WebSocket = require('ws');

// Danh sách các màu sắc đẹp, có độ tương phản tốt trên nền tối
const USER_COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', 
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFAB91', '#B2DFDB',
    '#C5E1A5', '#E6EE9C', '#FFF59D', '#FFE082', '#FFCC80'
];

const wss = new WebSocket.Server({ port: 8080 });

function broadcast(data) {
    const messageString = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

wss.on('connection', ws => {
    // Gán tên người dùng và MÀU SẮC MỚI
    ws.username = `User ${Math.floor(10000 + Math.random() * 90000)}`;
    // Chọn một màu dựa trên số lượng client, đảm bảo màu sắc được phân bổ
    ws.color = USER_COLORS[(wss.clients.size - 1) % USER_COLORS.length];

    console.log(`${ws.username} connected with color ${ws.color}.`);
    broadcast({
        type: 'system',
        content: `${ws.username} has joined the chat.`
    });

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);
            data.username = ws.username;
            data.color = ws.color; // **Gắn màu của người gửi vào tin nhắn**

            broadcast(data);
            console.log(`Received ${data.type} from ${ws.username}`);

        } catch (error) {
            console.error('Invalid message format:', message);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected.`);
        broadcast({
            type: 'system',
            content: `${ws.username} has left the chat.`
        });
    });
});

console.log('WebSocket server started on port 8080');