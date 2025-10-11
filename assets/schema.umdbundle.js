// Schema validation page logic (UMD-friendly, no bundler required)
(function () {
	// Helper to get element by id
	function el(id) { return document.getElementById(id); }

	// Elements
	const jsonInput = el('json-input');
	const schemaInput = el('schema-input');
	const output = el('output');
		const summary = el('validation-summary');
		const btnValidate = el('btn-validate');
		const btnLoadSamples = el('btn-load-samples');

			if (!jsonInput || !schemaInput || !output || !summary) {
				console.warn('[Schema] Required elements not found.');
				return;
			}

		// Resolver functions for Ajv and formats (evaluate at call time)
		function getAjv() {
			// Check multiple possible globals
			const AjvGlobal = (window.ajv && (window.ajv.default || window.ajv.Ajv || window.ajv)) || window.Ajv || window.ajv8 || window.ajv7;
			const addFormatsGlobal = (window.ajvFormats && (window.ajvFormats.default || window.ajvFormats)) || window.ajv_formats || window.ajvFormats2 || null;
			return { AjvClass: AjvGlobal, addFormats: addFormatsGlobal };
		}

			// Dynamically ensure Ajv and formats are loaded (fallback to alternate CDNs if blocked)
			async function ensureAjvLoaded() {
				const { AjvClass, addFormats } = getAjv();
				if (AjvClass && addFormats) return { AjvClass, addFormats };

				// Helper to inject a script and wait
				function loadScript(src) {
					return new Promise((resolve, reject) => {
						const s = document.createElement('script');
						s.src = src;
						s.async = true;
						s.onload = () => resolve();
						s.onerror = () => reject(new Error('Failed to load ' + src));
						document.head.appendChild(s);
					});
				}

				const ajvCandidates = [
					// Prefer local vendored copies if present
					'assets/vendor/ajv.min.js',
					'https://cdn.jsdelivr.net/npm/ajv@8.17.1/dist/ajv.min.js',
					'https://unpkg.com/ajv@8.17.1/dist/ajv.min.js',
					'https://cdnjs.cloudflare.com/ajax/libs/ajv/8.17.1/ajv.min.js'
				];
				const formatsCandidates = [
					'assets/vendor/ajv-formats.min.js',
					'https://cdn.jsdelivr.net/npm/ajv-formats@2.1.1/dist/ajv-formats.min.js',
					'https://unpkg.com/ajv-formats@2.1.1/dist/ajv-formats.min.js',
					'https://cdnjs.cloudflare.com/ajax/libs/ajv-formats/2.1.1/ajv-formats.min.js'
				];

				// Try loading Ajv and formats if missing
				let loadedAjv = !!AjvClass;
				let loadedFormats = !!addFormats;
				if (!loadedAjv) {
					for (const url of ajvCandidates) {
						try { await loadScript(url); loadedAjv = true; break; } catch (_) { /* try next */ }
					}
				}
				let AjvAfter = getAjv().AjvClass;
				if (!AjvAfter) {
					// Try dynamic ESM imports (works even without globals)
					async function tryImport(urls, pick) {
						for (const u of urls) {
							try {
								const m = await import(/* @vite-ignore */ u);
								const v = pick(m);
								if (v) return v;
							} catch (_) { /* try next */ }
						}
						return null;
					}

					const ajvEsmCandidates = [
						'https://esm.sh/ajv@8?bundle',
						'https://cdn.skypack.dev/ajv@8',
						'https://esm.run/ajv@8'
					];
					AjvAfter = await tryImport(ajvEsmCandidates, m => m.default || m.Ajv || m);
				}
				if (!AjvAfter) throw new Error('Ajv not available. If running offline or behind a blocker, ensure a local ESM/UMD build is available or allow CDN.');

				if (!loadedFormats) {
					for (const url of formatsCandidates) {
						try { await loadScript(url); loadedFormats = true; break; } catch (_) { /* try next */ }
					}
				}
				let formatsAfter = getAjv().addFormats;
				if (!formatsAfter) {
					// Try dynamic import for ajv-formats as ESM
					const formatsEsmCandidates = [
						'https://esm.sh/ajv-formats@2?bundle',
						'https://cdn.skypack.dev/ajv-formats@2',
						'https://esm.run/ajv-formats@2'
					];
					try {
						const mod = await (async () => {
							for (const u of formatsEsmCandidates) {
								try { return await import(u); } catch (_) { /* try next */ }
							}
							return null;
						})();
						if (mod) formatsAfter = mod.default || mod.addFormats || mod;
					} catch (_) { /* ignore */ }
				}
				if (!formatsAfter) {
					// Formats are optional; proceed without, but inform the user
					console.warn('[Schema] ajv-formats not available; format validations may be skipped.');
				}
				return { AjvClass: AjvAfter, addFormats: formatsAfter };
			}

		function setSummary(text, ok) {
			summary.textContent = text;
			summary.classList.remove('validation-ok', 'validation-error');
			summary.classList.add(ok ? 'validation-ok' : 'validation-error');
		}

	function safeParse(label, text) {
		if (!text || !text.trim()) {
			throw new Error(label + ' is empty');
		}
		try {
			return JSON.parse(text);
		} catch (e) {
			const msg = (e && e.message) ? e.message : String(e);
			throw new Error(label + ' parse error: ' + msg);
		}
	}

	function formatAjvErrors(errors) {
		if (!errors || !errors.length) return 'No errors';
		return errors.map((e, i) => {
			const path = e.instancePath || e.dataPath || '';
			const keyword = e.keyword ? ` [${e.keyword}]` : '';
			let detail = e.message || 'validation error';
			try {
				if (e.params) {
					const params = JSON.stringify(e.params);
					detail += ` | params: ${params}`;
				}
			} catch (_) { /* ignore */ }
			return `${i + 1}. ${path || '/'}${keyword}: ${detail}`;
		}).join('\n');
	}

		async function validateNow() {
		output.value = '';
			summary.classList.remove('validation-ok', 'validation-error');
			setSummary('Validating…', true);

		let data, schema;
		try {
			data = safeParse('JSON', jsonInput.value);
			schema = safeParse('Schema', schemaInput.value);
		} catch (err) {
			setSummary('Invalid input', false);
			output.value = String(err.message || err);
			return;
		}

				// Build Ajv instance
				let ajv;
		try {
					const { AjvClass, addFormats } = await ensureAjvLoaded();
				ajv = new AjvClass({
				allErrors: true,
				strict: false, // friendlier for a general-purpose tool
				allowUnionTypes: true,
				$data: true,
				messages: true,
			});
				if (addFormats) addFormats(ajv);
		} catch (err) {
			setSummary('Failed to initialize validator', false);
			output.value = String(err.message || err);
			return;
		}

		try {
			const validate = ajv.compile(schema);
			const valid = validate(data);
			if (valid) {
						setSummary('Valid ✓', true);
						output.value = 'No validation errors.';
			} else {
				const errs = validate.errors || [];
				setSummary(`Invalid • ${errs.length} error(s)`, false);
				output.value = formatAjvErrors(errs);
			}
		} catch (err) {
			// Compilation errors (invalid schema)
			setSummary('Schema compilation error', false);
			output.value = String(err.message || err);
		}
	}

	// Wire up events
		if (btnValidate) btnValidate.addEventListener('click', validateNow);

		// Load sample JSON and schema
		async function loadSamples() {
			setSummary('Loading samples…', true);
			try {
				const [jsonResp, schemaResp] = await Promise.all([
					fetch('samples.json'),
					fetch('schema-sample.json')
				]);
				if (!jsonResp.ok) throw new Error('Failed to fetch samples.json');
				if (!schemaResp.ok) throw new Error('Failed to fetch schema-sample.json');
				const [jsonText, schemaText] = await Promise.all([
					jsonResp.text(),
					schemaResp.text(),
				]);
				jsonInput.value = jsonText.trim();
				schemaInput.value = schemaText.trim();
				setSummary('Samples loaded. Click Validate.', true);
			} catch (err) {
				setSummary('Failed to load samples', false);
				output.value = String(err.message || err);
			}
		}
			if (btnLoadSamples) btnLoadSamples.addEventListener('click', loadSamples);

	// Optional: Ctrl/Cmd+Enter triggers validation from either input
	function maybeShortcut(e) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			validateNow();
		}
	}
	jsonInput.addEventListener('keydown', maybeShortcut);
	schemaInput.addEventListener('keydown', maybeShortcut);
})();
