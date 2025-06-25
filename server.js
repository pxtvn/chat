const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Cấu trúc dữ liệu ---
const rooms = {}; // { roomName: { clients: Set(), password: '...', deleteTimeout: null } }
const USER_COLORS = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];

// --- Cài đặt Express ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- Các hàm broadcast ---
function broadcastToAll(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

function broadcastToRoom(roomName, data) {
    const room = rooms[roomName];
    if (!room) return;
    const message = JSON.stringify(data);
    room.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

function broadcastStateUpdate() {
    // Gửi cả danh sách phòng và danh sách người dùng toàn cục trong một lần
    const roomList = Object.keys(rooms).map(roomName => ({
        name: roomName,
        isProtected: !!rooms[roomName].password,
        userCount: rooms[roomName].clients.size
    }));

    const globalUserList = [];
    wss.clients.forEach(client => {
        if (client.username) {
            globalUserList.push({
                username: client.username,
                color: client.color,
                currentRoom: client.currentRoom || 'Lobby' // Hiển thị phòng hiện tại hoặc "Lobby"
            });
        }
    });
    
    broadcastToAll({ type: 'state_update', rooms: roomList, users: globalUserList });
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
                broadcastStateUpdate(); // Gửi trạng thái ban đầu
                break;
            
            case 'create_room':
                if (rooms[data.roomName]) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Tên phòng đã tồn tại.' }));
                    return;
                }
                rooms[data.roomName] = { clients: new Set(), password: data.password || null, deleteTimeout: null };
                console.log(`Room "${data.roomName}" created.`);
                joinRoom(ws, data.roomName); // Tự động vào phòng sau khi tạo
                break;

            case 'join_room':
                const roomToJoin = rooms[data.roomName];
                if (!roomToJoin) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Phòng không tồn tại.' }));
                    return;
                }
                if (roomToJoin.password && roomToJoin.password !== data.password) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Sai mật khẩu.' }));
                    return;
                }
                joinRoom(ws, data.roomName);
                break;

            case 'text':
                if (ws.currentRoom) {
                    broadcastToRoom(ws.currentRoom, { type: 'text', username: ws.username, color: ws.color, content: data.content });
                }
                break;
            
            case 'clear_room_history':
                if(ws.currentRoom) {
                    broadcastToRoom(ws.currentRoom, {type: 'clear_confirmed'});
                }
                break;
        }
    });

    ws.on('close', () => {
        if (ws.username) {
            console.log(`${ws.username} disconnected.`);
            leaveCurrentRoom(ws);
        }
    });
});

function leaveCurrentRoom(ws) {
    const roomName = ws.currentRoom;
    if (roomName && rooms[roomName]) {
        const room = rooms[roomName];
        room.clients.delete(ws);
        ws.currentRoom = null;
        
        broadcastToRoom(roomName, { type: 'system', content: `${ws.username} đã rời phòng.` });
        
        // TÍNH NĂNG MỚI: Tự động xóa phòng sau 3 phút nếu trống
        if (room.clients.size === 0) {
            console.log(`Room "${roomName}" is empty. Scheduling deletion in 3 minutes.`);
            room.deleteTimeout = setTimeout(() => {
                // Kiểm tra lại một lần nữa phòng có còn trống không trước khi xóa
                if (rooms[roomName] && rooms[roomName].clients.size === 0) {
                    delete rooms[roomName];
                    console.log(`Room "${roomName}" deleted due to inactivity.`);
                    broadcastStateUpdate(); // Cập nhật lại danh sách phòng
                }
            }, 180000); // 3 phút = 180,000 milliseconds
        }
        broadcastStateUpdate();
    }
}

function joinRoom(ws, roomName) {
    leaveCurrentRoom(ws);
    const room = rooms[roomName];
    
    // TÍNH NĂNG MỚI: Hủy hẹn giờ xóa phòng nếu có người vào lại
    if (room.deleteTimeout) {
        clearTimeout(room.deleteTimeout);
        room.deleteTimeout = null;
        console.log(`Deletion for room "${roomName}" cancelled.`);
    }

    room.clients.add(ws);
    ws.currentRoom = roomName;
    
    broadcastToRoom(roomName, { type: 'system', content: `${ws.username} đã vào phòng.` });
    ws.send(JSON.stringify({ type: 'join_success', roomName: roomName }));
    broadcastStateUpdate();
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));