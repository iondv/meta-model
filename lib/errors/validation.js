'use strict';

const { IonError } = require('@iondv/core');
const { w: t } = require('@iondv/i18n');

const PREFIX = 'validation';

const codes = module.exports = {
  INCORRECT_VALUE: {
    INT: `${PREFIX}.iv.int`,
    REAL: `${PREFIX}.iv.rl`,
    DECIMAL: `${PREFIX}.iv.dcml`,
    DATETIME: `${PREFIX}.iv.dt`,
    PERIOD: `${PREFIX}.iv.prd`,
    DEFAULT: `${PREFIX}.iv.def`
  }
};

const defaultMessage = t('Invalid value assigned to attribute %class.%property.');
const messageForRealAndDecimal = t('Attribute %class.%property value should be a number (fractional part should be separated with dot).');
const messageForDatetimeAndPeriod = t('Invalid date value assigned to attribute %class.%property.');

IonError.registerMessages({
  [codes.INCORRECT_VALUE.INT]: t('Attribute %class.%property value should be an integer number.'),
  [codes.INCORRECT_VALUE.REAL]: messageForRealAndDecimal,
  [codes.INCORRECT_VALUE.DECIMAL]: messageForRealAndDecimal,
  [codes.INCORRECT_VALUE.DATETIME]: messageForDatetimeAndPeriod,
  [codes.INCORRECT_VALUE.PERIOD]: messageForDatetimeAndPeriod,
  [codes.INCORRECT_VALUE.DEFAULT]: defaultMessage
});
