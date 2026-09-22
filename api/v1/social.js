import { searchHandler, followHandler, unfollowHandler } from '../_lib/socialEndpoints.js';
import { sendError } from '../_lib/respond.js';

// One deployed function for the whole social lane, dispatching on req.method —
// GET searches people, POST follows one, DELETE unfollows one. The three lanes
// have distinct methods, which is what makes a plain method switch safe: no
// `op` parameter is needed, the same way api/v1/account.js splits PATCH / GET
// / DELETE.
//
// THE FUNCTION BUDGET: this file is the 12th, and Vercel's Hobby plan caps a
// deployment at 12 Serverless Functions. That is why search and follow share
// one file instead of being api/v1/social/search.js and
// api/v1/social/follow.js, and it is why the next endpoint added to this
// project cannot be a new file — it has to join an existing lane the way these
// three did. The logic lives in api/_lib/socialEndpoints.js, which the
// underscore prefix excludes from deployment.
export default async function handler(req, res) {
  if (req.method === 'GET') return searchHandler(req, res);
  if (req.method === 'POST') return followHandler(req, res);
  if (req.method === 'DELETE') return unfollowHandler(req, res);
  return sendError(res, 'method_not_allowed', 'Method not allowed');
}
