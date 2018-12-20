/* eslint-env node */

class WSUpdater {
  constructor({app, route, modelListener, viewListener, logger, expressWs}) {
    this.modelListener = modelListener
    this.logger = logger || console
    expressWs(app)
    app.ws(route, sock => {
      this.listenerId = this.modelListener.registerListener(change => this.modelChangeListener(change, sock))
      sock.on('message', msg => {
        this.logger.info('received view command')
        this.logger.debug(msg)
        return viewListener && viewListener(JSON.parse(msg))
      })
    })
  }

  modelChangeListener(change, sock) {
    try {
      this.logger.info('model change: sending to client')
      this.logger.debug(JSON.stringify(change))
      sock.send(JSON.stringify(change))
    } catch (error) {
      if (error.message.match(/WebSocket is not open/)) {
        this.logger.info(error.message)
        sock.close()
        this.modelListener.unregisterListener(this.listenerId)
      } else {
        this.logger.error(error)
      }
    }
  }
}

module.exports = WSUpdater
