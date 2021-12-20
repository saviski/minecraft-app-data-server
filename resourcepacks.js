VERSION = 10

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

module.exports = {
  setTarget,
  saveFile,
  removeFile,
  listResourcePacks,
  listResourcePackFiles,
  contentType,
  NotFound,
  getZipFile,
  getFile,
}