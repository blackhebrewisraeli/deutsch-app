import { createAiHandler } from '../../_lib/handler.js';

// Exercise lane: answer/translation grading and exercise-sentence generation.
export default createAiHandler({ rate: { windowMs: 5 * 60 * 1000, max: 60 } });
