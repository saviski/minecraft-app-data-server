const fs = require('fs').promises
const path = require('path')
/**
 *
 * @param {string} directory
 * @param {RegExp} ignore
 * @returns {string[]} all files inside all inner folders
 */
module.exports = async function listDirectoryRecursively(directory, ignore = /$^/) {
  let files = await fs.readdir(directory)
  let list = await Promise.all(
    files
      .filter(filename => !ignore.test(filename))
      .map(async filename => {
        let filepath = path.join(directory, filename)
        let stats = await fs.lstat(filepath)

        return stats.isDirectory()
          ? await listDirectoryRecursively(filepath, ignore)
          : filepath
      })
  )

  return list.flat()
}