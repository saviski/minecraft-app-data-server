const resourcepacks = require('./resourcepacks.js')
const launcher = require('./launcher.js')
//const skin = require('./skin.js')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = 22549
const SECURE_PORT = 22443
const DOMAIN = 'local.novaskin.me'

const DEBUG = process.argv.includes('--debug')

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const app = express()

const validReferer =
  /^https?:\/\/(localhost:\d+|(snapshot\.)?minecraft.novaskin.me|novaskin.me)$/

const lastArg = process.argv.slice(2).pop()
if (lastArg && !lastArg.startsWith('--')) resourcepacks.setTarget(lastArg)

const novaskin = require('./novaskin.js')

if (!DEBUG) {
  app.use(helmet())
  app.use(cors({ origin: validReferer }))
}

app.use(express.text()).use(express.json())

if (DEBUG)
  app.all('*', function (req, res, next) {
    console.log('Accessing', req.url, `body`, req.body)
    next()
  })

app.get('/', async (req, res) => {
  res.json(await resourcepacks.listResourcePacks())
})

app.get(
  '/profile',
  async (req, res) => await res.json(launcher.getProfile())
)

app.post(['/applyskin', '/profile/skin'], async (req, res) => { })

app
  .route('/launcher/skins')
  .get(async (req, res) => await res.json(launcher.getLauncherSkins()))
  .put(async (req, res) => await launcher.addLauncherSkin(req.body))

app.get('/:name', async (req, res) => {
  res.send(await resourcepacks.listResourcePackFiles(req.params.name))
})

app.get('/:zip.zip/:file*', async (req, res) => {
  res.send(
    await resourcepacks.getZipFile(req.params.zip + '.zip', req.params.file)
  )
})

app
  .route('/:name/:file*')
  .get(async (req, res, next) => {
    let resource = await resourcepacks.getFile(req.params.name, req.params.file)
    res
      .writeHead(200, {
        'Content-Type': resourcepacks.contentType(req.params.file),
        'Content-Length': resource.length,
      })
      .end(resource)
  })
  .post(async (req, res) => {
    await resourcepacks.saveFile(req.params.name, req.params.file, req.body)
  })
  .delete(async (req, res) => {
    await resourcepacks.removeFile(req.params.name, req.params.file)
  })

app.use(function (err, req, res, next) {
  res.status(err.status || 500).send(err.message)
})

http.createServer(app).listen(PORT)

// Certificate
const privateKey = fs.readFileSync(
  path.join(__dirname, './certificate/privkey.pem'),
  'utf8'
)
const certificate = fs.readFileSync(path.join(__dirname, './certificate/cert.pem'), 'utf8')
const ca = fs.readFileSync(path.join(__dirname, './certificate/chain.pem'), 'utf8')

const credentials = {
  key: privateKey,
  cert: certificate,
  ca: ca,
  requestCert: false,
  rejectUnauthorized: false,
}
https.createServer(credentials, app).listen(SECURE_PORT)

console.log(
  `Server running at http://local.novaskin.me:${PORT} and https://local.novaskin.me:${SECURE_PORT}`
)
