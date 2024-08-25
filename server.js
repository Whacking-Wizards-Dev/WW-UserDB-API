const { google } = require('googleapis');
const dotenv = require('dotenv');
const crypto = require('crypto');
const axios = require('axios');

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const MAIL_API_KEY = process.env.MAIL_API_KEY;
const MAIL_SECRET_KEY = process.env.MAIL_SECRET_KEY;
const MAIL = process.env.MAIL;
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
const { create } = require('domain');
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

app.get('/user/verify/:email/:verificationToken', async(req, res) => {
    // Entgegennehmen der Daten
    const { email, verificationToken } = req.params;

    // Überprüfen, ob alle erforderlichen Daten vorhanden sind
    if (!email || !verificationToken) {
        return res.redirect('https://whacking-wizards.netlify.app/verificationError');
    }

    const data = await verifyUser(email);

    if (!data) {
        return res.redirect('https://whacking-wizards.netlify.app/verificationError');
    }

    if (data.token !== verificationToken) {
        return res.redirect('https://whacking-wizards.netlify.app/verificationError');
    }

    if (data.timeStamp < Date.now() - 1000 * 60 * 60 * 24) {
        return res.redirect('https://whacking-wizards.netlify.app/verificationError');
    }

    createUser(email, data.username, data.password);

    deleteVerificationToken(email);

    res.redirect('https://whacking-wizards.netlify.app/verified');
});

async function verifyUser(email) {
    // Suche die Datei auf Google Drive
    const response = await drive.files.list({
        q: `name='VerificationTokens.json' and '1iBaR0z6LeNa6nV3tVy_FfZlNQkpYjWro' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1, // Limitierung auf nur 1 Ergebnis
    });

    const files = response.data.files;

    if (files.length) {
        const file = files[0];
        const data = await parseFile(file);

        return data[email];
    }
}

async function deleteVerificationToken(email) {
    // Suche die Datei auf Google Drive
    const response = await drive.files.list({
        q: `name='VerificationTokens.json' and '1iBaR0z6LeNa6nV3tVy_FfZlNQkpYjWro' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1, // Limitierung auf nur 1 Ergebnis
    });

    const files = response.data.files;

    if (files.length) {
        const file = files[0];
        const data = await parseFile(file);

        data[email] = undefined;
        updateFile(file.id, JSON.stringify(data));
    }
}

app.delete('/user/:uuid/:username/:password', async(req, res) => {
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

    deleteFile(await getFileId(uuid));

    //delete token
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

            //delete old token
            for (const key in data) {
                if (data[key] === uuid) {
                    delete data[key];
                }
            }

            updateFile(file.id, JSON.stringify(data));
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        return false;
    }

    res.status(200).json({});
});

async function getFileId(uuid) {
    const fileName = uuid + ".json";
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

            return file.id;
        }
    } catch (error) {
        console.error('Error searching or downloading file:', error);
        return false;
    }
}

async function deleteFile(fileId) {
    try {
        await drive.files.delete({
            fileId: fileId,
            supportsAllDrives: true // Falls die Datei in einem geteilten Laufwerk liegt
        });
    } catch (error) {
        console.error(`Fehler beim Löschen der Datei mit der ID ${fileId}:`, error.message);
    }
}


app.get('/user/:uuid', async(req, res) => {
    // Entgegennehmen der Daten
    const { uuid } = req.params;

    // Überprüfen, ob alle erforderlichen Daten vorhanden sind
    if (!uuid) {
        return res.status(400).json({ error: 'UUID ist erforderlich.' });
    }

    const user = await getUserFromFile(uuid + ".json");

    if (!user) {
        return res.status(400).json({ error: 'UUID ist nicht gültig.' });
    }

    const publicUser = getPublicUser(user);

    res.status(200).json({ userData: publicUser });
});

app.post('/user/:email/:username/:password', async(req, res) => {
    // Entgegennehmen der Daten
    const { email, username, password } = req.params;

    // Überprüfen, ob alle erforderlichen Daten vorhanden sind
    if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, Username & Password sind erforderlich.' });
    }

    if (await emailAlreadyExists(email)) {
        return res.status(400).json({ error: 'Email wurde bereits verwendet.' });
    }

    sendVerificationEmail(email, username, password);
    /*
    const uuid = await createUser(email, username, password);

    const publicUser = getPublicUser(await getUserFromFile(uuid + ".json"), uuid);

    const authToken = generateToken();

    saveAuthToken(authToken, uuid);

    res.status(200).json({ authToken: authToken, userData: publicUser });
    */
    res.status(200).json({});
});

