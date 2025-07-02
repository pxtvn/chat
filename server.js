const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};
const usersByName = new Map();
const USER_COLORS = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];

app.use(express.static(path.join(__dirname, 'public')));
app.get('/sw.js', (req, res) => { res.set({'Cache-Control': 'no-cache, no-store, must-revalidate','Pragma': 'no-cache','Expires': '0'}); res.sendFile(path.join(__dirname, 'sw.js')); });
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

function broadcastToAll(data) { const messageString = JSON.stringify(data); wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(messageString); }); }
function broadcastToRoom(roomName, data) { const room = rooms[roomName]; if (!room) return; const messageString = JSON.stringify(data); room.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(messageString); }); }

function broadcastStateUpdate() {
    const roomList = Object.keys(rooms).filter(roomName => !rooms[roomName].isDM).map(roomName => ({ name: roomName, isProtected: !!rooms[roomName].password, userCount: rooms[roomName].clients.size }));
    const globalUserList = [];
    wss.clients.forEach(client => { if (client.username) { globalUserList.push({ username: client.username, color: client.color, currentRoom: client.currentRoom || 'Tại sảnh' }); } });
    broadcastToAll({ type: 'state_update', rooms: roomList, users: globalUserList });
}

wss.on('connection', ws => {
    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            switch (data.type) {
                case 'set_username':
                    ws.username = data.content;
                    ws.color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
                    usersByName.set(ws.username, ws);
                    broadcastStateUpdate();
                    break;
                case 'create_room':
                    if (rooms[data.roomName]) { ws.send(JSON.stringify({ type: 'error', message: 'Tên phòng đã tồn tại.' })); return; }
                    rooms[data.roomName] = { clients: new Set(), password: data.password || null, isDM: false, history: [], deleteTimeout: null };
                    joinRoom(ws, data.roomName);
                    break;
                case 'start_dm':
                    const targetUser = usersByName.get(data.targetUsername);
                    if (!targetUser) { ws.send(JSON.stringify({ type: 'error', message: 'Người dùng không online.' })); return; }
                    const dmRoomName = [ws.username, data.targetUsername].sort().join('-dm-');
                    if (!rooms[dmRoomName]) { rooms[dmRoomName] = { clients: new Set(), password: null, isDM: true, history: [], deleteTimeout: null }; }
                    joinRoom(ws, dmRoomName);
                    targetUser.send(JSON.stringify({ type: 'dm_invite', roomName: dmRoomName, fromUser: ws.username }));
                    break;
                case 'join_room':
                    const roomToJoin = rooms[data.roomName];
                    if (!roomToJoin) { ws.send(JSON.stringify({ type: 'error', message: 'Phòng không tồn tại.' })); return; }
                    if (roomToJoin.password && roomToJoin.password !== data.password) { ws.send(JSON.stringify({ type: 'error', message: 'Sai mật khẩu.' })); return; }
                    joinRoom(ws, data.roomName);
                    break;
                case 'text':
                    if (ws.currentRoom) {
                        const messageData = { type: 'text', id: uuidv4(), username: ws.username, color: ws.color, content: data.content, tempId: data.tempId };
                        rooms[ws.currentRoom].history.push(messageData);
                        broadcastToRoom(ws.currentRoom, messageData);
                    }
                    break;
                case 'clear_room_history':
                    if (ws.currentRoom && rooms[ws.currentRoom]) {
                        rooms[ws.currentRoom].history = [];
                        broadcastToRoom(ws.currentRoom, {type: 'clear_confirmed'});
                    }
                    break;
                case 'message_seen':
                    if (ws.currentRoom && data.messageId) {
                        broadcastToRoom(ws.currentRoom, { type: 'seen_by_user', messageId: data.messageId, username: ws.username });
                    }
                    break;
            }
        } catch (error) { console.error("Lỗi xử lý tin nhắn:", error); }
    });
    ws.on('close', () => { if (ws.username) { const userThatLeft = ws.username; leaveCurrentRoom(ws); usersByName.delete(userThatLeft); broadcastStateUpdate(); console.log(`${userThatLeft} disconnected.`); }});
});

function leaveCurrentRoom(ws) {
    const roomName = ws.currentRoom;
    if (roomName && rooms[roomName]) {
        const room = rooms[roomName];
        room.clients.delete(ws);
        ws.currentRoom = null;
        broadcastToRoom(roomName, { type: 'system', content: `${ws.username} đã rời phòng.` });
        if (room.clients.size === 0 && !room.isDM) {
            room.deleteTimeout = setTimeout(() => { if (rooms[roomName] && rooms[roomName].clients.size === 0) { delete rooms[roomName]; broadcastStateUpdate(); }}, 180000);
        }
        broadcastStateUpdate();
    }
}

function joinRoom(ws, roomName) {
    leaveCurrentRoom(ws);
    const room = rooms[roomName];
    if (room.deleteTimeout) { clearTimeout(room.deleteTimeout); room.deleteTimeout = null; }
    room.clients.add(ws);
    ws.currentRoom = roomName;
    ws.send(JSON.stringify({ type: 'room_history', history: room.history }));
    broadcastToRoom(roomName, { type: 'system', content: `${ws.username} đã vào phòng.` });
    ws.send(JSON.stringify({ type: 'join_success', roomName: roomName, isDM: room.isDM }));
    broadcastStateUpdate();
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server đang lắng nghe ở cổng ${PORT}`));