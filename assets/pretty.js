(function(){
  const el = id => document.getElementById(id);
  const jsonInput = el('json-input');
  const summary = el('validation-summary');

  function safeParseJson(text) {
    try { return { ok: true, value: JSON.parse(text) }; }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  }
  function setSummary(msg, cls){ summary.textContent = msg; summary.className = cls || ''; }
  function getSelectionOrAll(textarea){
    const { selectionStart, selectionEnd, value } = textarea;
    const hasSel = selectionStart !== selectionEnd;
    const text = hasSel ? value.substring(selectionStart, selectionEnd) : value;
    return { text, hasSel, selectionStart, selectionEnd };
  }
  function replaceSelection(textarea, replacement, start, end){
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + replacement + after;
    const nextPos = before.length + replacement.length;
    textarea.selectionStart = textarea.selectionEnd = nextPos;
    textarea.dispatchEvent(new Event('input'));
  }

  el('btn-pretty').addEventListener('click', () => {
    const src = getSelectionOrAll(jsonInput);
    const parsed = safeParseJson(src.text);
    if (!parsed.ok) { setSummary('Invalid JSON: ' + parsed.error, 'validation-error'); return; }
    const pretty = JSON.stringify(parsed.value, null, 2);
    if (src.hasSel) replaceSelection(jsonInput, pretty, src.selectionStart, src.selectionEnd);
    else jsonInput.value = pretty;
    setSummary('Formatted ✓', 'validation-ok');
  });

  el('btn-minify').addEventListener('click', () => {
    const src = getSelectionOrAll(jsonInput);
    const parsed = safeParseJson(src.text);
    if (!parsed.ok) { setSummary('Invalid JSON: ' + parsed.error, 'validation-error'); return; }
    const minified = JSON.stringify(parsed.value);
    if (src.hasSel) replaceSelection(jsonInput, minified, src.selectionStart, src.selectionEnd);
    else jsonInput.value = minified;
    setSummary('Minified ✓', 'validation-ok');
  });

  // Compact removed per request; Minify covers whitespace removal for valid JSON

  // Seed example
  if (!jsonInput.value.trim()) jsonInput.value = JSON.stringify({ hello: 'world', count: 1 }, null, 2);
})();
