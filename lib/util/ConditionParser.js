'use strict';
// jshint maxstatements: 30

const {
  PropertyTypes,
  ConditionTypes,
  OperationTypes,
  FunctionCodes: Operations,
  data: { Item },
  util: {
    cast
  }
} = require('@iondv/meta-model-contracts');

const { IonError } = require('@iondv/core');

const { utils: { strToDate } } = require('@iondv/commons')

const errors = require('../errors/conditions');

const BoolOpers = [OperationTypes.AND, OperationTypes.OR, OperationTypes.NOT];
const AgregOpers = [OperationTypes.MIN, OperationTypes.MAX, OperationTypes.AVG,
  OperationTypes.SUM, OperationTypes.COUNT];
const Funcs = [
  OperationTypes.DATE, OperationTypes.DATEADD, OperationTypes.DATEDIFF, OperationTypes.ADD, OperationTypes.SUB,
  OperationTypes.MUL, OperationTypes.DIV, OperationTypes.MOD, OperationTypes.ROUND, OperationTypes.CONCAT,
  OperationTypes.SUBSTR, OperationTypes.ABS, OperationTypes.DATE_STR, OperationTypes.DATE_YEAR,
  OperationTypes.DATE_MONTH, OperationTypes.DATE_DAY, OperationTypes.DATE_HOUR, OperationTypes.DATE_MINUTE,
  OperationTypes.DATE_SECOND
];

// jshint maxstatements: 40, maxcomplexity: 50
/**
 * @param {*} v
 * @param {Item} context
 * @param {Number} type
 * @param {String} lang
 * @returns {*}
 */
function toScalar(v, context, type, lang) {
  if (Array.isArray(v)) {
    if (v.length === 1) {
      v = v[0];
    } else {
      let res = [];
      for (let i = 0; i < v.length; i++) {
        res.push(toScalar(v[i], context, type, lang));
      }
      return res;
    }
  }

  if (typeof v === 'string' && v[0] === '$') {
    if (v === '$$now') {
      return new Date();
    }

    if (v === '$$today') {
      v = new Date();
      v.setHours(0, 0, 0, 0);
      return v;
    }

    if (context) {
      let item = context instanceof Item ? context : context.$item instanceof Item ? context.$item : null;
      let nm = v.substring(1);
      let p;
      if (item && (p = item.property(nm)) !== null) {
        v = p.getValue();
      } else if (context.hasOwnProperty(nm)) {
        v = context[nm];
      } else {
        v = null;
      }
      if (Array.isArray(v)) {
        let result = [];
        v.forEach((v) => {
          result.push(toScalar(v, context, type, lang));
        });
        return result;
      }
    }
  }

  if (typeof v === 'string' && v[0] !== '$') {
    switch (type) {
      case PropertyTypes.DATETIME:
        v = strToDate(v, lang);
        return v;
      default:
        return cast(v, type);
    }
  }
  return v;
}

function findPM(cm, name) {
  var dot = name.indexOf('.');
  if (dot === -1) {
    return cm.getPropertyMeta(name);
  }

  var pm = cm.getPropertyMeta(name.substring(0, dot));
  if (pm && pm._refClass) {
    return findPM(pm._refClass, name.substring(dot + 1));
  }
  return null;
}

/**
 * @param {ClassMeta} rcm
 * @param {{}} condition
 * @param {Item} context
 * @param {String} lang
 */
function produceContainsFilter(rcm, condition, context, lang) {
  var pm = findPM(rcm, condition.property);
  if (pm) {
    if (pm.type === PropertyTypes.COLLECTION && pm._refClass) {
      if (Array.isArray(condition.value) && condition.value.length) {
        return {
          [Operations.CONTAINS]: [
              '$' + condition.property,
              {[Operations.IN]: [pm._refClass.getKeyProperties()[0], condition.value]}
          ]
        };
      }
      return {
        [Operations.CONTAINS]: [
          '$' + condition.property,
          conditionParser(condition.nestedConditions, pm._refClass, context, lang)
        ]
      };
    } else if (pm.type === PropertyTypes.STRING && condition.value) {
      let tmp = toScalar(condition.value, context);
      return {[Operations.LIKE]: ['$' + condition.property, tmp[0]]};
    } else {
      throw new IonError(errors.NON_APPLICABLE, {'condition': 'CONTAINS', 'class': rcm.getCanonicalName(), 'attr': condition.property});
    }
  } else {
    throw new IonError(errors.ATTR_NOT_FOUND, {'class': rcm.getCanonicalName(), 'attr': condition.property});
  }
}

/**
 * @param {ClassMeta} cm
 * @param {String} property
 */
