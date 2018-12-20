/* eslint-env mocha */
require('should')
const WSUpdater = require('.')

const mockModelListener = (registerListener, unregisterListener) => ({registerListener, unregisterListener})

const log = []
const mockLogger = {
  info: msg => log.push({msg, type: 'info'}),
  error: msg => log.push({msg, type: 'error'}),
  debug: msg => log.push({msg, type: 'debug'}),
  reset: () => log.length = 0
}

let wsRouteCallback
function expressWsMock(app) {
  app.ws = (route, callback) => {
    wsRouteCallback = callback
  }
}

// const mockServer = require('mock-websocket').Server
// const mockSocket = require('mock-websocket').WebSocket

class MockSocket {
  constructor() {
    this.listeners = []
    this.written = ''
    this.open = true
    this.otherErrorMsg = null
  }

  on(type, callback) {
    this.listeners[type] = callback
  }

  emit(type, data) {
    this.listeners[type](data)
  }

  send(data) {
    if (this.sendShouldFail) {
      throw Error('WebSocket is not open')
    }
    if (this.otherErrorMsg) {
      throw Error(this.otherErrorMsg)
    }
    this.written += data.toString().replace(/\r/g, '')
  }

  setSendShouldFail() {
    this.sendShouldFail = true
  }

  close() {
    this.open = false
  }

  isOpen() {
    return this.open
  }

  setOtherError(msg) {
    this.otherErrorMsg = msg
  }
}


const app = () => {}
const route = '/feed'

describe('WSUpdater', () => {
  beforeEach(() => {
    mockLogger.reset()
  })

  function createWebsocketRoute(modelListener, viewListener = () => {}, logger = undefined) {
    new WSUpdater({app, route, modelListener, viewListener, expressWs: expressWsMock, logger})
    wsRouteCallback.should.be.an.instanceOf(Function)
    const socket = new MockSocket()
    wsRouteCallback(socket)
    return socket
  }

  it('should accept WebSocket connections', done => {
    const modelListener = mockModelListener(() => {}, () => {})
    const socket = createWebsocketRoute(modelListener)
    socket.listeners.should.hasOwnProperty('message')
    done()
  })

  function initiateWebsocketUpdate(viewListener = () => {}, logger = undefined) {
    let modelChangeFunc
    const modelListener = mockModelListener(func => modelChangeFunc = func, () => {})
    const socket = createWebsocketRoute(modelListener, viewListener, logger)
    modelChangeFunc.should.be.instanceOf(Function)
    modelChangeFunc({type: 'update'})
    return socket
  }

  it('should send a message to the view if a model change arrives', done => {
    const socket = initiateWebsocketUpdate(() => {}, mockLogger)
    log.should.deepEqual([
      {msg: 'model change: sending to client', type: 'info'},
      {msg: '{"type":"update"}', type: 'debug'}
    ])
    socket.written.should.deepEqual(`{"type":"update"}`)
    done()
  })

  it('should log to console by default', done => {
    global.console.info = mockLogger.info
    global.console.error = mockLogger.error
    global.console.debug = mockLogger.debug
    initiateWebsocketUpdate()
    log.should.deepEqual([
      {msg: 'model change: sending to client', type: 'info'},
      {msg: '{"type":"update"}', type: 'debug'}
    ])
    done()
  })

  it('should send incoming messages from the view to the viewListener', done => {
    const expectedMsg = {type: 'command', data: 'do something'}
    let actualMsg
    const modelListener = mockModelListener(() => {}, () => {})
    const socket = createWebsocketRoute(modelListener, msg => actualMsg = msg, mockLogger)
    socket.emit('message', JSON.stringify(expectedMsg))
    actualMsg.should.deepEqual(expectedMsg)
    log.should.deepEqual([
      {msg: 'received view command', type: 'info'},
      {msg: JSON.stringify(expectedMsg), type: 'debug'}
    ])
    done()
  })

  it('should not fail without a viewListener', done => {
    const modelListener = mockModelListener(() => {}, () => {})
    const socket = createWebsocketRoute(modelListener, msg => actualMsg = msg, mockLogger)
    socket.emit('message', JSON.stringify({type: 'test'}))
    log.should.deepEqual([
      {msg: 'received view command', type: 'info'},
      {msg: JSON.stringify({type: 'test'}), type: 'debug'}
    ])
    done()
  })

  it('should close the socket if send fails', done => {
    let modelChangeFunc
    const modelListener = mockModelListener(func => modelChangeFunc = func, () => {})
    const socket = createWebsocketRoute(modelListener, () => {}, mockLogger)
    socket.setSendShouldFail()
    modelChangeFunc({type: 'update'})
    socket.isOpen().should.be.false()
    log.should.deepEqual([
      {msg: 'model change: sending to client', type: 'info'},
      {msg: '{"type":"update"}', type: 'debug'},
      {msg: 'WebSocket is not open', type: 'info'}
    ])
    done()
  })

  it('should report other errors in log but should keep socket open', () => {
    let modelChangeFunc
    const modelListener = mockModelListener(func => modelChangeFunc = func, () => {})
    const socket = createWebsocketRoute(modelListener, () => {}, mockLogger)
    socket.setOtherError('Other error')
    modelChangeFunc({type: 'update'})
    socket.isOpen().should.be.true()
    log.should.deepEqual([
      {msg: 'model change: sending to client', type: 'info'},
      {msg: '{"type":"update"}', type: 'debug'},
      {msg: Error('Other error'), type: 'error'}
    ])
  })
})
