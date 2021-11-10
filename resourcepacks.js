VERSION = 10

const https = require('https')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

const JSZip = require('jszip')
const mkdirp = require('mkdirp')
const listDirectoryRecursively = require('./list-dir.js')

const DEBUG = process.argv.includes('--debug')

const minecraftDirectory = {
  darwin: path.join(os.homedir(), 'Library/Application Support/minecraft'),
  win32: path.join(process.env.APPDATA || '', '.minecraft'),
  linux: path.join(os.homedir(), '.minecraft'),
}[os.platform()]

var resourcepacksFolder = path.join(minecraftDirectory, 'resourcepacks')
const zipFilesCache = new Map()

function setTarget(target) {
  resourcepacksFolder = target
  if (DEBUG) console.log(`directory: ${resourcepacksFolder}`)
}


/**
 * @param {string} name
 * @returns {Promise<JSZip>} zip contents
 */
async function getZip(name) {
  if (zipFilesCache.has(name)) return zipFilesCache.get(name)
  let content = await fs
    .readFile(path.join(resourcepacksFolder, name))
    .catch(reason => {
      throw new NotFound(reason)
    })
  let zip = await JSZip.loadAsync(content)
  zipFilesCache.set(name, zip)
  return zip
}

async function saveFile(name, filepath, content) {
  let base64 = typeof content == 'string' && /base64,/.test(content)
  let buffer =
    content instanceof Buffer
      ? content
      : base64
        ? Buffer.from(content.split(',').pop(), 'base64')
        : Buffer.from(content)

  let targetFile = path.join(resourcepacksFolder, name, filepath)
  await mkdirp(path.dirname(targetFile))
  await fs.writeFile(targetFile, buffer)
  console.log('saved ' + targetFile)
}

async function removeFile(name, filepath) {
  let filePath = path.join(resourcepacksFolder, name, filepath)
  await fs.unlink(filePath)
  console.log('deleted ' + filePath)
}

async function listResourcePacks() {
  return await fs.readdir(resourcepacksFolder)
}

async function listResourcePackFiles(resourcepack) {
  switch (path.extname(resourcepack)) {
    case '.zip':
      let zip = await getZip(resourcepack)
      return Object.keys(zip.files)

    default:
      let resourcepack_folder = path.join(resourcepacksFolder, resourcepack)
      let files = await listDirectoryRecursively(resourcepack_folder)
      return files.map(filepath =>
        path.relative(resourcepacksFolder, filepath).split(path.sep).join(path.posix.sep)
      )
  }
}

function contentType(filepath) {
  return (
    {
      '.json': 'application/json',
      '.metadata': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/png',
      '.ogg': 'audio/ogg',
      '.txt': 'text/plain',
    }[path.extname(filepath)] || 'text/plain'
  )
}

class NotFound extends Error {
  status = 404
}

async function getZipFile(zipname, filepath) {
  let zip = await getZip(zipname)
  let file = zip.files[filepath]
  if (!file) throw new NotFound(`file not found`)
  return await file.async('nodebuffer')
}

async function getFile(name, filepath) {
  let file = path.join(resourcepacksFolder, name, filepath)
  return await fs.readFile(file).catch(error => {
    throw new NotFound(error)
  })
}

async function getProfile() {
  let text = await fs.readFile(
    path.join(minecraftDirectory, 'launcher_accounts.json'),
    'utf8'
  )
  let launcher_accounts = JSON.parse(text)

  let activeAccountLocalId = launcher_accounts.activeAccountLocalId
  let account = launcher_accounts.accounts[activeAccountLocalId]
  return {
    name: account.minecraftProfile.name,
    uuid: account.minecraftProfile.id,
  }
}

const launcherSkinsPath = path.join(minecraftDirectory, 'launcher_skins.json')

async function getLauncherSkins() {
  let text = await fs.readFile(launcherSkinsPath, 'utf8')
  return JSON.parse(text)
}

async function addLauncherSkin({ name, modelImage, skinImage, slim = false }) {
  let launcherSkins = await getLauncherSkins()
  for (var index = 1; `novaskin_${index}` in launcherSkins; index++);
  launcherSkins[`novaskin_${index}`] = {
    capeId,
    created: new Date(),
    updated: new Date(),
    id: `novaskin_${index}`,
    modelImage,
    name,
    skinImage,
    slim,
  }
  await fs.copyFile(launcherSkinsPath, launcherSkinsPath + '.backup')
  await fs.writeFile(
    launcherSkinsPath,
    JSON.stringify(launcherSkins, null, 2),
    'utf8'
  )
}

