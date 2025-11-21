(function(){
  const el = id => document.getElementById(id);
  const aEl = el('text-a');
  const bEl = el('text-b');
  const summary = el('compare-summary');
  const btnCompare = el('btn-compare');
  const btnSwap = el('btn-swap');
  const btnClear = el('btn-clear');

  function setSummary(msg, cls){ summary.textContent = msg; summary.className = cls || ''; }

  // Simple diff algorithm (line + token level) without external libs
  function diffLines(a, b){
    const aLines = a.split(/\r?\n/);
    const bLines = b.split(/\r?\n/);
    // LCS table
    const m = aLines.length, n = bLines.length;
    const dp = Array(m+1).fill(null).map(()=>Array(n+1).fill(0));
    for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ dp[i][j] = aLines[i-1]===bLines[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]); } }
    // Backtrack
    const ops = []; // {type, aLine?, bLine?}
    let i=m,j=n;
    while(i>0 && j>0){
      if(aLines[i-1]===bLines[j-1]){ ops.push({type:'equal', aLine:aLines[i-1], bLine:bLines[j-1]}); i--; j--; }
      else if(dp[i-1][j] >= dp[i][j-1]){ ops.push({type:'remove', aLine:aLines[i-1]}); i--; }
      else { ops.push({type:'add', bLine:bLines[j-1]}); j--; }
    }
    while(i>0){ ops.push({type:'remove', aLine:aLines[i-1]}); i--; }
    while(j>0){ ops.push({type:'add', bLine:bLines[j-1]}); j--; }
    ops.reverse();
    return ops;
  }

  function highlightTokens(lineA, lineB){
    if(lineA===undefined) return {a: '', b: escapeHtml(lineB), changed:true};
    if(lineB===undefined) return {a: escapeHtml(lineA), b: '', changed:true};
    if(lineA===lineB) return {a: escapeHtml(lineA), b: escapeHtml(lineB), changed:false};
    const aTokens = tokenize(lineA);
    const bTokens = tokenize(lineB);
    // token LCS
    const m=aTokens.length, n=bTokens.length;
    const dp=Array(m+1).fill(null).map(()=>Array(n+1).fill(0));
    for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ dp[i][j] = aTokens[i-1]===bTokens[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]); } }
    let i=m,j=n; const aOut=[], bOut=[];
    while(i>0 && j>0){
      if(aTokens[i-1]===bTokens[j-1]){ aOut.push(htmlSpan(aTokens[i-1])); bOut.push(htmlSpan(aTokens[i-1])); i--; j--; }
      else if(dp[i-1][j] >= dp[i][j-1]){ aOut.push(htmlSpan(aTokens[i-1],'diff-rem-token')); i--; }
      else { bOut.push(htmlSpan(bTokens[j-1],'diff-add-token')); j--; }
    }
    while(i>0){ aOut.push(htmlSpan(aTokens[i-1],'diff-rem-token')); i--; }
    while(j>0){ bOut.push(htmlSpan(bTokens[j-1],'diff-add-token')); j--; }
    aOut.reverse(); bOut.reverse();
    return {a:aOut.join(''), b:bOut.join(''), changed:true};
  }

  function tokenize(line){
    return line.match(/\w+|[^\w\s]/g) || []; // words and punctuation
  }
  function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function htmlSpan(t, cls){ return '<span'+(cls? ' class="'+cls+'"':'')+'>'+escapeHtml(t)+'</span>'; }

  function buildDiff(a,b){
    const ops = diffLines(a,b);
    const outA=[], outB=[]; let changed=false;
    ops.forEach(op=>{
      if(op.type==='equal'){
        const esc = escapeHtml(op.aLine);
        outA.push('<div class="diff-line">'+esc+'</div>');
        outB.push('<div class="diff-line">'+esc+'</div>');
      } else if(op.type==='remove'){
        const tk = highlightTokens(op.aLine,''); changed=true;
        outA.push('<div class="diff-line diff-rem">'+tk.a+'</div>');
        outB.push('<div class="diff-line diff-gap"></div>');
      } else if(op.type==='add'){
        const tk = highlightTokens('', op.bLine); changed=true;
        outA.push('<div class="diff-line diff-gap"></div>');
        outB.push('<div class="diff-line diff-add">'+tk.b+'</div>');
      }
    });
    return {htmlA: outA.join(''), htmlB: outB.join(''), changed};
  }

  function compare(){
    const a = aEl.value; const b = bEl.value;
    const {htmlA, htmlB, changed} = buildDiff(a,b);
    if(!changed){
      setSummary('Identical ✓','validation-ok');
      // subtle highlight to indicate sameness
      summary.classList.add('identical');
    } else {
      setSummary('Different ✕','validation-error');
    }
    // Replace textarea contents with original (keep editable) but show diff overlay
    renderOverlay(aEl, htmlA);
    renderOverlay(bEl, htmlB);
  }

  // Create overlay container for diff rendering
  function renderOverlay(textarea, html){
    let wrap = textarea.parentNode.querySelector('.diff-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className='diff-overlay';
      textarea.parentNode.style.position='relative';
      textarea.parentNode.appendChild(wrap);
    }
    wrap.innerHTML = html;
  }

  function clearDiff(){
    const overlays = document.querySelectorAll('.diff-overlay');
    overlays.forEach(o=>o.remove());
    setSummary('', '');
  }

  btnCompare.addEventListener('click', () => { clearDiff(); compare(); });
  btnSwap.addEventListener('click', () => { const tmp=aEl.value; aEl.value=bEl.value; bEl.value=tmp; clearDiff(); });
  btnClear.addEventListener('click', () => { aEl.value=''; bEl.value=''; clearDiff(); });

  // Seed examples
  if(!aEl.value.trim()) aEl.value = '{"id":1,"name":"Alice"}';
  if(!bEl.value.trim()) bEl.value = '{"id":1,"name":"Alice","role":"admin"}';
})();
