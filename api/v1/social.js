import {
  searchHandler,
  followHandler,
  unfollowHandler,
  listHandler,
} from '../_lib/socialEndpoints.js';
import { sendError } from '../_lib/respond.js';
import { withCors } from '../_lib/origin.js';

// One deployed function for the whole social lane. GET lists the caller's own
// followers/following, POST either searches or follows, and DELETE unfollows.
// Search uses POST so its user-controlled term stays in the JSON body instead
// of influencing fetch's destination URL. The explicit body discriminator
// separates it from follow without adding another deployed function.
//
// GET `?list=followers|following` reads the caller's own graph — see
// socialEndpoints.js for why that could not just live in
// api/v1/league/profile.js instead.
//
// THE FUNCTION BUDGET: this file is the 12th, and Vercel's Hobby plan caps a
// deployment at 12 Serverless Functions. That is why search, follow and the
// follow-list all share one file instead of splitting into
// api/v1/social/search.js, api/v1/social/follow.js and
// api/v1/social/list.js, and it is why the next endpoint added to this
// project cannot be a new file — it has to join an existing lane the way
// these did. The logic lives in api/_lib/socialEndpoints.js, which the
// underscore prefix excludes from deployment.
async function handler(req, res) {
  if (req.method === 'GET') return listHandler(req, res);
  if (req.method === 'POST') {
    return req.body?.operation === 'search' ? searchHandler(req, res) : followHandler(req, res);
  }
  if (req.method === 'DELETE') return unfollowHandler(req, res);
  return sendError(res, 'method_not_allowed', 'Method not allowed');
}

export default withCors(handler);
