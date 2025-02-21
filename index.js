const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const readline = require("readline");
const http = require("http");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const makeWASocket = require("baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const Boom = require("@hapi/boom").Boom;

// Telegram API credentials
const apiId = 16274989;
const apiHash = "db7e51369e06e03c3c70736939301b44";
const stringSession = new StringSession("1BQANOTEuMTA4LjU2LjEwNgG7g8bviSdFuYdmIgNh3IMGYc3eEbJRmfWqr9sQWCzqBh/qAiJkEVNVt1Y2O3IGnnfaQ1Yd94V/SAs0/ZHl3Qhb2VLE77goc0/iikYcSTRUXXOkMoHMkubn1srf8rDcIpuZOy/OU0H2sJxho72xHL5F2Y8fMapnRVOrm3N5//0Mn+xD4D93nHiqlx4QgVEDZJDRfzLdDFVuQqVjYY5ovQqCP1eY9yC5dP3kydUqdNDhXnE0MQHY0Soh5d7+Af6wUq9udiRUgy2S7fvc9TQyg1vSI2+3OWF88Rswo/YvpkcZeoXCyD6ugDJlDkkkPj1vzef5F60DrBYefC7EF4brlc501w=="); // Use your session string

// Helper function for user input
const askQuestion = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(query, (answer) => { rl.close(); resolve(answer); }));
};

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Telegram client
async function startTelegramClient() {
    console.log("Starting Telegram client...");
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

    await client.start({
        phoneNumber: async () => askQuestion("Enter your phone number: "),
        password: async () => askQuestion("Enter your 2FA password (if enabled): "),
        phoneCode: async () => askQuestion("Enter the code you received: "),
        onError: (err) => console.log("Telegram Error:", err),
    });

    console.log("Telegram connected.");
    return client;
}

// Initialize WhatsApp client
async function startWhatsAppClient() {
    console.log("Starting WhatsApp client...");
    const authData = await useMultiFileAuthState("auth_info_baileys");
    let sock = makeWASocket({ auth: authData.state });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("Scan this QR code to connect:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error instanceof Boom
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log("WhatsApp connection closed. Reconnecting:", shouldReconnect);
            if (shouldReconnect) {
                await sleep(5000);
                sock = await startWhatsAppClient(); // Restart the connection
            }
        } else if (connection === "open") {
            console.log("WhatsApp connected successfully.");
        }
    });

    sock.ev.on("messages.upsert", (event) => {
        event.messages.forEach((m) => {
            console.log("Received WhatsApp message:", m);
        });
    });

    sock.ev.on("creds.update", authData.saveCreds);

    return sock;
}

// Telegram message handling
async function setupTelegramListener(client, sock) {
    client.addEventHandler(async (event) => {
        if (event.message) {
            const incomingMessage = event.message;
            const senderId = incomingMessage.senderId.value;
            const allowedSenderIds = ["-1002043254797", "-1002002305468"];

            if (allowedSenderIds.includes(senderId.toString())) {
                console.log(`Message from Telegram ${senderId}: ${incomingMessage.text}`);
                const jid = "120363038723722594@g.us";

                try {
                    await sock.sendMessage(jid, { text: incomingMessage.text });
                    console.log("Message sent to WhatsApp");
                } catch (err) {
                    console.error("Failed to send message to WhatsApp:", err);
                }
            }
        }
    }, new NewMessage({}));
}

// Create an HTTP server for health checks
function startServer() {
    const PORT = 3000;
    http.createServer((req, res) => {
        if (req.url === "/get") {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ status: "OK", timestamp: new Date().toISOString() }));
        }
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Server is running\n");
    }).listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

    setInterval(async () => {
        try {
            const response = await axios.get(`https://telegram-web-5kjg.onrender.com`);
            console.log("Health check:", response.data);
        } catch (error) {
            console.error("Health check failed:", error.message);
        }
    }, 60000);
}

// Main execution
(async () => {
    startServer();
    
    const telegramClient = await startTelegramClient();
    const whatsappClient = await startWhatsAppClient();
    
    setupTelegramListener(telegramClient, whatsappClient);
})();
