/* Loading-screen helper. A classic script, not a module on purpose: browsers refuse to load ES modules when index.html is opened
   straight from disk (file://), and this script is what explains that instead of leaving the loading bar spinning forever.
   It runs before js/app.js; app.js removes the loading screen once the data is ready. */
(function () {
  var loading = document.getElementById('loading'), msg = document.getElementById('loadmsg');

  // Opened from a folder (file://): the app's modules and data cannot load, so say so.
  function explainFile() {
    if (!msg || !loading || loading.classList.contains('done')) return;
    loading.classList.add('explain');           // CSS hides the bar and loosens the line height (css/app.css)
    msg.innerHTML = 'lexiko can’t run when index.html is opened directly from a folder — browsers block that for security.<br><br>' +
      'Use it at <a href="https://lexiko.org/">lexiko.org</a> (add it to your home screen or install it and it works offline), ' +
      'or serve this folder locally, e.g. run <b>python3 -m http.server</b> in it and open <b>http://localhost:8000</b>.';
  }

  // Still on the loading screen after 20 seconds: say so instead of spinning silently.
  function explainSlow() {
    if (msg) msg.innerHTML = 'This is taking longer than expected. Check your connection and reload; if it keeps happening, reload with the page’s cache cleared.';
  }

  if (location.protocol === 'file:') explainFile();
  else setTimeout(function () { if (document.getElementById('loading')) explainSlow(); }, 20000);
})();
