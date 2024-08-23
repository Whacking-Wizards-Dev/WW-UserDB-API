const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

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

async function searchFileInFolder(fileName) {
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

            // Datei herunterladen
            const fileResponse = await drive.files.get({
                fileId: file.id,
                alt: 'media'
            }, { responseType: 'text' });

            const user = JSON.parse(fileResponse.data);

            return user;
        }
    } catch (error) {
        console.error('Error searching or downloading file:', error);
        return false;
    }
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

    const user = await searchFileInFolder(uuid + ".json");

    if (!user) {
        return res.status(400).json({ error: 'UUID ist nicht gültig.', success: false });
    }

    // Überprüfen, ob die Daten korrekt sind
    if (user.username !== username || user.password !== password) {
        return res.status(400).json({ error: 'Username oder Passwort sind falsch.', success: false });
    }

    res.status(200).json({ message: 'Authentifizierung erfolgreich!', success: true });
});