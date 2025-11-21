;(function(){
  const el = id => document.getElementById(id);
  const aEl = el('text-a');
  const bEl = el('text-b');
  const summary = el('compare-summary');
  const btnCompare = el('btn-compare');
  const btnSwap = el('btn-swap');
  const btnClear = el('btn-clear');

  function setSummary(msg, cls){ summary.textContent = msg; summary.className = cls || ''; }

  // Line diff via LCS, then merge adjacent remove/add into change for intra-line token diff
  function diffLines(a, b){
    const aLines = a.split(/\r?\n/);
    const bLines = b.split(/\r?\n/);
    const m=aLines.length, n=bLines.length;
    const dp=Array(m+1).fill(null).map(()=>Array(n+1).fill(0));
    for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ dp[i][j] = aLines[i-1]===bLines[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]); } }
    const ops=[]; let i=m,j=n;
    while(i>0 && j>0){
      if(aLines[i-1]===bLines[j-1]){ ops.push({type:'equal', aLine:aLines[i-1], bLine:bLines[j-1]}); i--; j--; }
      else if(dp[i-1][j] >= dp[i][j-1]){ ops.push({type:'remove', aLine:aLines[i-1]}); i--; }
      else { ops.push({type:'add', bLine:bLines[j-1]}); j--; }
    }
    while(i>0){ ops.push({type:'remove', aLine:aLines[i-1]}); i--; }
    while(j>0){ ops.push({type:'add', bLine:bLines[j-1]}); j--; }
    ops.reverse();
    // Merge remove+add sequences into change pairs
    const merged=[];
    for(let k=0;k<ops.length;k++){
      const cur=ops[k];
      if(cur.type==='remove' && ops[k+1] && ops[k+1].type==='add'){
        merged.push({type:'change', aLine:cur.aLine, bLine:ops[k+1].bLine});
        k++; // skip next
      } else merged.push(cur);
    }
    return merged;
  }

  // Tokenization aimed at JSON/text: capture strings, numbers, booleans, null, punctuation, whitespace separately.
  function tokenize(line){
    return (line.match(/"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\]:,]|\s+|[^\s]/g)) || [];
  }
  function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function span(t, cls){ return '<span'+(cls?' class="'+cls+'"':'')+'>'+escapeHtml(t)+'</span>'; }

  function diffTokens(aLine, bLine){
    const aTokens = tokenize(aLine);
    const bTokens = tokenize(bLine);
    // Ignore pure whitespace when building matching (still output later): map significant tokens only
    const sigA = aTokens.map((t,i)=>({t,i})).filter(o=>!/^\s+$/.test(o.t));
    const sigB = bTokens.map((t,i)=>({t,i})).filter(o=>!/^\s+$/.test(o.t));
    const m=sigA.length, n=sigB.length;
    const dp=Array(m+1).fill(null).map(()=>Array(n+1).fill(0));
    for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ dp[i][j] = sigA[i-1].t===sigB[j-1].t ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]); } }
    // Backtrack matched significant token indices
    let i=m,j=n; const matchesA=new Set(), matchesB=new Set();
    while(i>0 && j>0){
      if(sigA[i-1].t===sigB[j-1].t){ matchesA.add(sigA[i-1].i); matchesB.add(sigB[j-1].i); i--; j--; }
      else if(dp[i-1][j] >= dp[i][j-1]) i--; else j--;
    }
    // Build HTML preserving original token order including whitespace
    const aOut=aTokens.map((tok,i)=>{
      if(/^\s+$/.test(tok)) return escapeHtml(tok); // keep whitespace
      return matchesA.has(i)? span(tok) : span(tok,'diff-rem-token');
    }).join('');
    const bOut=bTokens.map((tok,i)=>{
      if(/^\s+$/.test(tok)) return escapeHtml(tok);
      return matchesB.has(i)? span(tok) : span(tok,'diff-add-token');
    }).join('');
    const changed = aOut!==bOut; // simplistic flag
    return {aOut,bOut,changed};
  }

  function buildDiff(a,b){
    const ops = diffLines(a,b);
    const outA=[], outB=[]; let changed=false;
    ops.forEach(op=>{
      if(op.type==='equal'){
        const esc = escapeHtml(op.aLine);
        outA.push('<div class="diff-line">'+esc+'</div>');
        outB.push('<div class="diff-line">'+esc+'</div>');
      } else if(op.type==='change'){
        const tk = diffTokens(op.aLine, op.bLine); changed=true;
        outA.push('<div class="diff-line diff-changed">'+tk.aOut+'</div>');
        outB.push('<div class="diff-line diff-changed">'+tk.bOut+'</div>');
      } else if(op.type==='remove'){
        changed=true;
        const tk = diffTokens(op.aLine,'');
        outA.push('<div class="diff-line diff-rem">'+tk.aOut+'</div>');
        outB.push('<div class="diff-line diff-gap"></div>');
      } else if(op.type==='add'){
        changed=true;
        const tk = diffTokens('', op.bLine);
        outA.push('<div class="diff-line diff-gap"></div>');
        outB.push('<div class="diff-line diff-add">'+tk.bOut+'</div>');
      }
    });
    return {htmlA: outA.join(''), htmlB: outB.join(''), changed};
  }

  function compare(){
    const a = aEl.value, b = bEl.value;
    const {htmlA, htmlB, changed} = buildDiff(a,b);
    clearDiff();
    if(!changed){
      setSummary('Identical ✓','validation-ok bright-identical');
    } else {
      setSummary('Different ✕','validation-error');
    }
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

  btnCompare.addEventListener('click', compare);
  btnSwap.addEventListener('click', () => { const tmp=aEl.value; aEl.value=bEl.value; bEl.value=tmp; clearDiff(); });
  btnClear.addEventListener('click', () => { aEl.value=''; bEl.value=''; clearDiff(); });

  // Seed examples
  if(!aEl.value.trim()) aEl.value = '{"id":1,"name":"Alice"}';
  if(!bEl.value.trim()) bEl.value = '{"id":1,"name":"Alice","role":"admin"}';
})();
