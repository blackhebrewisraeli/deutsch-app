import { createAiHandler } from '../../_lib/handler.js';

// Custom deck generation.
export default createAiHandler({ rate: { windowMs: 60 * 60 * 1000, max: 5 } });
