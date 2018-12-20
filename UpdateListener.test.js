/* eslint-env mocha */
require('should')

const log = []
const empty = () => {}

global.setInterval = (func, time) => {
  log.push(`timer.setInterval(${time})`)
  process.nextTick(func)
}

global.clearInterval = id => log.push(`timer.clearInterval(${id})`)

const nodeTimeout = setTimeout
global.setTimeout = (func, time) => {
  log.push(`timer.setTimeout(${time})`)
  process.nextTick(func)
}

const setLocation = (protocol, host, pathname) => {
  global.location = { protocol, host, pathname }
}

let currentWebSocket
let letNewWebSocketFail = false

class WebSocket {
  constructor(url) {
    log.push(`new WebSocket(${url})`)
    currentWebSocket = this
    this.url = url
    if (letNewWebSocketFail) {
      currentWebSocket.onerror()
    }
  }

  close() {
    log.push(`WebSocket.close()`)
    currentWebSocket.onclose()
  }

  send(msg) {
    log.push(`WebSocket.send(${JSON.stringify(msg)})`)
  }
}

global.WebSocket = WebSocket

describe('UpdateListener', () => {
  beforeEach(() => {
    currentWebSocket = null
    log.length = 0
  })

  it('should start a Websocket connection', done => {
    setLocation('http:', 'example.com', '/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: empty})
    currentWebSocket.url.should.equal('ws://example.com/feed')
    done()
  })

  it('should send keepalive messages', done => {
    setLocation('http:', 'example.com', '/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: empty})
    currentWebSocket.onopen({})
    nodeTimeout(() => {
      log.should.deepEqual([
        'new WebSocket(ws://example.com/feed)',
        'timer.setInterval(60000)',
        'WebSocket.send("{\\"type\\":\\"keepalive\\"}")'
      ])
      done()
    }, 10)
  })

  it('should re-connect when connection is closed', done => {
    setLocation('http:', 'example.com', '/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: empty})
    currentWebSocket.onclose({})
    nodeTimeout(() => {
      log.should.deepEqual([
        'new WebSocket(ws://example.com/feed)',
        'timer.setTimeout(10000)',
        'new WebSocket(ws://example.com/feed)'
      ])
      done()
    }, 10)
  })

  it('should re-connect in case of errors', done => {
    setLocation('http:', 'example.com', '/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: empty})
    currentWebSocket.onerror({})
    nodeTimeout(() => {
      log.should.deepEqual([
        'new WebSocket(ws://example.com/feed)',
        'WebSocket.close()',
        'timer.setTimeout(10000)',
        'new WebSocket(ws://example.com/feed)'
      ])
      done()
    }, 10)
  })

  it('should forward messages', done => {
    setLocation('http:', 'example.com', '/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: ({notify: msg => {
        msg.should.deepEqual({type: 'test'})
        done()
      }})})
    currentWebSocket.onmessage({data: JSON.stringify({type: 'test'})})
  })

  it('should use wss protocol when page was loaded with https', done => {
    setLocation('https:', 'example.com', '/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: empty})
    currentWebSocket.url.should.equal('wss://example.com/feed')
    done()
  })

  it('should work with deep paths', done => {
    setLocation('http', 'example.com', '/deep/path/')
    const listener = require('./UpdateListener')
    listener({route: 'feed', interpreter: empty})
    currentWebSocket.url.should.equal('ws://example.com/deep/path/feed')
    done()
  })
})
