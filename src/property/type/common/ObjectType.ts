import { JsonObject } from 'type-fest';
import { InvalidProperty } from '../../../error/type/InvalidProperty';
import { IPropertyType } from '../IPropertyType';

export const ObjectType: IPropertyType = {
  name: 'Object',
  raw: 'object',
  sanitize: {
    name: 'Sanitize object',
    sanitize: (value: any) => Object.assign({}, value),
  },
  validate: {
    name: 'Is an object',
    validate: (value) => typeof value === 'object'
      ? true
      : new InvalidProperty("Property expected an object!")
  },
  toDTO() {
    return `{ [property : string] : any }`;
  } 
};
