import { createStripeHandoffResponse } from "../handoff.js";

export default {
  async fetch(request) {
    return createStripeHandoffResponse("refresh", "development", request);
  },
};