function vt(cm, property) {
  let pm = findPM(cm, property);
  if (pm) {
    if (pm.type === PropertyTypes.REFERENCE) {
      if (pm._refClass.getKeyProperties().length === 1) {
        return vt(pm._refClass, pm._refClass.getKeyProperties()[0]);
      }
      return PropertyTypes.STRING;
    }
    return pm.type;
  }
  return PropertyTypes.STRING;
}

/**
 * @param {{}} condition
 * @param {String} type
 * @param {ClassMeta} rcm
 * @param {Item} context
 * @param {String} lang
 * @returns {{}}
 */
function produceFilter(condition, type, rcm, context, lang, unar) {
  let prop = condition.property;
  let args = [];
  if (prop[0] === '$') {
    prop = toScalar([prop], context, PropertyTypes.STRING, lang);
    args.push(prop);
  } else {
    args.push('$' + prop);
  }

  if (Array.isArray(condition.nestedConditions) && condition.nestedConditions.length) {
    let tmp = conditionParser(condition.nestedConditions[0], rcm, context);
    if (tmp) {
      args.push(tmp);
    }
  } else if (condition.value) {
    args = args.concat(toScalar(condition.value, context, vt(rcm, condition.property), lang));
  } else {
    if (!unar) {
      args.push(null);
    }
  }

  return {[type]: args};
}

/**
 * @param {{}} condition
 * @param {ClassMeta} rcm
 * @param {Item} context
 * @param {String} lang
 * @returns {{className: String, collectionName: String, property: String, filter: {}} | null}
 */
function produceAggregationOperation(condition, rcm, context, lang) {
  var an, av, pn, pm;
  if (!condition.value || !condition.value.length) {
    throw new IonError(code.INVALID_AGGREG);
  }

  if (condition.value.length === 1) {
    pn = condition.value[0];
    an = 'class';
    av = rcm.getCanonicalName();
  } else {
    pn = condition.value[1];
    av = condition.value[0];
    an = 'class';
    if ((pm = findPM(rcm, condition.value[0])) !== null) {
      if (pm.type === PropertyTypes.COLLECTION) {
        an = 'collection';
      }
    }
  }
  var result = [an, av, pn];
  var filter = conditionParser(condition.nestedConditions, rcm, context, lang);
  if (!filter) {
    result.push(filter);
  }
  return result;
}

/**
 * @param {Object[]} conditions
 * @param {ClassMeta} rcm
 * @param {Item} context
 * @param {String} lang
 * @returns {Array | null}
 */
function produceArray(conditions, rcm, context, lang) {
  let result = [];
  if (Array.isArray(conditions)) {
    for (let i = 0; i < conditions.length; i++) {
      let tmp = conditionParser(conditions[i], rcm, context, lang);
      result.push(tmp);
    }
  }
  return result.length ? result : null;
}

/**
 * @param {{}} condition
 * @param {ClassMeta} rcm
 * @param {Item} context
 * @param {String} lang
 * @returns {{} | null}
 */
