'use strict';
const { utils: { number2words } } = require('@iondv/commons');
const calc = require('../util').calculate;

module.exports = function (args) {
  return function () {
    return calc(this, args, null,
      function (args) {
        return number2words(args[0], args[1]);
      }
    );
  };
};
