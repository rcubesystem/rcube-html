/**
 * rcube-html UI text — English (the default and final fallback).
 *
 * To add a language, copy this file (lang_es.js, lang_ta.js, ...), translate the values and keep:
 *   - the keys exactly as they are
 *   - the {placeholders}, which are filled in at runtime ({min}, {max}, {values}, ...)
 * Keys left out of a translation fall back to this English text.
 *
 * Projects usually spread these into their own page text so one message set covers both:
 *   import libEn from 'rcube-html/lang/lang_en';
 *   export default { ...libEn, form: { firstName: { label: "First Name" } } };
 *
 * Per-field text set in the schema (requiredMessage, patternMessage, rangeMessage, ...) always
 * takes priority over these defaults.
 */
const messages = {
  select: {
    placeholder: "Select an option...",
    // Dependent select (optionsFrom) before its parent field has a value
    waitingForParent: "Select an option above first",
    // Dependent select when the parent value has no options; {value} = the parent value
    noOptions: "No options available",
  },

  validation: {
    required: "This field is required.",
    requiredCheckbox: "Please check this box to continue.",
    requiredCheckboxGroup: "Please select at least one option.",
    requiredChoice: "Please select an option.",
    // {missing} = comma-separated option values that must be checked
    requiredOptions: "Please select: {missing}.",
    pattern: "Please enter a valid value.",
    number: "Please enter a valid number.",
    numberRange: "Please enter a number between {min} and {max}.",
    numberMin: "Please enter a number of at least {min}.",
    numberMax: "Please enter a number no greater than {max}.",
    // {values} = comma-separated allowed values
    allowedValues: "Please enter one of: {values}.",
    date: "Please enter a valid date.",
    dateBeforeToday: "Date must be before today.",
    // {years} = the schema's maxYearsAgo
    dateMaxYearsAgo: "Date cannot be more than {years} years ago.",
  },

  // Repeatable forms (useDynamicTag({ repeatable: true }))
  repeat: {
    // Heading over each entry; {n} = entry number
    entry: "Entry {n}",
    remove: "Remove",
    addAnother: "+ Add Another",
  },

  layout: {
    // Shown in place of a schema node whose type isn't in the component registry
    componentNotFound: "Component \"{name}\" not found",
  },
};

export default messages;
