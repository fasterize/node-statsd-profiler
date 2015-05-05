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
      var constructor, increment, decrement, timing, gauge, set;

      before(function () {
        //stub statsd
        increment = sinon.stub(profiler.StatsD.prototype, "increment");
        decrement = sinon.stub(profiler.StatsD.prototype, "decrement");
        timing = sinon.stub(profiler.StatsD.prototype, "timing");
        gauge = sinon.stub(profiler.StatsD.prototype, "gauge");
        set = sinon.stub(profiler.StatsD.prototype, "set");

        profiler.init({
          host: 'localhost:3000',
          aliases: {
            "js-parsing" : {},
            "html-dec" : {'type' : 'decrement'},
            "html-dec-2" : {'type' : 'decrement', 'sample_rate' : 0.7},
            "html-size" : {'type' : 'gauge'},
            "html-size-rate" : {'type' : 'gauge', 'sample_rate' : 0.6},
            "req" : {'type' : 'timing'},
            "req2" : {'type' : 'timing'},
            "customKey" : {'key' : 'engine.metrics.html.size'}
          },
          defaultSampleRate: 1,
          transformKey: undefined,
          cleanTimer: 500
        });
      });

      describe('without any config', function () {
        it ('increment should call statsd.increment', function () {
          profiler.increment("html-parser");
          sinon.assert.calledWithExactly(increment, 'html-parser', 1);
        });

        it ('count should call statsd.set', function () {
          profiler.count("html-size", 300);
          sinon.assert.calledWithExactly(set, 'html-size', 300, 1);
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
            var result = profiler.timeEnd("html-parser");
            sinon.assert.calledWith(timing, 'html-parser');
            result.val.should.be.above(0);
            done();
          }, 10);
        });

        it ('timeStart and timeEnd should return 0 when no time has passed', function () {
          var clock = sinon.useFakeTimers(),
              result;

          profiler.timeStart("html-parser");
          result = profiler.timeEnd("html-parser");

          clock.restore();
          result.val.should.equal(0);
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

        it ('should call statsd.timing for req and req2', function (done) {
          profiler.timeStart("req2", "timerID");
          profiler.timeStart("req2", "timerID2");

          setTimeout(function () {
            profiler.timeEnd("req2", "timerID");
            sinon.assert.calledWith(timing, 'req2');
          }, 10);

          setTimeout(function () {
            profiler.timeEnd("req2", "timerID2");
            sinon.assert.calledWith(timing, 'req2');
            done();
          }, 15);
        });

        it('should call statsd.increment with a custom key', function () {
          profiler.increment('customKey');
          sinon.assert.calledWithExactly(increment, 'engine.metrics.html.size', 1);
        });

        it('should accept multiple StartTime and one EndTime', function (done) {
          profiler.timeStart('req3');
          setTimeout(function () {
            profiler.timeStart('req3');
          }, 20);
          setTimeout(function () {
            profiler.timeEnd('req3');
            sinon.assert.calledWith(timing, 'req3');
            done();
          }, 40);
        });
      });

      describe('customize measure' , function () {
        before(function (){

          profiler.transformKey = function (key, req, serv) {
            return req.hostname + '.' + key + '.' + serv;
          };
        });

        it('should call increment with the good key', function (){
          profiler.increment('html-parser', {'hostname': "host"}, 'server1');
          sinon.assert.calledWithExactly(increment, 'host.html-parser.server1', 1);
        });
      });

      describe('customize measure' , function () {
        before(function (){
          profiler.transformKey = function (key, req, serv) {
            return req.hostname + '.' + key + '.' + serv;
          };
        });

        after(function () {
          profiler.transformKey = function (key) {
            return key;
          };
        });

        it('should call increment with the good key', function (){
          profiler.increment('html-parser', {'hostname': "host"}, 'server1');
          sinon.assert.calledWithExactly(increment, 'host.html-parser.server1', 1);
        });
      });

      describe('clear timer' , function () {
        it('should clear all the timer superior to 10 sec', function (done){
          profiler.timeStart('timer');
          setTimeout(function () {
            should.strictEqual(undefined, profiler.timer['timer']);
            done();
          }, 1000);
        });
      });

      describe('with undefined value' , function () {

        it('should not call statsd with an undefined value ', function (){
          profiler.timing("html-parser", undefined);
          sinon.assert.neverCalledWith(timing, "html-parser", undefined);

          profiler.count("html-parser", undefined);
          sinon.assert.neverCalledWith(set, "html-parser", undefined);

          profiler.gauge("html-parser", undefined);
          sinon.assert.neverCalledWith(gauge, "html-parser", undefined);
        });
      });

      describe('with null key' , function () {
        it('should not call statsd with a Null key by timing ', function (){
          // make sure that 999999 are only used in this test
          profiler.timing(null, 999999);
          sinon.assert.neverCalledWith(timing,sinon.match.any , 999999);
        });

        it('count should not call statsd with a Null key by count', function (){
          profiler.count(null, 999999);
          sinon.assert.neverCalledWith(set, sinon.match.any, 999999);
        });

        it('should not call statsd with a Null key by gauge', function (){
          profiler.gauge(null, 999999);
          sinon.assert.neverCalledWith(gauge, sinon.match.any, 999999);
        });

        it ('should not call statsd.timing with a Null key by timerStart/End', function (done) {
          var lessThan5 = sinon.match(function (value) {
            return (value < 5);
          }, "lessThan");

          profiler.timeStart(null, "timerID");
          setTimeout(function () {
            profiler.timeEnd(null, "timerID");
            sinon.assert.neverCalledWith(timing, sinon.match.number, lessThan5 );
            done();
          }, 0);
        });
      });
    });
  });
});
