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

	function validateNow() {
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
				const { AjvClass, addFormats } = getAjv();
				if (!AjvClass) {
					throw new Error('Ajv not found on window. Ensure CDN loaded and not blocked.');
				}
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
