const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Cấu trúc dữ liệu mới ---
const rooms = {}; // Lưu trữ tất cả các phòng: { roomName: { clients: Set(), password: '...' } }
const USER_COLORS = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];

// --- Cài đặt Express ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- Các hàm broadcast được cập nhật ---
function broadcastRoomList() {
    const roomList = Object.keys(rooms).map(roomName => ({
        name: roomName,
        isProtected: !!rooms[roomName].password, // true nếu có mật khẩu
        userCount: rooms[roomName].clients.size
    }));
    broadcastToAll({ type: 'room_list_update', rooms: roomList });
}

function broadcastToRoom(roomName, data, sender) {
    const room = rooms[roomName];
    if (!room) return;
    const message = JSON.stringify(data);
    room.clients.forEach(client => {
        // Gửi cho tất cả mọi người trong phòng (có thể bao gồm cả người gửi)
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastToAll(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

// --- Xử lý kết nối ---
wss.on('connection', ws => {
    console.log('Client connected.');

    ws.on('message', message => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'set_username':
                ws.username = data.content;
                ws.color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
                console.log(`${ws.username} set their name.`);
                // Gửi danh sách phòng ban đầu cho người dùng mới
                ws.send(JSON.stringify({
                    type: 'room_list_update',
                    rooms: Object.keys(rooms).map(roomName => ({
                        name: roomName,
                        isProtected: !!rooms[roomName].password,
                        userCount: rooms[roomName].clients.size
                    }))
                }));
                break;
            
            case 'create_room':
                if (rooms[data.roomName]) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room name already exists.' }));
                    return;
                }
                rooms[data.roomName] = {
                    clients: new Set(),
                    password: data.password || null
                };
                console.log(`Room "${data.roomName}" created.`);
                broadcastRoomList();
                // Tự động cho người tạo vào phòng luôn
                joinRoom(ws, data.roomName);
                break;

            case 'join_room':
                const room = rooms[data.roomName];
                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
                    return;
                }
                if (room.password && room.password !== data.password) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Incorrect password.' }));
                    return;
                }
                joinRoom(ws, data.roomName);
                break;

            case 'text':
                if (ws.currentRoom) {
                    broadcastToRoom(ws.currentRoom, {
                        type: 'text',
                        username: ws.username,
                        color: ws.color,
                        content: data.content
                    }, ws);
                }
                break;
        }
    });

    ws.on('close', () => {
        leaveCurrentRoom(ws);
        console.log('Client disconnected.');
    });
});

function leaveCurrentRoom(ws) {
    if (ws.currentRoom) {
        const room = rooms[ws.currentRoom];
        if (room) {
            room.clients.delete(ws);
            broadcastToRoom(ws.currentRoom, {
                type: 'system',
                content: `${ws.username} has left the room.`
            });
            // Nếu phòng trống, có thể xóa đi (tùy chọn)
            // if (room.clients.size === 0) {
            //     delete rooms[ws.currentRoom];
            // }
        }
        ws.currentRoom = null;
        broadcastRoomList();
    }
}

function joinRoom(ws, roomName) {
    leaveCurrentRoom(ws); // Rời phòng cũ trước
    const room = rooms[roomName];
    room.clients.add(ws);
    ws.currentRoom = roomName;
    
    // Gửi thông báo vào phòng mới
    broadcastToRoom(roomName, {
        type: 'system',
        content: `${ws.username} has joined the room.`
    });

    // Gửi tín hiệu vào phòng thành công cho client
    ws.send(JSON.stringify({ type: 'join_success', roomName: roomName }));
    broadcastRoomList();
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));