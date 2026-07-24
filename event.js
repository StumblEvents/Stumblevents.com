export default {
  async fetch(request) {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("id");

    if (!eventId) {
      return new Response("Missing event ID", {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response(
      `Stumbl event route is working.\nEvent ID: ${eventId}`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  },
};
