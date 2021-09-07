const fs = require('fs');
const express = require('express');
const http = require('http');
const https = require('https');

const options = {
  key: fs.readFileSync('learn-webrtc.lan-key.pem'),
  cert: fs.readFileSync('learn-webrtc.lan.pem'),
};

const app = express();
var httpServer = http.createServer(app);
var httpsServer = https.createServer(options, app);
// const server = require('http').Server(app);

const io = require('socket.io')(httpsServer);
const { v4: uuidV4 } = require('uuid');

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

app.get('/:room', (req, res) => {
  res.render('room', {
    roomId: req.params.room,
  });
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
});

httpServer.listen(8080);
httpsServer.listen(8443);
