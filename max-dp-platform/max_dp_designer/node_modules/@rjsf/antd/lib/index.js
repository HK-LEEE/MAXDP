import { withTheme } from '@rjsf/core';
import Templates, { generateTemplates } from './templates/index.js';
import Widgets, { generateWidgets } from './widgets/index.js';
export function generateTheme() {
    return {
        templates: generateTemplates(),
        widgets: generateWidgets(),
    };
}
const Theme = generateTheme();
export function generateForm() {
    return withTheme(generateTheme());
}
const Form = generateForm();
export { Form, Templates, Theme, Widgets, generateTemplates, generateWidgets };
export default Form;
//# sourceMappingURL=index.js.map