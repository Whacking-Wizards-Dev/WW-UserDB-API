# WhackingWizardsDB-API
A simple Restful API to authenticate old users and registrate new ones

## How to get started 🚀
1. install dependencies
2. create .env file with required secrets
3. run <code>node server.js</code>
4. call endpoint

## Endpoints 🏁
### GET
- /user/{uuid}

### POST
- /user/{email}/{username}/{password}
- /auth/{uuid}/{username}/{password}
- /auth/{authToken}

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
