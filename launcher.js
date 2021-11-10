const fs = require('fs').promises
const path = require('path')

async function getProfile() {

  let launcher_accounts = JSON.parse(await fs.readFile(
    path.join(minecraftDirectory, 'launcher_accounts.json'),
    'utf8'
  ))

  let usercache = JSON.parse(await fs.readFile(
    path.join(minecraftDirectory, 'usercache.json'),
    'utf8'
  ))

  let activeAccountLocalId = launcher_accounts.activeAccountLocalId
  let account = launcher_accounts.accounts[activeAccountLocalId]
  let name = account.minecraftProfile.name
  let id = account.minecraftProfile.id
  let uuid = usercache.find(cache => cache.name == name)?.uuid
  return { name, id, uuid }
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

module.exports = {
  getProfile,
  getLauncherSkins,
  addLauncherSkin,
}