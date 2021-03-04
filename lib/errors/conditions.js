'use strict';
const { IonError } = require('@iondv/core');

const PREFIX = 'conditions';

const errors = module.exports = {
  NON_APPLICABLE: `${PREFIX}.non_applicable`,
  ATTR_NOT_FOUND: `${PREFIX}.attr_not_found`,
  INVALID_AGGREG: `${PREFIX}.invalid_aggreg`,
  INVALID_CONDITION: `${PREFIX}.invalid_cond`,
  INVALID_OPERATION: `${PREFIX}.invalid_oper`,
  NO_ARGS: `${PREFIX}.no_args`,
};

IonError.registerMessages(errors);