exports.setTarget = setTarget
exports.saveFile = saveFile
exports.removeFile = removeFile
exports.listResourcePacks = listResourcePacks
exports.listResourcePackFiles = listResourcePackFiles
exports.contentType = contentType
exports.NotFound = NotFound
exports.getZipFile = getZipFile
exports.getFile = getFile
exports.getProfile = getProfile
exports.getLauncherSkins = getLauncherSkins
exports.addLauncherSkin = addLauncherSkin

function applySkinToMinecraft(params, response) {
  fs.readFile(
    path.join(resourcepacksFolder, '..', 'launcher_profiles.json'),
    'utf8',
    function (error, content) {
      if (error) {
        response.writeHead(500, {
          'Content-Type': 'application/json',
        })
        response.end(JSON.stringify(error), 'utf-8')
        return
      }

      try {
        var profiles = JSON.parse(content),
          clientToken = profiles.clientToken,
          authentication =
            profiles.authenticationDatabase[profiles.selectedUser.account],
          accessToken = authentication.accessToken,
          uuid = profiles.selectedUser.profile,
          playername = authentication.displayName

        isValidAccessToken(clientToken, accessToken, function (valid) {
          if (!valid)
            return (
              response.writeHead(403, 'invalid accessToken'), response.end()
            )

          postToMinecraftProfileApi(
            params,
            uuid,
            accessToken,
            function (status, message) {
              response.writeHead(status == 204 ? 200 : status, {
                'Content-Type': 'application/json',
              })
              console.log(message)
              response.end(
                JSON.stringify({
                  playername: playername,
                  uuid: uuid,
                  message: JSON.parse(message),
                }),
                'utf-8'
              )
            }
          )
        })
      } catch (e) {
        response.writeHead(500, {
          'Content-Type': 'application/json',
        })
        response.end(JSON.stringify(e.toString()), 'utf-8')
      }
    }
  )
}

function isValidAccessToken(clientToken, accessToken, callback) {
  postToAuthServer('/validate', clientToken, accessToken, callback)
}

function postToAuthServer(path, clientToken, accessToken, callback) {
  var post_req = https.request(
    {
      host: 'authserver.mojang.com',
      path: path,
      method: 'POST',
      port: 443,
      headers: {
        'Content-Type': 'application/json',
      },
    },
    function (res) {
      if (res.statusCode == 204 || res.statusCode == 200) callback(true)
      else if (res.statusCode == 403 && path != '/refresh')
        postToAuthServer('/refresh', clientToken, accessToken, callback)
      else callback(false)
    }
  )

  post_req.write(
    JSON.stringify({
      clientToken: clientToken,
      accessToken: accessToken,
    })
  )
  post_req.end()
}

function postToMinecraftProfileApi(params, uuid, accessToken, callback) {
  var post_req = https.request(
    {
      hostname: 'api.mojang.com',
      path: '/user/profile/' + uuid + '/skin',
      method: 'POST',
      port: 443,
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    },
    function (res) {
      if (res.statusCode == 204) callback(res.statusCode, '"ok"')
      else {
        res.setEncoding('utf8')
        res.on('data', function (d) {
          callback(res.statusCode, d)
        })
      }
    }
  )

  post_req.write(params)
  post_req.end()
}

//check for updates, download, and force a service restart with an exception.
https.get(
  'https://storage.googleapis.com/skineditor.appspot.com/public/server.js',
  function (response) {
    response.setEncoding('utf8')
    var content = ''
    response.on('data', function (data) {
      content += data
    })
    response.on('end', function () {
      var serverversion = content.match(/VERSION = (\d+)/),
        versionnumber = serverversion && Number(serverversion[1])

      if (versionnumber > VERSION) {
        console.log(
          'current version is ',
          VERSION,
          ' latest version is ',
          versionnumber,
          ' updating.'
        )
        fs.writeFileSync(__filename, new Buffer(content, 'utf8'))
        process.exit(1)
      }
    })
  }
)
