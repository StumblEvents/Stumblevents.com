(() => {
  const button = document.getElementById('share-event');
  const input = document.getElementById('event-link');
  const note = document.getElementById('share-note');
  if (!button || !input || !note) return;
  button.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: input.value });
        note.textContent = 'Event shared.';
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(input.value);
        note.textContent = 'Event link copied.';
      } else { input.focus(); input.select(); note.textContent = 'Copy the selected event link.'; }
    } catch (error) {
      if (error.name === 'AbortError') return;
      input.focus(); input.select(); note.textContent = 'Copy the selected event link.';
    }
  });
})();
