import type { Request, Response } from "express";

import { AppError } from "../../utils/app-error";
import {
  createTransferSchema,
  listTransfersQuerySchema,
  rejectTransferSchema,
  transferDecisionSchema,
  transferIdParamsSchema,
} from "./transfers.schema";
import {
  approveTransfer,
  listTransfers,
  rejectTransfer,
  requestTransfer,
} from "./transfers.service";

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

export async function listTransfersController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const query = listTransfersQuerySchema.parse(request.query);
  response.json({
    data: await listTransfers(query, {
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}

export async function requestTransferController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const input = createTransferSchema.parse(request.body);
  response.status(201).json({
    data: await requestTransfer(input, {
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}

export async function approveTransferController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const { id } = transferIdParamsSchema.parse(request.params);
  const input = transferDecisionSchema.parse(request.body);
  response.json({
    data: await approveTransfer(id, input, {
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}

export async function rejectTransferController(
  request: Request,
  response: Response,
) {
  const auth = requireAuth(request);
  const { id } = transferIdParamsSchema.parse(request.params);
  const input = rejectTransferSchema.parse(request.body);
  response.json({
    data: await rejectTransfer(id, input, {
      employeeId: auth.employeeId,
      role: auth.role,
    }),
  });
}
