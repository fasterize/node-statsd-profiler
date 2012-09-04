var StatsD = require('node-statsd').StatsD,
  statsd,
  conf,
  profilers  = {},
  initialized = false;

/**
 * function profile (fzrequest, id)
 *
 * Tracks the time inbetween subsequent calls to this method
 * with the same `id` parameter. The second call to this method
 * will log the difference in milliseconds.
 *
 * @param  {[type]} key     key of the profiler
 */
function profile (key) {
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
    if (now - time > exports.cleanTimer) {
      delete profilers[key];
    }
  }
}

exports.init = function init (options) {
  var stastdAddressMap = options.stastdAddress.split(':');
  initialized = true;
  statsd = new StatsD(stastdAddressMap[0], stastdAddressMap[1]);
  conf   = options.stastdconf || {};

  exports.defaultSampleRate = options.defaultSampleRate || 1;
  if (options.transformKey) {
    exports.transformKey = options.transformKey;
  }
  exports.cleanTimer = options.cleanTimer || 5000;

  setInterval(cleanUnusedProfilers, exports.cleanTimer);
};


exports.transformKey = function (key) {
  return key;
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
exports.measure = function measure(options) {
  var key = options.key;
  var transformKeyArgs = options.transformKeyArgs || [];

  if (!initialized) throw new Error("Not initialized, call init before");

  var config = conf[key] || options;

  if (config.key) {
    key = config.key;
  }

  if (options.type) {
    config.type = options.type;
  }

  if (config.sample_rate === undefined) {
    config.sample_rate = exports.defaultSampleRate;
  }

  if (!options.timerID) {
    options.timerID = key;
  }

  if (exports.transformKey) {
    transformKeyArgs.unshift(key);
    key = exports.transformKey.apply(this, transformKeyArgs);
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
    default:
      statsd.increment(key, config.sample_rate);
  }
};

exports.count = exports.increment = function increment (key) {
  exports.measure({
    type: "increment",
    key: key,
    transformKeyArgs : Array.prototype.splice.call(arguments,1)
  });
};

exports.decrement = function decrement (key) {
  exports.measure({
    type: "decrement",
    key: key,
    transformKeyArgs : Array.prototype.splice.call(arguments,1)
  });
};

exports.gauge = function gauge (key, val) {
  exports.measure({
    type: "gauge",
    key: key,
    val: val,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

exports.timing = function timing (key, time) {
  exports.measure({
    type: "timing",
    key: key,
    time : time,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

exports.timeStart = function timeStart (key, timerID) {
  exports.measure({
    type: "timeStart",
    key: key,
    timerID: timerID,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

exports.timeEnd = function timeEnd (key, timerID) {
  exports.measure({
    type: "timeEnd",
    key: key,
    timerID: timerID,
    transformKeyArgs : Array.prototype.splice.call(arguments,2)
  });
};

exports.StatsD = StatsD;
exports.timer = profilers;
