import { jsx as _jsx } from "react/jsx-runtime";
import { Button } from 'antd';
import { getSubmitButtonOptions } from '@rjsf/utils';
/** The `SubmitButton` renders a button that represent the `Submit` action on a form
 */
export default function SubmitButton({ uiSchema }) {
    const { submitText, norender, props: submitButtonProps } = getSubmitButtonOptions(uiSchema);
    if (norender) {
        return null;
    }
    return (_jsx(Button, { type: 'submit', ...submitButtonProps, htmlType: 'submit', children: submitText }));
}
//# sourceMappingURL=index.js.map