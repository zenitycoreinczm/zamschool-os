import { NextResponse } from "next/server";

import { requireActorContext } from "@/lib/server-auth";
import type { ActorContext, KnownRole } from "@/lib/server-auth-core";
import {
  requireFeatureAccess,
  type FeatureAction,
} from "@/lib/feature-permissions";
import {
  assertDomainAccess,
  type DomainAction,
  type SchoolDomain,
} from "@/lib/domain-ownership";

export type RouteAccessOptions = {
  allowedRoles: KnownRole[];
  requireSchool?: boolean;
  feature?: string;
  featureAction?: FeatureAction;
  domain?: SchoolDomain;
  domainAction?: DomainAction;
};

export type RouteAccessResult =
  | { ok: true; context: ActorContext }
  | { ok: false; response: NextResponse };

/**
 * Canonical API enforcement pipeline:
 * Authenticate → Role → Feature permission → Domain rule → Route logic → Audit.
 *
 * The caller still owns route logic and must audit successful mutations.
 */
export async function enforceRouteAccess(
  req: Request,
  options: RouteAccessOptions,
): Promise<RouteAccessResult> {
  const access = await requireActorContext(
    {
      allowedRoles: options.allowedRoles,
      requireSchool: options.requireSchool ?? true,
    },
    req,
  );
  if (!access.ok) return access;

  if (options.feature && options.featureAction) {
    const feature = await requireFeatureAccess(
      access.context,
      options.feature,
      options.featureAction,
    );
    if (!feature.ok) return feature;
  }

  if (options.domain) {
    const domain = assertDomainAccess({
      domain: options.domain,
      role: access.context.role,
      action: options.domainAction,
    });
    if (!domain.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: domain.error }, { status: 403 }),
      };
    }
  }

  return access;
}
