// rcube-html/element/core: the <rcube-form> element (React inside) with forms, fields, layout, containers, display
// components, actions and languages. The bigger components come with rcube-html/element/table, /chart, /calendar,
// /tree, /richtext and /upload; rcube-html/element has them all. See ../element.js.
import { defineRcubeForm } from "../element";

export * from "../core";
export { RcubeFormElement, defineRcubeForm, mount, actionNamesIn, FORM_OPTIONS } from "../element";
// the React inside the element: for components registered with registerComponent (React.createElement, hooks)
export { default as React } from "react";

defineRcubeForm();
