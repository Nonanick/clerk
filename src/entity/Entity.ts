import { IArchive } from '../archive/IArchive';
import { UnkownEntityProcedure } from '../error/entity/UnkownEntityPocedure';
import { MaybePromise } from '../error/Maybe';
import { Model } from "../model/Model";
import { IEntityProcedureHook } from '../procedure/entity/hook/IEntityProcedureHook';
import { IEntityProcedure } from '../procedure/entity/IEntityProcedure';
import { IEntityProcedureContext } from "../procedure/entity/IEntityProcedureContext";
import { IEntityProcedureRequest } from '../procedure/entity/IEntityProcedureRequest';
import { IEntityProcedureResponse } from '../procedure/entity/IEntityProcedureResponse';
import { IProxyEntityProcedureRequest } from '../procedure/entity/proxy/IProxyEntityProcedureRequest';
import { IProxyEntityProcedureResponse } from '../procedure/entity/proxy/IProxyEntityProcedureResponse';
import { IModelProcedureHook } from '../procedure/model/hook/IModelProcedureHook';
import { IModelProcedure } from '../procedure/model/IModelProcedure';
import { IProxyModelProcedureRequest } from '../procedure/model/proxy/IProxyModelProcedureRequest';
import { IProxyModelProcedureResponse } from '../procedure/model/proxy/IProxyModelProcedureResponse';
import { IPropertyIdentifier } from "../property/IProperty";
import { Property } from '../property/Property';
import { IFilterQuery } from "../query/filter/IFilterQuery";
import { IQueryRequest } from '../query/IQueryRequest';
import { IOrderBy } from "../query/order/IOrderBy";
import { QueryRequest } from "../query/QueryRequest";
import { Factory } from "./Factory";
import { IEntity } from "./IEntity";

export class Entity {

  protected _factory: Factory;

  protected _entity: IEntity;

  protected _archive: IArchive;

  get archive(): IArchive {
    return this._archive;
  }

  protected _procedures: EntityProcedures = {
    model: {},
    entity: {}
  };

  protected _properties: {
    [name: string]: Property;
  } = {};

  protected _proxies: EntityProxies = {
    entity: {
      procedure: {}
    },
    model: {
      procedure: {}
    }
  };

  protected _hooks: EntityHooks = {
    model: {
      procedure: {}
    },
    entity: {
      procedure: {}
    }
  };

  get name(): string {
    return this._entity.name;
  }

  get filters(): IFilterQuery {
    return this._entity.filters ?? {};
  }

  get proceduresFor() {
    return this._procedures;
  }

  hasFilters(): boolean {
    let keys = Object.keys(this.filters);
    return keys.length > 0;
  }

  get orderBy(): IOrderBy | undefined {
    return this._entity.orderBy != null ?
      typeof this._entity.orderBy === 'string' ?
        { property: this._entity.orderBy }
        : { ... this._entity.orderBy }
      : undefined;
  }

  hasOrdering(): boolean {
    return this.orderBy != null;
  }

  get identifier(): IPropertyIdentifier {
    return this._entity.identifier != null ?
      this._entity.identifier
      : { ...this._factory.defaultIdentifier };
  }

  get source(): string {
    return this._entity.source ?? this._entity.name;
  }

  get properties(): { [name: string]: Property; } {
    return this._properties;
  }

  constructor(init: IEntity, factory: Factory) {

    this._entity = init;
    this._factory = factory;

    // Properties
    let idProp = new Property(init.identifier ?? this._factory.defaultIdentifier);
    this._properties[idProp.name] = idProp;
    for (let propName in this._entity.properties) {
      this._properties[propName] = new Property({
        name: propName,
        ...this._entity.properties[propName]
      });;
    }

    this._archive = factory.archive;

    // Procedures
    this._procedures.entity = init.procedures?.entity ?? {};
    this._procedures.model = init.procedures?.model ?? {};

    // Proxies
    this._proxies.entity.procedure = init.proxy?.entity?.procedure ?? {};
    this._proxies.model.procedure = init.proxy?.model?.procedure ?? {};

    // Hooks
    this._hooks.entity.procedure = init.hooks?.procedure?.entity ?? {};
    this._hooks.model.procedure = init.hooks?.procedure?.model ?? {};
  }

  query(request?: Omit<IQueryRequest, "entity">): QueryRequest {
    let query = new QueryRequest(this);
    if (request !== undefined) {
      query.loadQueryRequest(request);
    }
    return query;
  }

  async execute<Context extends IEntityProcedureContext = IEntityProcedureContext>(
    procedure: string,
    context: Context
  ): MaybePromise<IEntityProcedureResponse> {

    if (this._procedures.entity[procedure] == null) {
      return new UnkownEntityProcedure(
        `Failed to execute procedure ${procedure} on entity ${this.name}, procedure not found!`
      );
    }

    let proc = this._procedures.entity[procedure];

    let request: IEntityProcedureRequest<Context> = {
      context: context,
      entity: this,
      procedure
    };

    // Apply request proxies from wildcard proxies
    for (let proxy of this._proxies.entity.procedure[ProcedureProxyWildcard]?.request ?? []) {
      let newRequest = await proxy.proxy(request);
      if (newRequest instanceof Error) {
        return newRequest;
      }
      request = newRequest as IEntityProcedureRequest<Context>;
    }

    // Apply request proxies from specific procedure
    for (let proxy of this._proxies.entity.procedure[procedure]?.request ?? []) {
      let newRequest = await proxy.proxy(request);
      if (newRequest instanceof Error) {
        return newRequest;
      }
      request = newRequest as IEntityProcedureRequest<Context>;
    }

    const maybeResponse = await proc.execute(this.archive, request);
    if (maybeResponse instanceof Error) {
      return maybeResponse;
    }
    let response = maybeResponse;

    // Apply response proxies from wildcard proxies
    for (let proxy of this._proxies.entity.procedure[ProcedureProxyWildcard]?.response ?? []) {
      let newResponse = await proxy.proxy(response);
      if (newResponse instanceof Error) {
        return newResponse;
      }
      response = newResponse;
    }

    // Apply response proxies from specific procedure
    for (let proxy of this._proxies.entity.procedure[procedure]?.response ?? []) {
      let newResponse = await proxy.proxy(response);
      if (newResponse instanceof Error) {
        return newResponse;
      }
      response = newResponse;
    }

    return response;

  }

