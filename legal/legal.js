(function () {
  const route = location.pathname.replace(/^\/+|\/+$/g, '');
  const source = window.STUMBL_LEGAL_DOCUMENTS && window.STUMBL_LEGAL_DOCUMENTS[route];
  const target = document.getElementById('legalDocument');
  if (!source) { location.replace('/support/'); return; }

  const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const contact = window.STUMBL_BUSINESS_CONTACT || {};
  const inline = value => escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(?<!["'>])(\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/gi, '<a href="mailto:$1">$1</a>');
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let list = null;
  const closeList = () => { if (list) { output.push(`</${list}>`); list = null; } };
  lines.forEach(line => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    if (heading) { closeList(); const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); }
    else if (ordered || unordered) { const type = ordered ? 'ol' : 'ul'; if (list !== type) { closeList(); output.push(`<${type}>`); list = type; } output.push(`<li>${inline((ordered || unordered)[1])}</li>`); }
    else if (!line.trim()) { closeList(); }
    else { closeList(); output.push(`<p>${inline(line).replace(/ {2}$/,'<br>')}</p>`); }
  });
  closeList();
  target.innerHTML = output.join('\n');
  const title = target.querySelector('h1');
  if (title) document.title = `${title.textContent} | Stumbl Events`;
}());
