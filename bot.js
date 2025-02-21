var makeWASocket = require('baileys').default;
var Boom = require('@hapi/boom').Boom;
var { useMultiFileAuthState, DisconnectReason,isJidNewsletter } = require('@whiskeysockets/baileys');
var qrcode = require('qrcode-terminal');

async function connectToWhatsApp() {
    const authData = await useMultiFileAuthState('auth_info_baileys');
    const state = authData.state;
    const saveCreds = authData.saveCreds;

    const sock = makeWASocket({
        auth: state
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("Scan this QR code to connect:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error instanceof Boom
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log('Connection closed due to', lastDisconnect?.error || 'unknown reason', ', reconnecting:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened');
            await sock.sendMessage("120363038723722594@g.us",{text:"online"})
        }
    });

    sock.ev.on('messages.upsert', (event) => {
        event.messages.forEach((m) => {
            console.log('Received message from', m);
        });
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
}

// Export sock after initialization
module.exports = connectToWhatsApp();
