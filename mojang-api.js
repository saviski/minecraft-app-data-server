const fetch = require('node-fetch')

/**
 *
 * @param {string} username
 * @returns {Promise<{name: string, id: string}>}
 */
async function profile(username) {
  return (
    await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
  ).json()
}

/**
 *
 * @param {string[]} username
 * @returns {Promise<{name: string, id: string}[]>}
 */
async function profiles(usernames) {
  return (
    await fetch('https://api.mojang.com/users/profiles/minecraft', {
      method: 'POST',
      body: JSON.stringify(usernames),
    })
  ).json()
}

/**
 *
 * @param {string} uuid
 * @returns {Promise<{name: string, changetToAt?: number}[]>}
 */
async function names(uuid) {
  return (
    await fetch(`https://api.mojang.com/user/profiles/${uuid}/names`)
  ).json()
}

/**
 *
 * @param {string} uuid
 * @returns {Promise<{id: string, name: string, properties: {name: string, value: {profileId,profileName,textures:{SKIN:{url,metadata?:{model:'slim'}},CAPE:{url}}}}[]}[]>}
 */
async function properties(uuid) {
  let result = await (
    await fetch(
      `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`
    )
  ).json()
  result.properties.forEach(property => {
    property.value = Buffer.from(data, 'base64').toString('utf8')
  })
  return result
}

/**
 *
 * @param {string} uuid
 * @returns {boolean} is slim
 */
function slim(uuid) {
  return uuid.length <= 16
    ? false
    : Boolean(
      parseInt(uuid[7], 16) ^
      parseInt(uuid[15], 16) ^
      parseInt(uuid[23], 16) ^
      parseInt(uuid[31], 16)
    )
}
