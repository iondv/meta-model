/**
 * Created by kras on 03.11.16.
 */
'use strict';

const clone = require('clone');
const { Calculator: ICalculator } = require('@iondv/commons-contracts');
const { SequenceProvider } = require('@iondv/db-contracts');
const stdLib = require('./func');
const aggreg = require('./func/aggreg');
const data = require('./func/data');
const sequence = require('./func/sequence');
const parser = require('./func/parser');

/**
 * @param {{}} options
 * @param {DataRepository | String} options.dataRepo
 * @param {SequenceProvider} options.sequenceProvider
 * @param {Logger} [options.log]
 * @constructor
 */
function Calculator(options) {

  let funcLib = clone(stdLib);

  if (options.dataRepo) {
    funcLib.sum = aggreg.sum(options.dataRepo);
    funcLib.count = aggreg.count(options.dataRepo);
    funcLib.avg = aggreg.avg(options.dataRepo);
    funcLib.max = aggreg.max(options.dataRepo);
    funcLib.min = aggreg.min(options.dataRepo);
    funcLib.merge = aggreg.merge(options.dataRepo);
    funcLib.get = data.get(options.dataRepo);
  }
  if (options.sequenceProvider instanceof SequenceProvider) {
    funcLib.next = sequence.next(options.sequenceProvider);
  }

  /**
   * @param {String | {}} formula
   */
  this._parseFormula = function (formula, moptions) {
    return parser(formula, funcLib, () => options.dataRepo, moptions || {});
  };
}

Calculator.prototype = new ICalculator();

module.exports = Calculator;
