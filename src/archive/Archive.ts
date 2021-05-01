import { MaybePromise } from '../error/MaybePromise';
import { IArchiveEntity } from '../interfaces/archive/entity/IArchiveEntity';
import { IFactory } from '../interfaces/archive/factory/IFactory';
import { IArchive } from '../interfaces/archive/IArchive';
import { IArchiveProcedure } from '../interfaces/archive/procedure/IArchiveProcedure';
import { IArchiveProxy } from '../interfaces/archive/proxy/IArchiveProxy';
import { IArchiveProxyRequest } from '../interfaces/archive/proxy/IArchiveProxyRequest';
import { IArchiveProxyResponse } from '../interfaces/archive/proxy/IArchiveProxyResponse';
import { IQueryRequest } from '../interfaces/archive/query/IQueryRequest';
import { IEntity } from '../interfaces/entity/IEntity';
import { QueryRequest } from './entity/query/QueryRequest';
import { DefaultFactory } from './factory/DefaultFactory';
import { AllProcedures } from './proxy/AllProcedures';

export abstract class Archive implements IArchive {

  #factory: IFactory;

  #proxies: {
    [name: string]: IArchiveProxy
  } = {}

  constructor(factory?: IFactory) {
    this.#factory = factory != null ? factory : new DefaultFactory(this);
  }

  abstract entity(entity: IEntity<{}>): IArchiveEntity;

  abstract get procedures(): {
    [name: string]: IArchiveProcedure;
  }

  get allProxies(): { [name: string]: IArchiveProxy; } {
    return { ...this.#proxies };
  }

  get factory() {
    return this.#factory;
  }

  proxy(
    name: string,
    moment: 'request',
    procedure: string | string[] | Symbol | Symbol[],
    proxy: IArchiveProxyRequest['proxyFn']): IArchive;
  proxy(
    name: string,
    moment: 'response',
    procedure: string | string[] | Symbol | Symbol[],
    proxy: IArchiveProxyResponse['proxyFn']
  ): IArchive;
  proxy(
    name: string,
    moment: 'request' | 'response',
    procedure: string | string[] | Symbol | Symbol[],
    proxy: IArchiveProxy['proxyFn']): IArchive {

    this.#proxies[name] = {
      proxies: moment,
      procedure,
      proxyFn: proxy,
    } as IArchiveProxy;

    return this;
  }

  getRequestProxies(): IArchiveProxyRequest[];
  getRequestProxies(procedure: string | Symbol): IArchiveProxyRequest[];
  getRequestProxies(procedure?: string | Symbol): IArchiveProxyRequest[] {

    return Object.values(this.#proxies)
      // Only request proxies
      .filter(proxy => proxy.proxies === 'request')
      // That match the procedure being requested
      .filter(proxy => this.doesProxyMatchesProcedure(proxy, procedure)) as IArchiveProxyRequest[];
  }

  getResponseProxies(): IArchiveProxyResponse[];
  getResponseProxies(procedure: string): IArchiveProxyResponse[];
  getResponseProxies(procedure?: string): IArchiveProxyResponse[] {

    return Object.values(this.#proxies)
      // Only response proxies
      .filter(p => p.proxies === 'request')
      // That match procedure being requested
      .filter(p => this.doesProxyMatchesProcedure(p, procedure)) as IArchiveProxyResponse[];
  }

  doesProxyMatchesProcedure(proxy: IArchiveProxy, procedure?: string | Symbol): boolean {
    // Empty procedure => return all response proxies
    if (procedure == null) return true;

    // Exact match of procedure => include it in the return
    if (procedure === proxy.procedure || proxy.procedure === AllProcedures) return true;

    // Type annotation> Typescript wont let me generically call 'includes' when string and symbol are involved
    // This can be either an array of string or an array of symbols either way if the procedure, which can be 
    // identified by a symbol or string, is included in such array we will include this proxy as a returne value!
    if (
      Array.isArray(proxy.procedure)
      // Not actually stirng[]!
      && (proxy.procedure as string[]).includes(procedure as string)
    ) {
      return true;
    }

    return false;
  }

  abstract query(queryRequest : IQueryRequest) : MaybePromise<QueryRequest>;
}