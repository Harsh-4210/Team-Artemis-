import type { Request, Response } from "express";

import { AppError } from "../../utils/app-error";
import {
  allocationIdParamsSchema,
  createAllocationSchema,
  listAllocationsQuerySchema,
  returnAllocationSchema,
} from "./allocations.schema";
import {
  allocateAsset,
  listAllocations,
  listOverdueAllocations,
  markOverdueAllocations,
  returnAllocation,
} from "./allocations.service";

function requireAuth(request: Request) {
  if (!request.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }
  return request.auth;
}

export async function listAllocationsController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const query = listAllocationsQuerySchema.parse(request.query);
  response.json({
    data: await listAllocations(query, {
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}

export async function listOverdueAllocationsController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  response.json({
    data: await listOverdueAllocations({
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}

export async function markOverdueAllocationsController(
  _request: Request,
  response: Response,
) {
  response.json({ data: await markOverdueAllocations() });
}

export async function createAllocationController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const input = createAllocationSchema.parse(request.body);
  response
    .status(201)
    .json({
      data: await allocateAsset(input, {
        employeeId: auth.employeeId,
        role: auth.role,
      }),
    });
}

export async function returnAllocationController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const { id } = allocationIdParamsSchema.parse(request.params);
  const input = returnAllocationSchema.parse(request.body);
  response.json({
    data: await returnAllocation(id, input, {
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}
