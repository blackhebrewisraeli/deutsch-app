import { createAiHandler } from '../../_lib/handler.js';

// Anna conversation turns.
export default createAiHandler({ rate: { windowMs: 5 * 60 * 1000, max: 20 } });
