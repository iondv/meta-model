'use strict';
const { IonError } = require('@iondv/core');
const { w: t } = require('@iondv/i18n');

const PREFIX = 'conditions';

const codes = module.exports = {
  NON_APPLICABLE: `${PREFIX}.non_applicable`,
  ATTR_NOT_FOUND: `${PREFIX}.attr_not_found`,
  INVALID_AGGREG: `${PREFIX}.invalid_aggreg`,
  INVALID_CONDITION: `${PREFIX}.invalid_cond`,
  INVALID_OPERATION: `${PREFIX}.invalid_oper`,
  NO_ARGS: `${PREFIX}.no_args`,
};

IonError.registerMessages({
  [codes.NON_APPLICABLE]: t('Condition %condition is not applicable to attribute %class.%attr.'),
  [codes.ATTR_NOT_FOUND]: t('Attribute %class.%attr specified for condition is not found.'),
  [codes.INVALID_AGGREG]: t('Aggregation operation specification is invalid - class and attribute are not specified.'),
  [codes.INVALID_OPERATION]: t('Invalid operation type'),
  [codes.INVALID_CONDITION]: t('Invalid condition type'),
  [codes.NO_ARGS]: t('Operation arguments are not specified'),
});