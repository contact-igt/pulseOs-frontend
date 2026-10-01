import type { FastifyReply, FastifyRequest } from "fastify";
import { editionHasCapability, hasPermission, type EditionCapability, type Permission } from "@pulseos/types";

export function requirePermission(permission: Permission) {
  return function permissionPreHandler(request: FastifyRequest, reply: FastifyReply, done: () => void) {
    const user = request.sessionUser;
    if (!user) {
      reply.status(401).send({ error: "unauthenticated" });
      return;
    }
    if (!hasPermission(user.role, permission)) {
      reply.status(403).send({ error: "forbidden", requiredPermission: permission });
      return;
    }
    done();
  };
}

/**
 * Edition gate. A tenant on Beta V1 has no access to growth capabilities even by calling the API directly —
 * hiding navigation is only a courtesy. 403 `feature_not_available` is distinct from a role-permission 403.
 */
export function requireCapability(capability: EditionCapability) {
  return function capabilityPreHandler(request: FastifyRequest, reply: FastifyReply, done: () => void) {
    const user = request.sessionUser;
    if (!user) {
      reply.status(401).send({ error: "unauthenticated" });
      return;
    }
    if (!editionHasCapability(user.edition, capability)) {
      reply.status(403).send({ error: "feature_not_available", capability, edition: user.edition });
      return;
    }
    done();
  };
}
