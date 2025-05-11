import qrcode from 'qrcode';
import makeWaSocket, {
    useMultiFileAuthState,
    DisconnectReason,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import datas from './data.json' assert { type: 'json' };

// Inisialisasi variabel
const sufix = '@s.whatsapp.net';
const data = datas[0];
const requiredKeywords = data.requiredKeywords;
const replyMessage = data.replyMessage;
const senders = data.senders;
const senderWithSuffix = senders.map((number) => number + sufix);
const selfNumber = data.selfNumber + sufix;

let botActive = true;

// Daftar command yang bisa dijalankan
const prefix = '!';
const commands = {
    [`${prefix}on`]: async (msg, selfNumber, sock) => {
        if (botActive) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Self Bot sudah aktif!',
            });
            console.log('Bot sudah aktif, perintah !on diabaikan');
            return;
        }
        botActive = true;
        await sock.sendMessage(msg.key.remoteJid, {
            text: '✅ Self Bot diaktifkan!',
        });
        console.log('Bot diaktifkan:', selfNumber);
    },

    [`${prefix}off`]: async (msg, selfNumber, sock) => {
        if (!botActive) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Self Bot sudah nonaktif!',
            });
            console.log('Bot sudah nonaktif, perintah !off diabaikan');
            return;
        }
        botActive = false;
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Self Bot dinonaktifkan!',
        });
        console.log('Bot dinonaktifkan oleh:', selfNumber);
    },

    [`${prefix}status`]: async (msg, selfNumber, sock) => {
        const statusMessage = botActive
            ? '✅ Self Bot aktif!'
            : '❌ Self Bot nonaktif!';
        await sock.sendMessage(msg.key.remoteJid, { text: statusMessage });
        console.log('Status bot diminta oleh:', selfNumber);
    },
};

// Fungsi untuk menghubungkan ke WhatsApp
async function ConnectToWhatsApp(io) {
    const path = './auth_info_baileys';
    const { state, saveCreds } = await useMultiFileAuthState(path);
    const sock = makeWaSocket.default({
        auth: state,
        printQRInTerminal: false,
    });

    // Hubungkan ke WhatsApp
    sock.ev.on('connection.update', async (update) => {
        const { qr, connection, lastDisconnect } = update;

        if (qr) {
            const qrCodeData = await qrcode.toDataURL(qr);
            io.emit('qr', qrCodeData);
        }

        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect?.error instanceof Boom &&
                lastDisconnect.error.output?.statusCode !==
                    DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('Reconnecting...');
                ConnectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Connected to WhatsApp');
        }
    });

    // Simpan informasi autentikasi
    sock.ev.on('creds.update', saveCreds);

    // Tampilkan pesan yang masuk
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            const msg = m.messages[0];
            const isSelf = msg.key.fromMe;
            const pesan = msg.message.conversation;
            const senderNumber = msg.key.participant;

            if (!isSelf) {
                if (!botActive) {
                    console.log('Bot sedang nonaktif, tidak memproses pesan');
                    return;
                }
                const isGroupMessage = msg.key.remoteJid.endsWith('@g.us');
                if (isGroupMessage) {
                    if (
                        senderWithSuffix &&
                        senderWithSuffix.includes(senderNumber)
                    ) {
                        const containsAllKeywords = requiredKeywords.every(
                            (keyword) =>
                                pesan
                                    .toLowerCase()
                                    .includes(keyword.toLowerCase())
                        );

                        if (pesan && containsAllKeywords) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: replyMessage,
                            });
                            console.log('Pesan test masuk dan dibalas');
                        }
                    }
                }
            } else {
                if (
                    msg.key.remoteJid === senderWithSuffix &&
                    msg.key.remoteJid === selfNumber
                ) {
                    const command = commands[pesan.toLowerCase()];
                    if (command) {
                        await command(msg, selfNumber, sock);
                        return;
                    }
                }
            }
        }
    });
}

export default ConnectToWhatsApp;
