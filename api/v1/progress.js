import { eventsHandler, dailyHandler } from '../_lib/progressHandlers.js';
import { sendError } from '../_lib/respond.js';

// One deployed function for the whole progress lane, dispatching on
// req.method — POST records an event, GET reads a day back. The two lanes
// have distinct methods, which is what makes a plain method switch safe here:
// no action parameter is needed.
//
// This split exists only because Vercel's Hobby plan caps a deployment at 12
// Serverless Functions; api/v1/progress/events.js and api/v1/progress/daily.js
// were merged into this one file (their logic now lives in
// api/_lib/progressHandlers.js, which the underscore prefix excludes from
// deployment). The public URLs /api/v1/progress/events and
// /api/v1/progress/daily are preserved by rewrites in vercel.json.
export default async function handler(req, res) {
  if (req.method === 'POST') return eventsHandler(req, res);
  if (req.method === 'GET') return dailyHandler(req, res);
  return sendError(res, 'method_not_allowed', 'Method not allowed');
}
