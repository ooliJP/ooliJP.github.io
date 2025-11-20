(function(){
  const el = id => document.getElementById(id);
  const jsonInput = el('json-input');
  const summary = el('validation-summary');

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

  // Attempt to heuristically repair “almost JSON” into valid JSON
  function heuristicRepair(text){
    let t = text.trim();
    if (!t) return t;

    // If looks like object body without outer braces, wrap
    if (!/^\s*[{\[]/.test(t) && /:\s*/.test(t)) {
      t = '{' + t + '}';
    }

    // Balance braces/brackets if off by one (simple heuristic)
    const openCurly = (t.match(/{/g)||[]).length;
    const closeCurly = (t.match(/}/g)||[]).length;
    if (openCurly > closeCurly) t += '}'.repeat(openCurly - closeCurly);
    const openSquare = (t.match(/\[/g)||[]).length;
    const closeSquare = (t.match(/\]/g)||[]).length;
    if (openSquare > closeSquare) t += ']'.repeat(openSquare - closeSquare);

    // Replace single-quoted property names: 'key': -> "key":
    t = t.replace(/'([A-Za-z0-9_]+)'\s*:/g, '"$1":');
    // Replace single-quoted string values with double quotes
    t = t.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, function(_, inner){
      return ':"' + inner.replace(/"/g,'\\"') + '"';
    });
    // Generic single-quoted strings (array values etc.) not already handled
    t = t.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, function(_, inner){
      // Avoid converting already converted property names (followed by :)
      return '"' + inner.replace(/"/g,'\\"') + '"';
    });

    // Remove dangling commas before closing braces/brackets
    t = t.replace(/,\s*(\}|\])/g, '$1');

    return t;
  }

  function looseParse(text){
    // First attempt strict JSON
    try { return { ok:true, value: JSON.parse(text) }; } catch (_) {}
    // Heuristic repair
    const repaired = heuristicRepair(text);
    try { return { ok:true, value: JSON.parse(repaired), repaired:true }; } catch (e) {
      return { ok:false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  function formatAction(minify){
    const src = getSelectionOrAll(jsonInput);
    const parsed = looseParse(src.text);
    if (!parsed.ok) { setSummary('Cannot parse JSON: ' + parsed.error, 'validation-error'); return; }
    const result = minify ? JSON.stringify(parsed.value) : JSON.stringify(parsed.value, null, 2);
    if (src.hasSel) replaceSelection(jsonInput, result, src.selectionStart, src.selectionEnd);
    else jsonInput.value = result;
    const tag = minify ? 'Minified' : 'Formatted';
    setSummary(tag + (parsed.repaired ? ' (repaired) ✓' : ' ✓'), 'validation-ok');
  }

  el('btn-pretty').addEventListener('click', () => formatAction(false));
  el('btn-minify').addEventListener('click', () => formatAction(true));
  const fixBtn = el('btn-fix');
  if (fixBtn) fixBtn.addEventListener('click', () => {
    const src = getSelectionOrAll(jsonInput);
    const repairedText = heuristicRepair(src.text);
    const attempt = looseParse(repairedText);
    if (!attempt.ok) { setSummary('Fix failed: ' + attempt.error, 'validation-error'); return; }
    const pretty = JSON.stringify(attempt.value, null, 2);
    if (src.hasSel) replaceSelection(jsonInput, pretty, src.selectionStart, src.selectionEnd);
    else jsonInput.value = pretty;
    setSummary('Fixed & formatted ✓', 'validation-ok');
  });

  // Seed example
  if (!jsonInput.value.trim()) jsonInput.value = "{'hello':'world', count:1}";
})();
