import type { JsonObject } from 'type-fest';
import type { IArchiveModel } from './IArchiveModel';

export interface ArchiveModelOf<T extends {} = JsonObject> extends IArchiveModel<T> {
  
}