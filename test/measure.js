var mocha = require('mocha'),
    should = require('should'),
    sinon = require('sinon'),
    profiler = require('../lib/statsd-profiler'),
    StatsD = require('node-statsd').StatsD;

describe('statsd-profiler', function(){

  describe('#mesure()', function(){
    it('should be called only after init', function(){
      (function(){
        profiler.measure("test");
      }).should.throwError();
    });

    describe('after an init', function () {
      var constructor, increment, decrement, timing, gauge;

      before(function () {
        //stub statsd
        increment = sinon.stub(profiler.StatsD.prototype, "increment");
        decrement = sinon.stub(profiler.StatsD.prototype, "decrement");
        timing = sinon.stub(profiler.StatsD.prototype, "timing");
        gauge = sinon.stub(profiler.StatsD.prototype, "gauge");

        profiler.init('localhost', 3000, {
          "js-parsing" : {},
          "html-dec" : {'type' : 'decrement'},
          "html-dec-2" : {'type' : 'decrement', 'sample_rate' : 0.7},
          "html-size" : {'type' : 'gauge'},
          "html-size-rate" : {'type' : 'gauge', 'sample_rate' : 0.6},
          "req" : {'type' : 'timing'},
          "req2" : {'type' : 'timing'},
          "customKey" : {'key' : 'engine.metrics.html.size'}
        });

      });

      describe('without any config', function () {
        it ('increment should call statsd.increment', function () {
          profiler.increment("html-parser");
          sinon.assert.calledWithExactly(increment, 'html-parser', 1);
        });

        it ('decrement should call statsd.decrement', function () {
          profiler.decrement("html-parser");
          sinon.assert.calledWithExactly(decrement, 'html-parser', 1);
        });

        it ('gauge should call statsd.gauge', function () {
          profiler.gauge("html-parser", 300);
          sinon.assert.calledWithExactly(gauge, 'html-parser', 300, 1);
        });

        it ('timing should call statsd.timing', function () {
          profiler.timing("html-parser", 300);
          sinon.assert.calledWithExactly(timing, 'html-parser', 300, 1);
        });

        it ('timeStart and timeEnd should call statsd.timing', function (done) {
          profiler.timeStart("html-parser");
          setTimeout(function () {
            profiler.timeEnd("html-parser");
            sinon.assert.calledWith(timing, 'html-parser');
            done();
          }, 10);
        });

        it ('sample-rate params should change the default sample-rate', function () {
          profiler.count('html-parser', 0.4);
          sinon.assert.calledWithExactly(increment, 'html-parser', 0.4);
        });
      });

      describe('with a config', function () {
        it ('measure should call statsd.decrement for html-dec', function () {
          profiler.measure({key : "html-dec"});
          sinon.assert.calledWithExactly(decrement, 'html-dec', 1);
        });

        it ('should callstatsd.decrement for html-dec-2 with sample-rate=0.7', function () {
          profiler.measure({key : "html-dec-2"});
          sinon.assert.calledWithExactly(decrement, 'html-dec-2', 0.7);
        });

        it ('should call statsd.gauge for html-size', function () {
          profiler.measure({key : "html-size-rate", val : 300});
          sinon.assert.calledWithExactly(gauge, 'html-size-rate', 300, 0.6);
        });

        it ('should call statsd.timing for req', function (done) {
          profiler.measure({ key : "req"});
          setTimeout(function () {
            profiler.measure({ key : "req"});
            sinon.assert.calledWith(timing, 'req');
            done();
          }, 10);
        });

        it ('should call statsd.timing for req', function (done) {
          profiler.measure({ key : "req2", timerID: "timerID"});
          profiler.measure({ key : "req2", timerID: "timerID2"});

          setTimeout(function () {
            profiler.measure({ key : "req2", timerID: "timerID"});
            sinon.assert.calledWith(timing, 'req2');
          }, 10);

          setTimeout(function () {
            profiler.measure({ key : "req2", timerID: "timerID2"});
            sinon.assert.calledWith(timing, 'req2');
            done();
          }, 15);
        });

        it('should call statsd.increment with a custom key', function () {
          profiler.increment('customKey');
          sinon.assert.calledWithExactly(increment, 'engine.metrics.html.size', 1);
        });
      });

      describe('customize measure' , function () {
        before(function (){
          var simpleMeasure = profiler.increment;

          profiler.increment = function (fzrequest, key) {
            simpleMeasure(key, 1 , function (key) {
                return fzrequest.hostname + '.' + key;
            });
          };
        });

        it('should call increment with the good key', function (){
          profiler.increment({'hostname': "host", "_id" : 3}, 'html-parser');
          sinon.assert.calledWithExactly(increment, 'host.html-parser', 1);
        });
      });
    });
  });
});
