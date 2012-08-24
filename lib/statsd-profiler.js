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

exports.init = function init (stastdHost, stastdPort, stastdconf) {
  initialized = true;
  statsd = new StatsD(stastdHost, stastdPort);
  conf   = stastdconf || {};
};

/**
 * wrapper around increment, decrement, timing, gauge using the config
 * @param {object} options
 *   key : key of the metric
 *   type : type of the measure (optional)
 *   val : value of the metric for the gauge (optional)
 *   sample_rate : sample-rate sent to statsd
 *   timerID : it's the key of the time profiler. (optional)
 *   transformKey : [function] modify the key sent to statsd to add a prefix, suffix... (optional)
 */
exports.measure = function measure(options) {
  if (!initialized) throw new Error("Not initialized, call init before");

  var config = conf[options.key] || options;

  if (!config.key) {
    config.key = options.key;
  }

  if (options.type) {
    config.type = options.type;
  }

  if (config.sample_rate === undefined) {
    config.sample_rate = options.sample_rate || 1;
  }

  if (config.type === "timing" && options.timerID) {
    config.type = "timeEnd";
  }

  if (!options.timerID) {
    options.timerID = config.key;
  }

  if (options.transformKey) {
    config.key = options.transformKey(config.key);
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

exports.count = exports.increment = function increment (key, sampleRate, transformKey) {
  exports.measure({
    type: "increment",
    key: key,
    sample_rate : sampleRate,
    transformKey : transformKey
  });
};

exports.decrement = function decrement (key, sampleRate, transformKey) {
  exports.measure({
    type: "decrement",
    key: key,
    sample_rate : sampleRate,
    transformKey : transformKey
  });
};

exports.gauge = function gauge (key, val, sampleRate, transformKey) {
  exports.measure({
    type: "gauge",
    key: key,
    val: val,
    sample_rate : sampleRate,
    transformKey : transformKey
  });
};

exports.timing = function timing (key, time, sampleRate, transformKey) {
  exports.measure({
    type: "timing",
    key: key,
    time : time,
    sample_rate: sampleRate,
    transformKey: transformKey
  });
};

exports.timeStart = function timeStart (key, timerID, sampleRate, transformKey) {
  exports.measure({
    type: "timeStart",
    key: key,
    timerID: timerID,
    sample_rate : sampleRate,
    transformKey : transformKey
  });
};

exports.timeEnd = function timeEnd (key, timerID, sampleRate, transformKey) {
  exports.measure({
    type: "timeEnd",
    key: key,
    timerID: timerID,
    sample_rate : sampleRate,
    transformKey : transformKey
  });
};

exports.StatsD = StatsD;
