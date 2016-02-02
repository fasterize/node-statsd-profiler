var EventEmitter = require('events').EventEmitter,
    StatsD = require('node-statsd').StatsD,
    profilers  = {},
    cleanInterval,
    profiler = new EventEmitter();

module.exports = Profiler;

function Profiler(options) {
  if (options.host) {
    this.host = options.host;
    var statsdAddressMap = options.host.split(':');
    this.statsd = new StatsD(statsdAddressMap[0], statsdAddressMap[1]);
  }
  this.conf = options.aliases || {};

  this.defaultSampleRate = options.defaultSampleRate || 1;
  if (options.transformKey) {
    this.transformKey = options.transformKey || function(key) { return key; };
  }

  if (!cleanInterval) {
    var cleanTimer = options.cleanTimer || 5000;
    setInterval(function() {
      cleanUnusedProfilers(cleanTimer);
    }, cleanTimer);
  }
}

Profiler.init = function init(options) {
  return Profiler.defaultProfiler = new Profiler(options || {});
};

/**
 * wrapper around increment, decrement, timing, gauge using the config
 * @param {object} options
 *   key : key of the metric
 *   type : type of the measure (optional)
 *   val : value of the metric for the gauge (optional)
 *   timerID : it's the key of the time profiler. (optional)
 *   transformKeyArgs : [function] args to the function transformKey (optional)
 */
Profiler.prototype.measure = function measure(options) {
  var key = options.key;
  var transformKeyArgs = options.transformKeyArgs || [];
  var value;

  var config = this.conf[key] || options;

  if (config.key) {
    key = config.key;
  }

  if (options.type) {
    config.type = options.type;
  }

  if (config.sample_rate === undefined) {
    config.sample_rate = this.defaultSampleRate;
  }

  if (!options.timerID) {
    options.timerID = key;
  }

  if (this.transformKey) {
    transformKeyArgs.unshift(key);
    key = this.transformKey.apply(this, transformKeyArgs);
    if (key == null) {
      return 0;
    }
  }

  switch(config.type)
  {
    case 'timeStart' :
      profilers[options.timerID] = Date.now();
      value = 0;
      break;
    case 'timeEnd':
      var time = profile(options.timerID);
      if (time !== undefined) {
        this.statsd && this.statsd.timing(key, time, config.sample_rate);
      }
      value = time;
      break;
    case 'timing' :
      //if it's a number
      if (!isNaN(options.time)) {
        this.statsd && this.statsd.timing(key, options.time, config.sample_rate);
      }
      value = options.time;
      break;
    case 'gauge':
      if (!isNaN(options.val)) {
        this.statsd && this.statsd.gauge(key, options.val, config.sample_rate);
      }
      value = options.val;
      break;
    case 'decrement':
      this.statsd && this.statsd.decrement(key, config.sample_rate);
      value = 1;
      break;
    case 'count':
    case 'unique':
    case 'set':
      if (options.val) {
        this.statsd && this.statsd.set(key, options.val, config.sample_rate);
      }
      value = options.val;
      break;
    default:
      this.statsd && this.statsd.increment(key, config.sample_rate);
      value = 1;
  }

  return {type: config.type, val: value, key: key, rate: config.sample_rate};
};
Profiler.measure = function(options) {
  return Profiler.defaultProfiler.measure.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.increment = function increment(key) {
  return this.measure({
    type: "increment",
    key: key,
    transformKeyArgs : Array.prototype.splice.call(arguments, 1)
  });
};
Profiler.increment = function(key) {
  return Profiler.defaultProfiler.increment.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.set = Profiler.prototype.unique = Profiler.prototype.count = function count(key, val) {
  return this.measure({
    type: "count",
    key: key,
    val: val,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};
Profiler.set = Profiler.unique = Profiler.count = function(key, val) {
  return Profiler.defaultProfiler.count.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.decrement = function decrement(key) {
  return this.measure({
    type: "decrement",
    key: key,
    transformKeyArgs : Array.prototype.splice.call(arguments,1)
  });
};
Profiler.decrement = function(key) {
  return Profiler.defaultProfiler.decrement.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.gauge = function gauge(key, val) {
  return this.measure({
    type: "gauge",
    key: key,
    val: val,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};
Profiler.gauge = function(key, val) {
  return Profiler.defaultProfiler.gauge.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.timing = function timing(key, time) {
  return this.measure({
    type: "timing",
    key: key,
    time : time,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};
Profiler.timing = function(key, time) {
  return Profiler.defaultProfiler.timing.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.timeStart = function timeStart(key, timerID) {
  return this.measure({
    type: "timeStart",
    key: key,
    timerID: timerID,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};
Profiler.timeStart = function(key, timerID) {
  return Profiler.defaultProfiler.timeStart.apply(Profiler.defaultProfiler, arguments);
};

Profiler.prototype.timeEnd = function timeEnd(key, timerID) {
  return this.measure({
    type: "timeEnd",
    key: key,
    timerID: timerID,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};
Profiler.timeEnd = function(key, timerID) {
  return Profiler.defaultProfiler.timeEnd.apply(Profiler.defaultProfiler, arguments);
};

Profiler.StatsD = StatsD;
Profiler.timer = profilers;

/**
 * function profile (fzrequest, id)
 *
 * Tracks the time inbetween subsequent calls to this method
 * with the same `id` parameter. The second call to this method
 * will log the difference in milliseconds.
 *
 * @param  {[type]} key     key of the profiler
 */
function profile(key) {
  var now = Date.now(), then;

  if (profilers[key] !== undefined) {
    then = profilers[key];
    delete profilers[key];
    // Set the duration property of the metadata
    return now - then;
  }
}

//removed the unused timer.
function cleanUnusedProfilers(cleanTimer) {
  var time, now = Date.now(), key, len;
  for (key in profilers) {
    time = profilers[key];
    if (now - time > cleanTimer) {
      delete profilers[key];
    }
  }
}
