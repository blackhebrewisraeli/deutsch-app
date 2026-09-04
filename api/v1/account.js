import { profileHandler, exportHandler, deleteHandler } from '../_lib/accountEndpoints.js';
import { sendError } from '../_lib/respond.js';

// One deployed function for the whole account lane, dispatching on
// req.method — PATCH edits the profile, GET exports the caller's data, DELETE
// permanently removes the account. The three lanes have distinct methods,
// which is what makes a plain method switch safe here: no action parameter is
// needed.
//
// This split exists only because Vercel's Hobby plan caps a deployment at 12
// Serverless Functions; api/v1/account/profile.js, export.js and delete.js
// were merged into this one file (their logic now lives in
// api/_lib/accountEndpoints.js, which the underscore prefix excludes from
// deployment). The public URLs /api/v1/account/profile, /api/v1/account/export
// and /api/v1/account/delete are preserved by rewrites in vercel.json.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return profileHandler(req, res);
  if (req.method === 'GET') return exportHandler(req, res);
  if (req.method === 'DELETE') return deleteHandler(req, res);
  return sendError(res, 'method_not_allowed', 'Method not allowed');
}
