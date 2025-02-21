const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const readline = require("readline"); 
const sockPromise = require("./bot"); // Now returns a promise
const { isJidNewsletter } = require("baileys");

const apiId = 16274989; // Get this from https://my.telegram.org
const apiHash = "db7e51369e06e03c3c70736939301b44";
const stringSession = new StringSession("1BQANOTEuMTA4LjU2LjEwNgG7g8bviSdFuYdmIgNh3IMGYc3eEbJRmfWqr9sQWCzqBh/qAiJkEVNVt1Y2O3IGnnfaQ1Yd94V/SAs0/ZHl3Qhb2VLE77goc0/iikYcSTRUXXOkMoHMkubn1srf8rDcIpuZOy/OU0H2sJxho72xHL5F2Y8fMapnRVOrm3N5//0Mn+xD4D93nHiqlx4QgVEDZJDRfzLdDFVuQqVjYY5ovQqCP1eY9yC5dP3kydUqdNDhXnE0MQHY0Soh5d7+Af6wUq9udiRUgy2S7fvc9TQyg1vSI2+3OWF88Rswo/YvpkcZeoXCyD6ugDJlDkkkPj1vzef5F60DrBYefC7EF4brlc501w=="); // Use your session string

// Function to get user input
const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    }));
};

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    console.log("Loading Telegram client...");
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => askQuestion("Enter your phone number: "),
        password: async () => askQuestion("Enter your 2FA password (if enabled): "),
        phoneCode: async () => askQuestion("Enter the code you received: "),
        onError: (err) => console.log("Error:", err),
    });

    console.log("Telegram connected");

    // Wait for WhatsApp socket to initialize
    const sock = await sockPromise;

    client.addEventHandler(async (event) => {
        if (event.message) {
            const incomingMessage = event.message;
            const senderId = incomingMessage.senderId.value; // Extract sender ID
    
            // Allowed sender IDs (converted to string)
            const allowedSenderIds = ["-1002043254797", "-1002002305468"];
    
            // Check if sender is in the allowed list
            if (allowedSenderIds.includes(senderId.toString())) {
                console.log(`Message from ${senderId}: ${incomingMessage.text}`);
                
                // WhatsApp JID for sending message
                const jid = "120363315377234178@newsletter";
                const message = { text: incomingMessage.text };

            await sock.sendMessage(jid, message,{broadcast:true});
                console.log("Message sent to WhatsApp"); 
            }
        }
    }, new NewMessage({}));
})();
