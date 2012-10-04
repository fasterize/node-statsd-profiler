var
  EventEmitter = require('events').EventEmitter,
  StatsD = require('node-statsd').StatsD,
  statsd,
  conf,
  profilers  = {},
  profiler = new EventEmitter(),
  initialized = false;

module.exports = profiler;

profiler.init = function init (options) {
  var statsdAddressMap = options.host.split(':');
  initialized = true;
  statsd = new StatsD(statsdAddressMap[0], statsdAddressMap[1]);
  conf   = options.aliases || {};

  profiler.defaultSampleRate = options.defaultSampleRate || 1;
  if (options.transformKey) {
    profiler.transformKey = options.transformKey;
  }
  profiler.cleanTimer = options.cleanTimer || 5000;

  setInterval(cleanUnusedProfilers, profiler.cleanTimer);
};


profiler.transformKey = function(key) {
  return key;
};

profiler.measure = measure;
/**
 * wrapper around increment, decrement, timing, gauge using the config
 * @param {object} options
 *   key : key of the metric
 *   type : type of the measure (optional)
 *   val : value of the metric for the gauge (optional)
 *   timerID : it's the key of the time profiler. (optional)
 *   transformKeyArgs : [function] args to the function transformKey (optional)
 */
function measure(options) {
  var key = options.key;
  var transformKeyArgs = options.transformKeyArgs || [];

  if (!initialized) {
    return profiler.emit('error', new Error("Not initialized, call init before"));
  }

  var config = conf[key] || options;

  if (config.key) {
    key = config.key;
  }

  if (options.type) {
    config.type = options.type;
  }

  if (config.sample_rate === undefined) {
    config.sample_rate = profiler.defaultSampleRate;
  }

  if (!options.timerID) {
    options.timerID = key;
  }

  if (profiler.transformKey) {
    transformKeyArgs.unshift(key);
    key = profiler.transformKey.apply(this, transformKeyArgs);
  }

  switch(config.type)
  {
    case 'timeStart' :
      profilers[options.timerID] = Date.now();
      break;
    case 'timeEnd':
      var time = profile(options.timerID);
      if (time) {
        statsd.timing(key, time, config.sample_rate);
      }
      break;
    case 'timing' :
      statsd.timing(key, options.time, config.sample_rate);
      break;
    case 'gauge':
      statsd.gauge(key, options.val, config.sample_rate);
      break;
    case 'decrement':
      statsd.decrement(key, config.sample_rate);
      break;
    case 'count':
      statsd.update_stats(key, options.val, config.sample_rate);
      break;
    default:
      statsd.increment(key, config.sample_rate);
  }

  return profiler;
}

profiler.increment = function increment(key) {
  return measure({
    type: "increment",
    key: key,
    transformKeyArgs : Array.prototype.splice.call(arguments,1)
  });
};

profiler.count =  function count(key, val) {
  return measure({
    type: "count",
    key: key,
    val: val,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

profiler.decrement = function decrement(key) {
  return measure({
    type: "decrement",
    key: key,
    transformKeyArgs : Array.prototype.splice.call(arguments,1)
  });
};

profiler.gauge = function gauge(key, val) {
  return measure({
    type: "gauge",
    key: key,
    val: val,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

profiler.timing = function timing(key, time) {
  return measure({
    type: "timing",
    key: key,
    time : time,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

profiler.timeStart = function timeStart(key, timerID) {
  return measure({
    type: "timeStart",
    key: key,
    timerID: timerID,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

profiler.timeEnd = function timeEnd(key, timerID) {
  return measure({
    type: "timeEnd",
    key: key,
    timerID: timerID,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

profiler.StatsD = StatsD;
profiler.timer = profilers;

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

  if (profilers[key]) {
    then = profilers[key];
    delete profilers[key];
    // Set the duration property of the metadata
    return now - then;
  }
}

//removed the unused timer.
function cleanUnusedProfilers() {
  var time, now = Date.now(), key, len;
  for (key in profilers) {
    time = profilers[key];
    if (now - time > profiler.cleanTimer) {
      delete profilers[key];
    }
  }
}
