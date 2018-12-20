(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory)
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.returnExports = factory()
  }
}(this, function () {
  'use strict'

  return function ({route, interpreter}) {
    let keepAlive
    let timeout = 1

    function retryConnection() {
      setTimeout(setupWSConnection, timeout * 10000)
      timeout = Math.max(timeout * 2, 64)
    }

    function setupWSConnection() {
      if (keepAlive) {
        clearInterval(keepAlive)
      }

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${location.host}${location.pathname}${route}`)

      socket.onopen = function () {
        timeout = 1
        keepAlive = setInterval(function () {
          socket.send(JSON.stringify({type: 'keepalive'}))
        }, 60000)
      }

      socket.onerror = function () {
        socket.close()
      }

      socket.onclose = function () {
        retryConnection()
      }

      socket.onmessage = function (event) {
        interpreter.notify(JSON.parse(event.data))
      }

      return socket
    }

    return setupWSConnection()
  }
}))
