# PromptStow Manual Integration Checklist

Load the project root as an unpacked extension in Chrome before running these checks.

## Sites

- chatgpt.com
- chat.openai.com
- claude.ai
- gemini.google.com
- aistudio.google.com
- grok.com
- chat.deepseek.com

## Checks Per Site

- Existing popup Insert places the selected prompt in the active chat input.
- Template prompt with `{{topic}}` opens the fill modal before insert/copy.
- Slash trigger opens after typing `/` at the start of text or after whitespace.
- Arrow keys move the slash dropdown selection; Enter expands without sending the chat.
- Escape closes the dropdown and the site's normal typing behavior resumes.
- Existing copy, import, export, search, tag filter, and folder filter still work.
