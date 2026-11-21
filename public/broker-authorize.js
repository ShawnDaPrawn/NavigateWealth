const parameters = new URLSearchParams(window.location.search);
if (parameters.has('client_id') && window.location.search.length < 8192) {
  sessionStorage.setItem(
    'nw-broker-consent',
    JSON.stringify({ expires: Date.now() + 600000, params: Object.fromEntries(parameters) }),
  );
  window.location.replace('/admin');
} else {
  document.querySelector('p').textContent = 'Start this connection from your MCP client.';
}
