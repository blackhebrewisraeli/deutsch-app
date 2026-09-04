import { chatHandler, deckHandler, gradeHandler } from '../_lib/aiEndpoints.js';
import { sendError } from '../_lib/respond.js';

// One deployed function for the whole AI lane. Unlike account and progress,
// all three endpoints are POST, so req.method cannot discriminate between
// them — dispatch is on req.query.op instead, which vercel.json's rewrites
// inject so the public URLs (/api/v1/ai/chat, /deck, /grade) are unchanged.
//
// This split exists only because Vercel's Hobby plan caps a deployment at 12
// Serverless Functions; api/v1/ai/chat.js, deck.js and grade.js were merged
// into this one file (their logic now lives in api/_lib/aiEndpoints.js, which
// the underscore prefix excludes from deployment).
export default async function handler(req, res) {
  const op = req.query?.op;
  if (op === 'chat') return chatHandler(req, res);
  if (op === 'deck') return deckHandler(req, res);
  if (op === 'grade') return gradeHandler(req, res);
  return sendError(res, 'bad_request', 'Unknown AI operation.');
}
