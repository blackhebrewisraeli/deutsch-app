import {
  searchHandler,
  followHandler,
  unfollowHandler,
  listHandler,
} from '../_lib/socialEndpoints.js';
import { sendError } from '../_lib/respond.js';

// One deployed function for the whole social lane, dispatching on req.method —
// GET searches people (or lists the caller's own followers/following, see
// below), POST follows one, DELETE unfollows one. The three HTTP lanes have
// distinct methods, which is what makes a plain method switch safe: no `op`
// parameter is needed, the same way api/v1/account.js splits PATCH / GET /
// DELETE.
//
// GET has two shapes sharing one method because both are reads and neither is
// destructive: `?q=` searches, `?list=followers|following` lists the caller's
// own graph. A `list` param picks the second — see socialEndpoints.js for why
// that could not just live in api/v1/league/profile.js instead.
//
// THE FUNCTION BUDGET: this file is the 12th, and Vercel's Hobby plan caps a
// deployment at 12 Serverless Functions. That is why search, follow and the
// follow-list all share one file instead of splitting into
// api/v1/social/search.js, api/v1/social/follow.js and
// api/v1/social/list.js, and it is why the next endpoint added to this
// project cannot be a new file — it has to join an existing lane the way
// these did. The logic lives in api/_lib/socialEndpoints.js, which the
// underscore prefix excludes from deployment.
export default async function handler(req, res) {
  if (req.method === 'GET')
    return req.query?.list ? listHandler(req, res) : searchHandler(req, res);
  if (req.method === 'POST') return followHandler(req, res);
  if (req.method === 'DELETE') return unfollowHandler(req, res);
  return sendError(res, 'method_not_allowed', 'Method not allowed');
}
