const fs = require('fs').promises
const path = require('path')

async function applySkinToMinecraft(params, response) {
  let content = await fs.readFile(
    path.join(minecraftDirectory, 'launcher_profiles.json'),
    'utf8')

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
