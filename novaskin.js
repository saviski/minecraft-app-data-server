const resourcepacks = require('./resourcepacks.js')
const fs = require('fs').promises
const mkdirp = require('mkdirp')
const path = require('path')

resourcepacks
  .getFile('novaskin', 'pack.mcmeta')
  .then(file => {
    let mcmeta = JSON.parse(file.toString())
    if (mcmeta.pack.pack_format < 7) mcmeta.pack.pack_format = 7
    return mcmeta
  })
  .catch(ismissing => {
    return {
      pack: {
        pack_format: 7,
        description: 'for 1.17\ncustomize at \u00A7e\u00A7nnovaskin.me',
      },
    }
  })
  .then(mcmeta => {
    return resourcepacks.saveFile(
      'novaskin',
      'pack.mcmeta',
      JSON.stringify(mcmeta, null, 2)
    )
  })
  .then(() => {
    return resourcepacks.getFile('novaskin', 'pack.png')
  })
  .catch(async missingpng => {
    let png = await fs.readFile(path.join(__dirname, 'pack.png'))
    await resourcepacks.saveFile('novaskin', 'pack.png', png)
  })