function conditionParser(condition, rcm, context, lang) {
  if (Array.isArray(condition)) {
    let tmp = produceArray(condition, rcm, context, lang);
    if (tmp) {
      return tmp.length === 1 ? tmp[0] : {[Operations.AND]: tmp};
    }
    return null;
  } else {
    if (condition.property) {
      if (condition.operation === null) {
        return '$' + condition.property;
      }
      switch (parseInt(condition.operation)) {
        case ConditionTypes.EMPTY:
          return produceFilter(condition, Operations.EMPTY, rcm, context, lang, true);
        case ConditionTypes.NOT_EMPTY:
          return produceFilter(condition, Operations.NOT_EMPTY, rcm, context, lang, true);
        case ConditionTypes.CONTAINS:
          return produceContainsFilter(rcm, condition, context, lang);
        case ConditionTypes.EQUAL:
          return produceFilter(condition, Operations.EQUAL, rcm, context, lang);
        case ConditionTypes.NOT_EQUAL:
          return produceFilter(condition, Operations.NOT_EQUAL, rcm, context, lang);
        case ConditionTypes.LESS:
          return produceFilter(condition, Operations.LESS, rcm, context, lang);
        case ConditionTypes.MORE:
          return produceFilter(condition, Operations.GREATER, rcm, context, lang);
        case ConditionTypes.LESS_OR_EQUAL:
          return produceFilter(condition, Operations.LESS_OR_EQUAL, rcm, context, lang);
        case ConditionTypes.MORE_OR_EQUAL:
          return produceFilter(condition, Operations.GREATER_OR_EQUAL, rcm, context, lang);
        case ConditionTypes.LIKE:
          return produceFilter(condition, Operations.LIKE, rcm, context, lang);
          /*

          Result[condition.property] = {
            $regex: String(toScalar(condition.value, context))
              .replace(/[\[\]\.\*\(\)\\\/\?\+\$\^]/g, '\\$&')
              .replace(/\s+/g, '\\s+'),
            $options: 'i'
          }; break;

          */
        case ConditionTypes.IN: {
          let arr = toScalar(condition.value, context, vt(rcm, condition.property), lang);
          if (typeof arr === 'string' && arr && arr[0] === '$' || Array.isArray(arr)) {
            return {[Operations.IN]: ['$' + condition.property, arr]};
          }
          if (!Array.isArray(arr)) {
            arr = [arr];
          }
          return {[Operations.IN]: ['$' + condition.property, arr]};
        }
        default: throw new IonError(errors.INVALID_CONDITION);
      }
    } else {
      let oper = parseInt(condition.operation);
      if (BoolOpers.indexOf(oper) !== -1) {
        let tmp = produceArray(condition.nestedConditions, rcm, context, lang);
        if (tmp) {
          switch (oper) {
            case OperationTypes.AND: return {[Operations.AND]: tmp};
            case OperationTypes.OR: return {[Operations.OR]: tmp};
            case OperationTypes.NOT: return {[Operations.NOT]: tmp};
            default: throw new IonError(errors.INVALID_OPERATION);
          }
        } else {
          throw new IonError(errors.NO_ARGS);
        }
      } else if (AgregOpers.indexOf(oper) !== -1) {
        let tmp =  produceAggregationOperation(condition, rcm, context, lang);
        if (tmp) {
          switch (oper) {
            case OperationTypes.MIN: return {[Operations.MIN]: tmp};
            case OperationTypes.MAX: return {[Operations.MAX]: tmp};
            case OperationTypes.AVG: return {[Operations.AVG]: tmp};
            case OperationTypes.SUM: return {[Operations.SUM]: tmp};
            case OperationTypes.COUNT: return {[Operations.COUNT]: tmp};
            default: throw new IonError(errors.INVALID_OPERATION);
          }
        } else {
          throw new IonError(errors.NO_ARGS);
        }
      } else if (Funcs.indexOf(oper) !== -1) {
        let tmp = [];
        if (Array.isArray(condition.value) && condition.value.length) {
          tmp = tmp.concat(toScalar(condition.value, context, null, lang));
        }
        if (Array.isArray(condition.nestedConditions) && condition.nestedConditions.length) {
          tmp = tmp.concat(produceArray(condition.nestedConditions, rcm, context, lang));
        }
        switch (oper) {
          case OperationTypes.DATE: return {[Operations.DATE]: tmp};
          case OperationTypes.DATEADD:
            return {[Operations.DATE_ADD]: tmp};
          case OperationTypes.DATEDIFF:
            return {[Operations.DATE_DIFF]: tmp};
          case OperationTypes.DATE_DAY:
            return {[Operations.DATE_DAY]: tmp};
          case OperationTypes.DATE_HOUR:
            return {[Operations.DATE_HOUR]: tmp};
          case OperationTypes.DATE_MINUTE:
            return {[Operations.DATE_MINUTE]: tmp};
          case OperationTypes.DATE_SECOND:
            return {[Operations.DATE_SECOND]: tmp};
          case OperationTypes.DATE_MONTH:
            return {[Operations.DATE_MONTH]: tmp};
          case OperationTypes.DATE_YEAR:
            return {[Operations.DATE_YEAR]: tmp};
          case OperationTypes.DATE_STR:
            return {[Operations.DATE_STR]: tmp};
          case OperationTypes.ADD: return {[Operations.ADD]: tmp};
          case OperationTypes.SUB: return {[Operations.SUB]: tmp};
          case OperationTypes.MUL: return {[Operations.MUL]: tmp};
          case OperationTypes.DIV: return {[Operations.DIV]: tmp};
          case OperationTypes.ROUND: return {[Operations.ROUND]: tmp};
          case OperationTypes.CONCAT: return {[Operations.CONCAT]: tmp};
          case OperationTypes.SUBSTR: return {[Operations.SUBSTR]: tmp};
          case OperationTypes.MOD: return {[Operations.MOD]: tmp};
          case OperationTypes.ABS: return {[Operations.ABS]: tmp};
          default: throw new IonError(errors.INVALID_OPERATION);
        }
      } else if (condition.value && condition.value.length) {
        return toScalar(condition.value, context, PropertyTypes.STRING, lang);
      }
    }
  }
  return null;
}

module.exports = conditionParser;
module.exports.toScalar = toScalar;
