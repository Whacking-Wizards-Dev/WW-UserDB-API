# WhackingWizardsDB-API
A simple Restful API to authenticate old users and registrate new ones

## How to get started 🚀
1. install dependencies
2. run <code>node server.js</code>
3. call endpoint

## Endpoints 🏁
### GET
- /user/{uuid}
- /auth/{uuid}/{username}/{password}
- /auth/{authToken}

### POST
- /user/{email}/{username}/{password}

### DELETE
- /user/{uuid}/{username}/{password}

## Dependencies
- googleapis
- dotenv
- crypto

## Technologies 👾
- JavaScript
- NodeJS
- Express
- Google Drive API v3
