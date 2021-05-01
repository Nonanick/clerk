
import type { Except } from 'type-fest';
import { IProperty } from '../../../interfaces/property/IProperty';
import { IPropertySanitizer } from '../../../interfaces/property/sanitizer/IPropertySanitizer';
import { IPropertySerializer } from '../../../interfaces/property/serialize/IPropertySerializer';
import { IPropertyUnserializer } from '../../../interfaces/property/serialize/IPropertyUnserializer';
import { IPropertyValidation } from '../../../interfaces/property/validation/IPropertyValidation';

export const StringTypeSymbol = Symbol('StringType');

export function StringType(typeDef?: StringTypeDefinition): Except<IStringTypeProperty, "name"> {

  const PropertyDef: Except<IStringTypeProperty, "name"> = { 
    type: StringTypeSymbol, 
    ...typeDef
  };

  return PropertyDef;
}

export interface IStringTypeProperty extends IProperty {

  type: Symbol;

  sanitizers?: { [name: string]: IPropertySanitizer<string>; };
  validations?: { [name: string]: IPropertyValidation<string>; };

  serializer?: IPropertySerializer<string, string>;
  unserializer?: IPropertyUnserializer<string, string>;

  default?: string | (() => string | null) | (() => Promise<string | null>) | null | undefined;

}

type StringTypeDefinition = Except<IStringTypeProperty, "type" | "name">;