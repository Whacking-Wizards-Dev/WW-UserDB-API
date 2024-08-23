const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const ROOT_FOLDER = process.env.ROOT_FOLDER;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client,
});

/* 
filepath which needs to be uploaded
Note: Assumes example.jpg file is in root directory, 
though this can be any filePath
*/
const filePath = path.join(__dirname, 'example.jpg');

async function uploadFile() {
    try {
        const response = await drive.files.create({
            requestBody: {
                name: 'example.jpg', //This can be name of your choice
                mimeType: 'image/jpg',
            },
            media: {
                mimeType: 'image/jpg',
                body: fs.createReadStream(filePath),
            },
        });

        console.log(response.data);
    } catch (error) {
        console.log(error.message);
    }
}

// uploadFile();

async function deleteFile(fileId) {
    try {
        const response = await drive.files.delete({
            fileId: fileId,
        });
        console.log(response.data, response.status);
    } catch (error) {
        console.log(error.message);
    }
}

async function getUserFromFile(fileName) {
    try {
        // Suche die Datei auf Google Drive
        const response = await drive.files.list({
            q: `name='${fileName}' and '${ROOT_FOLDER}' in parents and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1, // Limitierung auf nur 1 Ergebnis
        });

        const files = response.data.files;

        if (files.length) {
            const file = files[0];
            console.log(`Found file: ${file.name} (${file.id})`);

            return parseFile(file);
        }
    } catch (error) {
        console.error('Error searching or downloading file:', error);
        return false;
    }
}

async function parseFile(file) {
    const fileResponse = await drive.files.get({
        fileId: file.id,
        alt: 'media'
    }, { responseType: 'text' });

    const user = JSON.parse(fileResponse.data);

    return user;
}


const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.get('/auth/:uuid/:username/:password', async(req, res) => {
    // Entgegennehmen der Daten
    const { uuid, username, password } = req.params;

    // Überprüfen, ob alle erforderlichen Daten vorhanden sind
    if (!uuid || !username || !password) {
        return res.status(400).json({ error: 'UUID, username und password sind erforderlich.' });
    }

    const user = await getUserFromFile(uuid + ".json");

    if (!user) {
        return res.status(400).json({ error: 'UUID ist nicht gültig.' });
    }

    // Überprüfen, ob die Daten korrekt sind
    if (user.username !== username || user.password !== password) {
        return res.status(400).json({ error: 'Username oder Passwort sind falsch.' });
    }

    const authToken = generateToken();

    saveAuthToken(authToken, uuid);

    const publicUser = getPublicUser(user);

    res.status(200).json({ authToken: authToken, userData: publicUser });
});

app.get('/auth/:authToken', async(req, res) => {
    // Entgegennehmen der Daten
    const { authToken } = req.params;

    // Überprüfen, ob alle erforderlichen Daten vorhanden sind
    if (!authToken) {
        return res.status(400).json({ error: 'authToken ist erforderlich.' });
    }

    const uuid = await getUuidFromToken(authToken);

    const user = await getUserFromFile(uuid + ".json");

    if (!user) {
        return res.status(400).json({ error: 'UUID ist nicht gültig.' });
    }

    const publicUser = getPublicUser(user);

    res.status(200).json({ userData: publicUser });
});

async function getUuidFromToken(token) {
    // Suche die Datei auf Google Drive
    const response = await drive.files.list({
        q: `name='AuthTokens.json' and '1iBaR0z6LeNa6nV3tVy_FfZlNQkpYjWro' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1, // Limitierung auf nur 1 Ergebnis
    });

    const files = response.data.files;

    if (files.length) {
        const file = files[0];
        const data = await parseFile(file);

        return data[token];
    }
}

function getPublicUser(user) {
    user.password = undefined;

    return user;
}

function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

async function saveAuthToken(token, uuid) {
    try {
        // Suche die Datei auf Google Drive
        const response = await drive.files.list({
            q: `name='AuthTokens.json' and '1iBaR0z6LeNa6nV3tVy_FfZlNQkpYjWro' in parents and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1, // Limitierung auf nur 1 Ergebnis
        });

        const files = response.data.files;

        if (files.length) {
            const file = files[0];
            const data = await parseFile(file);

            data[token] = uuid;
            updateFile(file.id, JSON.stringify(data));
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        return false;
    }
}

async function updateFile(fileId, newContent) {
    try {
        const response = await drive.files.update({
            fileId: fileId,
            media: {
                mimeType: 'text/plain', // Der MIME-Typ der Datei
                body: newContent, // Der neue Inhalt der Datei
            },
            fields: 'id, name', // Felder, die zurückgegeben werden sollen
            supportsAllDrives: true // Falls Sie auf geteilte Laufwerke zugreifen
        });
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Datei:', error);
    }
}