const express = require('express');
const path = require('path');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

let rooms = 0;

app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

io.on('connection', (socket) => {

    // Tạo một phòng trò chơi mới và thông báo cho người tạo trò chơi /194
    socket.on('createGame', (data) => {
        console.log('player 1',data.name);
        socket.join(`room-${++rooms}`);
        socket.emit('newGame', { name: data.name, room: `room-${rooms}` });//216
    });

    //Kết nối Người chơi 2 với phòng đã có sẵn . Hiển thị lỗi nếu phòng đầy
    socket.on('joinGame', function (data) {
        console.log('player 2',data.name);
        var room = io.nsps['/'].adapter.rooms[data.room];
        if (room && room.length === 1) {
            socket.join(data.room);
            socket.broadcast.to(data.room).emit('player1', {});
            socket.emit('player2', { name: data.name, room: data.room })
        } else {
            socket.emit('err', { message: 'Sorry, The room is full!' });
        }
    });

    /**
       * Xử lý lượt chơi của một trong hai người chơi và thông báo cho người kia.
       */
    socket.on('playTurn', (data) => {
        socket.broadcast.to(data.room).emit('turnPlayed', {
            tile: data.tile,
            room: data.room
        });
    });

    /**
       * Thông báo cho người chơi về người chiến thắng.
       */
    socket.on('gameEnded', (data) => {
        socket.broadcast.to(data.room).emit('gameEnd', data);
    });

    // Tạo message
    socket.on('sendMessage',msg =>{// lang nghe du lieu tu client
        console.log(msg);
        socket.broadcast.emit('sendToAll',msg)//truyen du lieu sang clients
    })
});

const PORT = process.env.PORT || 5000
server.listen(PORT, () =>{
    console.log('server is running on port',PORT)
})