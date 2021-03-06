var http = require('http');
var tls = require('tls');
var parseUrl = require('url').parse;
var httpsAgent = require('https').Agent;
var httpAgent = require('http').Agent;
var WebSocket = require('ws');
var config = require('./config.test');
var request = require('request').defaults({
	proxy : 'http://127.0.0.1:' + config.port
});
var count = 0;

exports.request = function(options, callback) {
	++count;
	
	if (/^ws/.test(options)) {
		var url = options;
		var opts = parseUrl(url);
		var isSsl = /^wss:/.test(url);
		require('../lib/config').connect({
			proxyHost: '127.0.0.1',
			proxyPort: config.port,
			host: opts.hostname,
			port: opts.port || (isSsl ? 443 : 80),
			headers: {
				host: opts.host,
				'proxy-connection': 'keep-alive'
			}
		}, function(socket) {
			var agent = isSsl ? new httpsAgent() : httpAgent();
			if (isSsl) {
			  socket = tls.connect({
          rejectUnauthorized: false,
          socket: socket,
          servername: opts.hostname
			  });
			}
			agent.createConnection = function() {
				return socket;
			};
			var ws = new WebSocket(url, {
				agent: agent,
				rejectUnauthorized: true
			});
			
			ws.on('open', function open() {
				  ws.send('something');
			});
			var done;
			ws.on('message', function(data) {
				if (done) {
					return;
				}
				done = true;
				callback && callback(JSON.parse(data));
				if (--count <= 0) {
					process.exit(0);
				}
			});
		});
	} else {
		if (typeof options == 'string') {
			options = {
					url: options,
					rejectUnauthorized : false
			};
		}
		request(options, function(err, res, body) {
			try {
				callback && callback(res, /\?resBody=/.test(options.url) ? body : (/doNotParseJson/.test(options.url) ? body : JSON.parse(body)), err);
			} catch(e) {
				console.log(options);
				throw e;
			}
			if (--count <= 0) {
				process.exit(0);
			}
		});
	}
};

function noop() {}

exports.noop = noop;

function getTextBySize(size) {
	
	return new Array(size + 1).join('1');
}

exports.getTextBySize = getTextBySize;

function connect(host, port, callback) {
	var done;
	var execCallback = function(err, socket) {
		if (done) {
			return;
		}
		done = true;
		callback(err, socket);
	};
	var req = http.request({
		method: 'CONNECT',
		host: '127.0.0.1',
		port: config.port,
		agent: false,
		headers: {
			'user-agent': 'test/whistle',
			'proxy-connection': 'keep-alive',
			'x-whistle-policy': 'tunnel',
			host: host +　(port ? ':' + port : '')
		}
	});
	req.on('error', execCallback);
	req.on('connect', function (res, socket, head) {
		execCallback(null, socket);
	});
	req.end();
}

function proxy(url, callback) {
	++count;
	var options = parseUrl(url);
	connect(options.hostname, options.port, function(err, socket) {
		if (err) {
			if (callback) {
				callback(err);
			} else {
				throw err;
			}
			if (--count <= 0) {
				process.exit(0);
			}
			return;
		}
		
		options.createConnection = function() {
			return socket;
		};
		
		http.request(options, function(res) {
			if (callback) {
				res.on('data', noop);
				var done;
				res.on('error', function(err) {
					if (done) {
						return;
					}
					done = true;
					callback(err, res);
					if (--count <= 0) {
						process.exit(0);
					}
				});
				res.on('end', function() {
					if (done) {
						return;
					}
					done = true;
					callback(err, res);
					if (--count <= 0) {
						process.exit(0);
					}
				});
			} else {
				if (--count <= 0) {
					process.exit(0);
				}
			}
		}).end();
	});
}

exports.proxy = proxy;
