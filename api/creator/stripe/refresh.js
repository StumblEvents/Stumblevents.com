import { createStripeHandoffResponse } from "./handoff.js";

export default {
  async fetch() {
    return createStripeHandoffResponse("refresh");
  },
};
