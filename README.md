node-statsd-profiler
====================

It's a `node-statsd` library for people for whom clean code is important.

#initialization

Note : the initialization has to be done only once.

```
var profiler = require('statsd-profiler');
profiler.init(stastdHost, stastdPort, [stastdconf = {}, defaultSampleRate = 1, transformKey]);
```

#same function as statsd

##increment

```js
profiler.increment(key, [transformKeyArgs]);
```
Alias : `count`
##decrement

```js
profiler.decrement(key, [transformKeyArgs]);
```

##gauge

```js
profiler.gauge(key, val, [transformKeyArgs]);
```

##timing

```js
profiler.timing(key, time, [transformKeyArgs]);
```

##timeStart

```js
profiler.timeStart(key, [timeID], [transformKeyArgs]);
```
You can specify timeID if key is used for multiple measures concurrently.

##timeEnd

```js
profiler.timeEnd(key, [timeID], [transformKeyArgs]);
```

You can specify timeID if key is used for multiple measures concurrently.

#Config file : don't pollute your source code!

In the config file, specify the parameters for your metrics.
You can create an config for each metric : with a key, a measure `type` and a `sample rate`. Each parameter is optional.

For instance, in conf object.

```json
{
  "htmlParseTiming" : {
    "key"  : "engine.optimization.html.parse.timing",
    "sample_rate" : 0.3
  },
  "htmlParseCount" : {
    "type" : "increment",
    "key"  : "engine.optimization.html.parse.count",
    "sample_rate" : 0.9
  }
}
```

And after, in you code, you can simply write :

```js
  profiler.count(htmlParseCount);
  profiler.timeStart(htmlParseTiming);
  htmlParsing();
  profiler.timeEnd(htmlParseTiming);
```

and the actual call to statsd will be
```
  statsd.increment("engine.optimization.html.parse.count", 0.9);
  statsd.timing("engine.optimization.html.parse.timing", computedTime, 0.3);
```

#transformKey : compute dynamically the key

Often, we want add a prefix or a suffix to our keys like the hostname, the server id...
You can do that with the function `transformKey`.

```js
function transformKey(key, [args1 , args2, ...]);
```


Example:

```js

  profiler.transformKey = function (key, serverID) {
    return serverID + '.' + key;
  });

  profiler.increment('test', "server1");

  //will send
  statsd.increment("server1.test", 1);
};
``
