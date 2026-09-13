import type { FastifyReply, FastifyRequest } from "fastify";
import { hasPermission, type Permission } from "@pulseos/types";

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
