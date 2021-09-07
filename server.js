const fs = require('fs');
const express = require('express');
// const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const { v4: uuidV4 } = require('uuid');

const options = {
  key: fs.readFileSync(process.env.SSL_CERTIFICATE_KEY),
  cert: fs.readFileSync(process.env.SSL_CERTIFICATE),
};

const app = express();
// const httpServer = http.createServer(app);
const httpsServer = https.createServer(options, app);
const io = socketIo(httpsServer);

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

httpsServer.listen(3000);
