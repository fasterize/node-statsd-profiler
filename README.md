node-statsd-profiler
====================

A [node-statsd](https://github.com/sivy/node-statsd/) fork with helpers for timing, key aliases and dynamic keys.

#initialization

Initialization has to be done only once.
So you can use your statsd module globally.

```js
var profiler = require('statsd-profiler');
profiler.init(options);
```

Options and defaults:
```js
{
  stastdAddress: undefined, // address of the statsd server
  stastdconf: {}, // key aliases, see `Key aliases`
  defaultSampleRate: 1, // statsd sample rate, 1/10th of the time,
  transformKey: function(key) {return key}, // so that you can easily add dynamic prefix, suffixes
  cleanTimer: 5000 // When to cancel timeStart() requests that did not met a timeEnd()? In ms.
}
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

#Key aliases

With key aliases you can easily set complex keys and sample rate alias a cool name.
You can create an config for each metric : with a `key`, a measure `type` and a `sample rate`. Each parameter is optional.

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

```js
  statsd.increment("engine.optimization.html.parse.count", 0.9);
  statsd.timing("engine.optimization.html.parse.timing", computedTime, 0.3);
```

#transformKey : dynamically compute the key

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
```
