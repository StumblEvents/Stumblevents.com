const eventPage = require('./_event-page');
const invitePage = require('./invite');

// Keep existing website routes and direct API/query aliases compatible.
module.exports = function event(req, res) {
  const query = req.query || {};
  const id = query.id || query.event || '';
  const token = query.invite || query.token || query.invite_token || '';
  if (!id && token) {
    req.query = { ...query, token };
    return invitePage(req, res);
  }
  req.query = { ...query, type: 'event', id, invite: token };
  return eventPage(req, res);
};