  model(): Model {
    let model = new Model(this);

    // push procedures
    for (let procedure in this._procedures.model) {
      model.$addProcedure(this._procedures.model[procedure]);
    }

    // push procedure proxies
    for (let procedure in this._proxies.model.procedure) {
      // request
      let reqProxies = this._proxies.model.procedure[procedure].request;
      for (let reqProxy of reqProxies) {
        model.$proxyProcedure('request', procedure, reqProxy);
      }
      // response
      let resProxies = this._proxies.model.procedure[procedure].response;
      for (let resProxy of resProxies) {
        model.$proxyProcedure('response', procedure, resProxy);
      }
    }

    // push procedure hooks
    for (let procedure in this._hooks.model.procedure) {
      let hooks = this._hooks.model.procedure[procedure];
      for (let hook of hooks) {
        model.$hookProcedure(procedure, hook);
      }
    }

    return model;
  }

  // Apply all validations to model
  async validate(model: Model): MaybePromise<true> {

    for (let validationName in this._entity.validate ?? {}) {
      let validation = this._entity.validate![validationName];
      let isValid = validation.validation(model);

      if (isValid instanceof Promise) {
        isValid = await isValid;
      }

      if (isValid instanceof Error) {
        return isValid;
      }
    }

    return true;
  }

  addModelProcedure(name: string, procedure: IModelProcedure) {
    if (this._procedures.model[name] != null) {
      console.error(
        'Cannot override procedure with named', name,
        'on entity', this.name
      );
      return;
    };

    this._procedures.model[name] = procedure;
  }

  addEntityProcedure(name: string, procedure: IEntityProcedure<any>) {
    if (this._procedures.entity[name] != null) {
      console.error(
        'Cannot override procedure with name', name,
        'on entity ', this.name
      );
      return;
    };

    this._procedures.entity[name] = procedure;
  }

  proxyModelProcedure(
    procedure: string,
    type: 'request',
    proxy: IProxyModelProcedureRequest
  ): Entity;
  proxyModelProcedure(
    procedure: string,
    type: 'response',
    proxy: IProxyModelProcedureResponse
  ): Entity;
  proxyModelProcedure(
    procedure: string,
    type: 'request' | 'response',
    proxy: IProxyModelProcedureRequest | IProxyModelProcedureResponse
  ): Entity {
    if (this._proxies.model.procedure[procedure] == null) {
      this._proxies.model.procedure[procedure] = { request: [], response: [] };
    }

    this._proxies.model.procedure[procedure][type].push(proxy as any);
    return this;
  }

  proxyEntityProcedure(
    procedure: string,
    type: 'request',
    proxy: IProxyEntityProcedureRequest
  ): Entity;
  proxyEntityProcedure(
    procedure: string,
    type: 'response',
    proxy: IProxyEntityProcedureResponse
  ): Entity;
  proxyEntityProcedure(
    procedure: string,
    type: 'request' | 'response',
    proxy: IProxyEntityProcedureRequest | IProxyEntityProcedureResponse
  ): Entity {

    if (this._proxies.entity.procedure[procedure] == null) {
      this._proxies.entity.procedure[procedure] = { request: [], response: [] };
    }

    this._proxies.entity.procedure[procedure][type].push(proxy as any);
    return this;
  }

  addModelProcedureHook(
    procedure: string,
    hook: IModelProcedureHook
  ) {
    if (this._hooks.model.procedure[procedure] == null) {
      this._hooks.model.procedure[procedure] = [];
    }
    this._hooks.model.procedure[procedure].push(hook);
    return this;
  }

  addEntityProcedureHook(
    procedure: string,
    hook: IEntityProcedureHook
  ) {
    if (this._hooks.entity.procedure[procedure] == null) {
      this._hooks.entity.procedure[procedure] = [];
    }
    this._hooks.entity.procedure[procedure].push(hook);
    return this;
  }

}

type EntityProcedures = {
  model: {
    [name: string]: IModelProcedure;
  };
  entity: {
    [name: string]: IEntityProcedure;
  };
};

type EntityProxies = {
  model: {
    procedure: {
      [name: string]: {
        request: IProxyModelProcedureRequest[];
        response: IProxyModelProcedureResponse[];
      };
    };
  };
  entity: {
    procedure: {
      [name: string]: {
        request: IProxyEntityProcedureRequest[];
        response: IProxyEntityProcedureResponse[];
      };
    };
  };
};

type EntityHooks = {
  model: {
    procedure: {
      [name: string]: IModelProcedureHook[];
    };
  };
  entity: {
    procedure: {
      [name: string]: IEntityProcedureHook[];
    };
  };
};

export const ProcedureProxyWildcard = '_';