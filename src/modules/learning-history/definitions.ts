import { definitionIdentitySchema } from "./schemas";
import type { DefinitionIdentity } from "./types";

export function definitionIdentityEquals(left: DefinitionIdentity, right: DefinitionIdentity): boolean {
  return left.definitionId === right.definitionId
    && left.definitionVersion === right.definitionVersion
    && left.definitionHash === right.definitionHash;
}

export function validateDefinitionIdentity(value: unknown): DefinitionIdentity {
  return Object.freeze(definitionIdentitySchema.parse(value)) as DefinitionIdentity;
}

