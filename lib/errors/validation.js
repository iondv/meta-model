'use strict';

const { IonError } = require('@iondv/core');

const PREFIX = 'validation';

const errors = module.exports = {
  INCORRECT_VALUE: {
    INT: `${PREFIX}.iv.int`,
    REAL: `${PREFIX}.iv.rl`,
    DECIMAL: `${PREFIX}.iv.dcml`,
    DATETIME: `${PREFIX}.iv.dt`,
    PERIOD: `${PREFIX}.iv.prd`,
    DEFAULT: `${PREFIX}.iv.def`
  }
};

IonError.registerMessages(errors);
