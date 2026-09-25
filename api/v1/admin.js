import { sendError } from '../_lib/respond.js';
import {
  meHandler,
  feedbackGetHandler,
  feedbackPatchHandler,
  feedbackDeleteHandler,
  usersHandler,
  blockHandler,
} from '../_lib/adminEndpoints.js';
import { progressHandler, xpHandler, leagueHandler } from '../_lib/adminGodMode.js';
import { withCors } from '../_lib/origin.js';

// One deployed function for the admin lane. Hobby caps a deployment at 12
// Serverless Functions; this is the 11th. Dispatch is on req.query.op (and
// method, because feedback uses GET/PATCH/DELETE). vercel.json rewrites keep
// /api/v1/admin/me etc. working; the client also calls ?op= directly.
//
// The God Mode ops (progress / xp / league) are added here rather than as new
// files for exactly that cap: three more endpoints would be three more
// functions and would push the deployment over.

async function handler(req, res) {
  const op = req.query?.op;
  if (op === 'me') return meHandler(req, res);
  if (op === 'feedback') {
    if (req.method === 'GET') return feedbackGetHandler(req, res);
    if (req.method === 'PATCH') return feedbackPatchHandler(req, res);
    if (req.method === 'DELETE') return feedbackDeleteHandler(req, res);
    return sendError(res, 'method_not_allowed', 'Method not allowed');
  }
  if (op === 'users') return usersHandler(req, res);
  if (op === 'block') return blockHandler(req, res);
  if (op === 'progress') return progressHandler(req, res);
  if (op === 'xp') return xpHandler(req, res);
  if (op === 'league') return leagueHandler(req, res);
  return sendError(res, 'bad_request', 'Unknown admin operation.');
}

export default withCors(handler);
