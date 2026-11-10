const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

if (!$('#assistant-toggle')) document.body.insertAdjacentHTML('beforeend', '<button class="chatfab" id="assistant-toggle">Ask Pranrakshak</button><aside class="chatbox" id="assistant-panel" hidden><b>Pranrakshak</b><p class="m b">I can help with public resource information. Confidential information is protected. For emergencies call 108 or 112.</p><div class="chat"><div class="m b" id="assistant-answer"></div></div><div style="display:flex;gap:.5rem"><input class="in" id="assistant-input" placeholder="Ask about resources"><button class="pill so" id="assistant-send">Send</button></div></aside>');
if (!$('#bug-toggle')) document.body.insertAdjacentHTML('beforeend', '<button class="fab" id="bug-toggle">Report a Bug</button><aside class="chatbox" id="bug-panel" hidden style="left:auto;right:1rem"><form class="fm" id="bug-form"><label for="bug-description">Describe the issue</label><textarea class="in" id="bug-description" name="description" maxlength="2000" required></textarea><label for="bug-email">Contact email (optional)</label><input class="in" id="bug-email" name="contactEmail" type="email"><label for="bug-screenshot">Screenshot (PNG/JPG, max 2 MB)</label><input class="in" id="bug-screenshot" name="screenshot" type="file" accept="image/png,image/jpeg"><button class="pill so">Submit report</button><p id="bug-message" role="status"></p></form></aside>');

$('#resource-search')?.addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  $$('.resource-row').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); });
});
$$('[data-chip]').forEach(button => button.addEventListener('click', () => {
  const search = $('#resource-search'); search.value = button.dataset.chip; search.dispatchEvent(new Event('input'));
}));
$('#use-location')?.addEventListener('click', () => {
  const message = $('#location-message');
  if (!navigator.geolocation) { message.textContent = 'Location is unavailable. Enter a city or postal code.'; return; }
  message.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(
    position => { $('#place').value = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`; message.textContent = 'Location set. Nearby demo results are shown.'; },
    () => { message.textContent = 'Location permission is unavailable. Enter a city or postal code.'; }
  );
});

$('#assistant-toggle')?.addEventListener('click', () => {
  const panel = $('#assistant-panel');
  panel.hidden = false;
  panel.classList.toggle('open');
});
$('#assistant-send')?.addEventListener('click', () => {
  const input = $('#assistant-input'), answer = $('#assistant-answer'), q = input.value.trim();
  if (!q) return;
  answer.textContent = /employee|joining code|organization code|password|confidential|private/i.test(q)
    ? 'I can’t share confidential information. I can help find public resources. For emergencies call 108 or 112.'
    : 'I can help find public supply availability. Open Need Center to search nearby resources. For emergencies call 108 or 112.';
  input.value = '';
});

$$('form[data-demo-form]').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault();
  const output = $('[data-form-message]', form);
  if (output) output.textContent = form.dataset.demoForm === 'employee'
    ? 'Request recorded for this demo. Your organization admin must approve the account.'
    : 'Saved for this demo. Connect the organization API to make this change live.';
}));

$('#bug-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, output = $('#bug-message');
  const description = $('#bug-description').value.trim();
  const file = $('#bug-screenshot').files[0];
  if (!description || description.length > 2000) { output.textContent = 'Enter a description up to 2,000 characters.'; return; }
  if (file && (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type))) { output.textContent = 'Screenshot must be PNG or JPG and under 2 MB.'; return; }
  const body = new FormData(form);
  body.append('pageUrl', location.href); body.append('userAgent', navigator.userAgent);
  output.textContent = 'Sending report…';
  try {
    const response = await fetch('/api/public/bug-report', { method: 'POST', body });
    if (!response.ok) throw new Error();
    output.textContent = 'Thanks, we got your report.'; form.reset();
  } catch { output.textContent = 'Report service is unavailable right now.'; }
});

$('#bug-toggle')?.addEventListener('click', () => {
  const panel = $('#bug-panel');
  panel.hidden = false;
  panel.classList.toggle('open');
});
