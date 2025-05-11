import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import ConnectToWhatsApp from './connectwa.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 5000;

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Code WhatsApp</title>
      <script src="/socket.io/socket.io.js"></script>
    </head>
    <body>
      <h1>Scan QR Code WhatsApp</h1>
      <div id="qr-container">Menunggu QR Code...</div>
      <script>
        const socket = io();
        socket.on('connect', () => console.log('Connected to server'));
        socket.on('qr', (qrCodeData) => {
          document.getElementById('qr-container').innerHTML = '<img src="' + qrCodeData + '" />';
        });
      </script>
    </body>
    </html>
  `);
});

// Jalankan server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    ConnectToWhatsApp(io); // mulai koneksi WhatsApp
});