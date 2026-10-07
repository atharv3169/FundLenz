# Gemini connection setup

Store an AI Studio key in the repository Actions secret `GEMINI_API_KEY`. Never place it in public application files or build variables.

The **Gemini connection test** workflow makes one small generation request with `gemini-3.1-flash-lite`, validates a fixed JSON response, and reports only sanitized status and token usage. It runs when its own workflow/script changes on main, or via Actions > Gemini connection test > Run workflow. It does not run on catalogue changes and has no daily schedule. There are no automatic retries, search grounding, paid-model fallbacks, catalogue modifications or repository-write permissions.

The model has a listed API free tier as checked on 7 October 2026. Actual availability and quota depend on the project; enabling billing can change how requests are charged. The workflow does not change billing settings. A passing test establishes credential/model connectivity only, not financial accuracy or sufficient quota for the future pipeline.

Next implementation stages are approved-source acquisition, independent candidate checks, reconciliation, a separate validated publisher and deployment verification. Those components and automatic publication remain inactive. Keep the custom domain on the existing host until integration testing is complete.

References:
- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
- https://ai.google.dev/gemini-api/docs/pricing
