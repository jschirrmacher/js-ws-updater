# js-ws-updater

A package to connect a Node.js / express.js backend with a JavaScript
frontend via WebSockets.

## Usage

### Installation

    npm install --save js-ws-updater

### Backend usage

Put these lines just after initiating your express app:

    const WSUpdater = require('js-ws-updater')
    new WSUpdater({app, route: '/feed', modelListener, expressWs: require('express-ws')})

This installs a WebSocket listener on the route `/feed` and a model
listener, which implements the following functions:

    registerListener(listenerFunc) -> listenerId
    unregisterListener(listenerId)

The `listenerFunc` should be invoked on each change in the model with an
object describing this change. This data is then sent by the
js-ws-updater backend to the frontend which can update the view
accordingly.

The WSUpdater constructor accepts some optional parameters:

- `viewListener` - if set, this function is invoked every time the
  frontend sends a message via the WebSocket. If it is not set, incoming
  messages are simply ignored.
- `logger` - if set, each incoming and outgoiing message is logged to
  the specified logger with log level `info`, else the console is used.
  If log level 'debug` is set, the message content is logged as well.

### Frontend usage

The frontend should load the `UpdateListener.js` script. This could be
done by a module loader of your choice like
[common.js](http://www.commonjs.org/):

    var UpdateListener = require('UpdateListener')

Or, alternatively in AMD format with
[require.js](https://github.com/amdjs/amdjs-api/wiki/AMD):

    define(['UpdateListener'], function (UpdateListener) {
        ...
    })

It is also possible to load it directly with a `<script>` tag from
GitHub.

    <script src="https://github.com/jschirrmacher/js-ws-updater/blob/master/UpdateListener.js"></script>

In all these cases, you need to instantiate it like this:

    new UpdateListener({location, route, interpreter, timer, WebSocket})

With the following components:

- `location` - a Location object like `window.location`,
- `route` - a string containing the URI to call on the current server.
  This should correspond to the `route` paraeter of the backend.
- `interpreter` - an object having a `notify()` function
- `timer` an object containing the timer related functions `setTimeout`,
  `clearTimeout` and `setInterval` like the `window` object
- `WebSocket` the class implementing WebSockets, like the standard class
  of the same title

The `interpreter.notify()` function is called whenever a message from
the server arrives and gets this message as a parameter. Messages should
be objects having a `type` attribute, which can be checked
