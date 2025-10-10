(function(){
  const el = id => document.getElementById(id);
  const original = el('original');
  const decoded = el('decoded');
  const summary = el('validation-summary');

  function setSummary(msg, cls){ summary.textContent = msg; summary.className = cls || ''; }
  function cleanBase64(s) { return s.replace(/\s+/g, '').replace(/[^A-Za-z0-9+/=]/g, ''); }

  el('btn-base64').addEventListener('click', () => {
    try {
      const text = atob(cleanBase64(original.value));
      decoded.value = text;
      setSummary('Base64 decoded ✓', 'validation-ok');
    } catch (e) {
      setSummary('Base64 decode failed: ' + (e?.message || e), 'validation-error');
    }
  });

  el('btn-decompress').addEventListener('click', async () => {
    try {
      const cleaned = cleanBase64(original.value);
      const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
      let text;
      try {
        text = window.pako.ungzip(bytes, { to: 'string' });
      } catch (_) {
        try { text = window.pako.inflate(bytes, { to: 'string' }); }
        catch (e2) {
          const zip = await window.JSZip.loadAsync(bytes);
          const files = Object.values(zip.files || {});
          const first = files.find(f => !f.dir && /\.txt$|\.json$|\.log$|\.ndjson$/i.test(f.name)) || files.find(f => !f.dir);
          if (!first) throw e2;
          text = await first.async('string');
        }
      }
      decoded.value = text;
      setSummary('Decompressed ✓', 'validation-ok');
    } catch (e) {
      setSummary('Decompress failed: ' + (e?.message || e), 'validation-error');
    }
  });

  // Seed example
  if (!original.value.trim()) original.value = 'H4sIAAAAAAAAA6tWKkktLlGyUjA0MjE1MrUw0FVISSxJVSjPL8pJAQAAAP//AwCddMD3GQAAAA==';
})();