async function createUser(email, username, password) {
    const user = {
        email: email,
        username: username,
        password: password
    };

    const uuid = await nextUuid();

    try {
        const fileMetadata = {
            'name': `${uuid}.json`, // Name der Datei
            'parents': [process.env.ROOT_FOLDER], // Der Ordner, in dem die Datei erstellt wird
            'mimeType': 'application/json' // MIME-Typ der Datei
        };

        const media = {
            mimeType: 'application/json', // Der MIME-Typ der Datei
            body: JSON.stringify(user) // Der Inhalt der Datei
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name', // Felder, die zurückgegeben werden sollen
            supportsAllDrives: true // Falls du auf geteilte Laufwerke zugreifst
        });
    } catch (error) {
        console.error('Fehler beim Erstellen der Datei:', error);
    }

    return uuid;
}

const uuidLength = 16;

async function nextUuid() {
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

        const uuid = data.nextUuid.toString().padStart(uuidLength, '0');

        data.nextUuid += 1;
        updateFile(file.id, JSON.stringify(data));

        return uuid;
    }
}

async function emailAlreadyExists(email) {
    try {
        let pageToken = null;

        do {
            // Liste die Dateien auf
            const response = await drive.files.list({
                q: `'${ROOT_FOLDER}' in parents and trashed=false`,
                pageSize: 1000, // Maximale Anzahl von Dateien pro Seite
                fields: 'nextPageToken, files(id, name)', // Die Felder, die zurückgegeben werden sollen
                pageToken: pageToken, // Token für die nächste Seite
            });

            const files = response.data.files;
            pageToken = response.data.nextPageToken;

            if (files.length) {
                for (const file of files) {
                    const data = await parseFile(file);
                    if (data.email === email) {
                        return true; // Frühzeitiger Abbruch, wenn die E-Mail gefunden wird
                    }
                }
            } else {
                console.log('Keine Dateien gefunden.');
            }
        } while (pageToken); // Solange es eine nächste Seite gibt

    } catch (error) {
        console.error('Fehler beim Abrufen der Dateien:', error.message);
    }
    return false; // E-Mail nicht gefunden
}

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

function getPublicUser(user, uuid) {
    user.password = undefined;
    user.uuid = uuid;

    return user;
}

function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

async function saveAuthToken(token, uuid) {
    //save new token
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

            //delete old token
            for (const key in data) {
                if (data[key] === uuid) {
                    delete data[key];
                }
            }

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

async function sendVerificationEmail(email, name, password) {
    const verificationToken = generateToken();

    await saveVerificationToken(email, verificationToken, name, password);

    const data = JSON.stringify({
        "Messages": [{
            "From": { "Email": MAIL, "Name": "Whacking Wizards" },
            "To": [{ "Email": email, "Name": name }],
            "Subject": "Verify Your Email Address",
            "HTMLPart": `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto;">
                <h2 style="color: #444;">Hello ${name},</h2>
                <p>Welcome to the Whacking Wizards community! We're thrilled to have you on board.</p>
                <p>Before you can start using your account, please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <form action="http://localhost:8080/user/verify/${email}/${verificationToken}" method="POST" style="display: inline;">
                        <button type="submit" 
                                style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; border: none; cursor: pointer;">
                            Verify Email
                        </button>
                    </form>
                </div>
            <p>If the button above doesn't work, please copy and paste the following link into your web browser:</p>
            <p><a href="http://localhost:8080/user/verify/${email}/${verificationToken}">http://localhost:8080/user/verify/${email}/${verificationToken}</a></p>
            <p>If you did not request this, please ignore this email. Your account will not be activated without verification.</p>
            <p>Best regards,<br>The Whacking Wizards Team</p>
        </div>
        `,
            "TextPart": `Hello ${name},

Welcome to the Whacking Wizards community! We're thrilled to have you on board.

Before you can start using your account, please verify your email address by clicking the link below:
http://localhost:8080/user/verify/${email}/${verificationToken}

If you did not request this, please ignore this email. Your account will not be activated without verification.

Best regards,
The Whacking Wizards Team`
        }]
    });

    const config = {
        method: 'post',
        url: 'https://api.mailjet.com/v3.1/send',
        data: data,
        headers: { 'Content-Type': 'application/json' },
        auth: { username: MAIL_API_KEY, password: MAIL_SECRET_KEY },
    };

    return axios(config)
        .then(function(response) {
            console.log(JSON.stringify(response.data));
        })
        .catch(function(error) {
            console.log(error);
        });

}

async function saveVerificationToken(email, token, username, password) {
    //save new token
    try {
        // Suche die Datei auf Google Drive
        const response = await drive.files.list({
            q: `name='VerificationTokens.json' and '1iBaR0z6LeNa6nV3tVy_FfZlNQkpYjWro' in parents and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1, // Limitierung auf nur 1 Ergebnis
        });

        const files = response.data.files;

        if (files.length) {
            const file = files[0];
            const data = await parseFile(file);

            //delete old token
            for (const key in data) {
                if (data[key] === email) {
                    delete data[key];
                }
            }

            data[email] = { token: token, timeStamp: Date.now(), username: username, password: password };
            updateFile(file.id, JSON.stringify(data));
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        return false;
    }
}