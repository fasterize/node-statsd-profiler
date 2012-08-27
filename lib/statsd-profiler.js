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
  else {
    profilers[key] = now;
  }
}

exports.init = function init (stastdHost, stastdPort, stastdconf, defaultSampleRate, transformKey) {
  initialized = true;
  statsd = new StatsD(stastdHost, stastdPort);
  conf   = stastdconf || {};
  exports.defaultSampleRate = defaultSampleRate || 1;
  exports.transformKey = transformKey;
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
  var transformKeyArgs = options.transformKeyArgs || [];

  if (!initialized) throw new Error("Not initialized, call init before");

  var config = conf[options.key] || options;

  if (!config.key) {
    config.key = options.key;
  }

  if (options.type) {
    config.type = options.type;
  }

  if (config.sample_rate === undefined) {
    config.sample_rate = exports.defaultSampleRate;
  }

  if (config.type === "timing" && options.timerID) {
    config.type = "timeEnd";
  }

  if (!options.timerID) {
    options.timerID = config.key;
  }

  if (exports.transformKey) {
    transformKeyArgs.unshift(config.key);
    config.key = exports.transformKey.apply(this, transformKeyArgs);
  }

  switch(config.type)
  {
    case 'timeEnd':
    case 'timeStart' :
      var time = profile(options.timerID);
      if (time) {
        statsd.timing(config.key, time, config.sample_rate);
      }
      break;
    case 'timing' :
      statsd.timing(config.key, config.time, config.sample_rate);
      break;
    case 'gauge':
      statsd.gauge(config.key, options.val, config.sample_rate);
      break;
    case 'decrement':
      statsd.decrement(config.key, config.sample_rate);
      break;
    default:
      statsd.increment(config.key, config.sample_rate);
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
