node-statsd-profiler
====================

It's basically `node-statsd` but with strong power.

#initialization

Note : the initialization has to be done only once.

```
var profiler = require('statsd-profiler');
profiler.init(stastdHost, stastdPort, [stastdconf = {}]);
```

#same function as statsd

##increment

```js
profiler.increment(key, [sampleRate = 1], [transformKey]);
```

##decrement

```js
profiler.decrement(key, [sampleRate = 1], [transformKey]);
```

##gauge

```js
profiler.gauge(key, val, [sampleRate = 1], [transformKey]);
```

##timing

```js
profiler.timing(key, time, [sampleRate = 1], [transformKey]);
```

##timeStart

```js
profiler.timeStart(key, [timeID], [sampleRate = 1], [transformKey]);
```
You can specify timeID if key is used for multiple measure concurrently.

##timeEnd

```js
profiler.timeEnd(key, [timeID], [sampleRate = 1], [transformKey]);
```

You can specify timeID if key is used for multiple measure concurrently.

##measure

```js
profiler.measure(options);
```

The options are :

 * key : key of the metric
 * type : type of the measure (optional)
 * val : value of the metric for the gauge (optional)
 * sample_rate : sample-rate sent to statsd
 * timerID : it's the key of the time profiler. (optional)
 * transformKey : [function] modify the key sent to statsd to add a prefix, suffix... (optional)

#Config file : don't pollute your source code!

In the config file, you can some default parameters for your metrics.
You can create an alias for the `key`, the default `type` of the measure and the `sample rate`.

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

Sometimes, we have to add a prefix or a suffix to the key.
You can do that with the function `transformKey`.

Example:

```js

  function inc(req, key, sampleRate) {
    profiler.increment(key, sampleRate, function (key) {
      return req.hostname + '.' + key;
    }
  })

  inc({host : "myhost"}, "jsError");

  //will send
  statsd.increment("myhost.jsError", 1);
};
