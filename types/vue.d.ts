// Types for rcube-html/vue
import type { DefineComponent } from "vue";
import type { Actions, ActionDetail, ChangeDetail, ErrorDetail, FormApi, ReadyDetail, Schema, SubmitDetail, Values } from "./element";

export * from "./element";

export interface RcubeFormProps {
  schema?: Schema;
  buttons?: Schema;
  actions?: Actions;
  messages?: Record<string, any>;
  languages?: Record<string, any>;
  language?: string;
  data?: Values;
  repeatable?: boolean;
  /** v-model: the first form copy's values (every copy's when repeatable) */
  modelValue?: Values | Values[];
}

/** <RcubeForm>: the <rcube-form> element as a Vue component (ref: { api, element }) */
export declare const RcubeForm: DefineComponent<
  RcubeFormProps,
  { api: FormApi | undefined },
  {},
  {},
  {},
  {},
  {},
  {
    "update:modelValue": (value: Values | Values[]) => void;
    change: (detail: ChangeDetail) => void;
    submit: (detail: SubmitDetail) => void;
    action: (detail: ActionDetail) => void;
    ready: (detail: ReadyDetail) => void;
    error: (detail: ErrorDetail) => void;
  }
>;
export default RcubeForm;
