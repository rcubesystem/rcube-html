// rcube-html/vue: <RcubeForm> for Vue 3 — the <rcube-form> element as a Vue component, with v-model.
//
//   <script setup>
//   import { RcubeForm } from "rcube-html/vue";
//   import "rcube-html/element/table";            // only if the schema has a DataTable (or "rcube-html/element": all)
//   const values = ref({ email: "" });
//   </script>
//   <template>
//     <RcubeForm :schema="schema" :actions="actions" v-model="values" @submit="save" @action="onAction" ref="form" />
//   </template>
//
// Props: schema, buttons, actions, messages, languages, language, data, repeatable, modelValue (v-model)
// Events: update:modelValue (the first form copy's values; every copy when repeatable), change, submit, action,
//   ready, error — each with the element event's detail ({ entries, values }, { name, event, context, api }, …)
// form.value.api: every form action (setFormData, getFormEntries, setNodeProps, runValidation, …)
// A schema is read when a new one is given: replace it (schema.value = [...]) rather than changing it in place,
// or change it with api.setNodeProps / hideNode / showNode.
import { defineComponent, h, ref, toRaw } from "vue";
import "./core";

const raw = (value) => (value && typeof value === "object" ? toRaw(value) : value);

export const RcubeForm = defineComponent({
  name: "RcubeForm",
  props: {
    schema: { type: Array, default: undefined },
    buttons: { type: Array, default: undefined },
    actions: { type: [Object, Function], default: undefined },
    messages: { type: Object, default: undefined },
    languages: { type: Object, default: undefined },
    language: { type: String, default: undefined },
    data: { type: Object, default: undefined },
    repeatable: { type: Boolean, default: false },
    modelValue: { type: [Object, Array], default: undefined },
  },
  emits: ["update:modelValue", "change", "submit", "action", "ready", "error"],
  setup(props, { emit, expose }) {
    const element = ref(null);
    // what the form itself sent with update:modelValue: coming back as modelValue, it isn't written into the form again
    let sent;
    let given;
    expose({
      element,
      get api() {
        return element.value?.api;
      },
    });
    return () => {
      if (props.modelValue !== sent) given = raw(props.modelValue);
      return h("rcube-form", {
        ref: element,
        schema: raw(props.schema),
        buttons: raw(props.buttons),
        actions: raw(props.actions),
        messages: raw(props.messages),
        languages: raw(props.languages),
        language: props.language,
        data: raw(props.data),
        repeatable: props.repeatable,
        values: Array.isArray(given) ? given[0] : given,
        onRcubeChange: (e) => {
          sent = props.repeatable ? e.detail.entries : e.detail.entries?.[0];
          emit("update:modelValue", sent);
          emit("change", e.detail);
        },
        onRcubeSubmit: (e) => emit("submit", e.detail),
        onRcubeAction: (e) => emit("action", e.detail),
        onRcubeReady: (e) => emit("ready", e.detail),
        onRcubeError: (e) => emit("error", e.detail),
      });
    };
  },
});

export default RcubeForm;
