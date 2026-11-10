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

  // DataTable
  table: {
    // a table that remembers its view (remember): forget the saved page, sort, search and filters
    resetView: "Reset",
    resetViewTitle: "Forget the saved page, sort, search and filters",
    empty: "No records found.",
    search: "Search...",
    columns: "Columns",
    addRow: "+ Add row",
    remove: "Remove",
    removeRow: "Remove row",
    // {count} = number of selected rows
    deleteSelected: "Delete selected ({count})",
    export: "Export CSV",
    total: "Total",
    // {from}, {to}, {total} = row numbers
    showing: "Showing {from}–{to} of {total}",
    rowsPerPage: "Rows per page",
    loading: "Loading…",
    selectAll: "Select all rows on this page",
    selectRow: "Select row",
    yes: "Yes",
    no: "No",
  },

  // Tree
  tree: {
    label: "Tree",
    search: "Search…",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    view: "View",
    views: { tree: "Tree", explorer: "Explorer", columns: "Columns" },
    layout: "Layout",
    layouts: { details: "Details", list: "List", icons: "Icons" },
    loading: "Loading…",
    loadMore: "Load more",
    retry: "Retry",
    loadFailed: "Could not load.",
    empty: "Nothing here yet.",
    emptyFolder: "This folder is empty.",
    noMatches: "No matches.",
    // {count} = number of items
    selectedCount: "{count} selected",
    checkedCount: "{count} checked",
    itemCount: "{count} items",
    root: "Root",
    up: "Up one level",
    refresh: "Refresh",
    path: "Path",
    page: "Page {page} of {pages}",
    name: "Name",
    size: "Size",
    modified: "Modified",
    kind: "Type",
    folder: "Folder",
    file: "File",
    fileOfType: "{ext} file",
    rename: "Rename",
    open: "Open",
  },

  // FileUploadField
  upload: {
    fileTitle: "File title",
    fileTitlePlaceholder: "Optional, e.g. Worksheet 1",
    fileTitleHint: "Optional, up to {max} characters: given to the next file you add.",
    dropHere: "Drag & drop files here",
    dropNow: "Drop to add",
    or: "or",
    browse: "Browse files",
    pasteHint: "You can also paste files here",
    files: "files",
    // {label} = the field's label
    dropAnywhere: "Drop files to add them to {label}",
    hintTypes: "{types}",
    hintSize: "up to {size} each",
    hintCount: "max {count} files",
    summary: "{count} file(s) · {size}",
    overall: "Overall upload progress",
    uploadAll: "Upload {count}",
    retryAll: "Retry failed",
    clearAll: "Clear all",
    remove: "Remove",
    dismiss: "Dismiss",
    cancel: "Cancel upload",
    retry: "Retry",
    // {name} = file name
    preview: "Preview {name}",
    ready: "Ready",
    waiting: "Waiting…",
    notUploaded: "Not uploaded yet",
    uploading: "Uploading… {percent}%",
    done: "Uploaded",
    removing: "Removing…",
    failed: "Upload failed",
    cancelled: "Upload cancelled",
    removeFailed: "Could not remove the file.",
    added: "{count} file(s) added.",
    rejected: "{count} file(s) not added.",
    removed: "{name} removed.",
    allDone: "All uploads finished.",
    badType: "This file type isn't allowed (allowed: {types}).",
    tooBig: "File is larger than {max}.",
    tooSmall: "File is smaller than {min}.",
    tooMany: "You can add up to {max} files.",
    onlyOne: "Only one file can be added.",
    totalTooBig: "All files together can't exceed {max}.",
    duplicate: "This file is already added.",
    required: "Please add a file.",
    tooFew: "Please add at least {min} files.",
    stillUploading: "Please wait until the uploads finish.",
    notUploadedYet: "Please upload the selected files first.",
    failedFiles: "Some files failed to upload: retry or remove them.",
  },

  // Chart
  chart: {
    empty: "No data to show.",
    showTable: "Show table",
    showChart: "Show chart",
    total: "Total",
    category: "Category",
  },

  // Calendar
  calendar: {
    toggleSidebar: "Show or hide the side panel",
    today: "Today",
    previous: "Previous",
    next: "Next",
    view: "View",
    views: { day: "Day", week: "Week", month: "Month", year: "Year", agenda: "Schedule" },
    // {count} = hidden events on that day
    more: "+{count} more",
    allDay: "All day",
    noTitle: "(No title)",
    noEvents: "Nothing planned in this period.",
    search: "Search events",
    create: "Create",
    myCalendars: "My calendars",
    newEvent: "New event",
    editEvent: "Edit event",
    title: "Title",
    titlePlaceholder: "Add title",
    start: "Start",
    end: "End",
    startTime: "Start time",
    endTime: "End time",
    calendar: "Calendar",
    location: "Location",
    description: "Description",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    deleteRecurring: "Delete repeating event",
    thisEvent: "This event",
    allEvents: "All events",
    seriesNote: "Repeating event: changes apply to every occurrence; its schedule stays the same.",
    repeat: { daily: "Repeats daily", weekly: "Repeats weekly", monthly: "Repeats monthly", yearly: "Repeats yearly" },
  },

  richtext: {
    // Toolbar buttons (titles / screen-reader labels)
    bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strike through", heading: "Heading",
    bulletList: "Bulleted list", numberList: "Numbered list", quote: "Quote", link: "Link", unlink: "Remove link",
    clear: "Clear formatting", undo: "Undo", redo: "Redo",
    source: "Source", formatted: "Formatted",
    sourceTitle: "Edit the HTML source", formattedTitle: "Back to the formatted text",
    // {label} = the field's label
    toolbar: "{label} formatting",
    sourceLabel: "{label} (HTML source)",
    linkPrompt: "Web address (https://…)",
    // {max} = maxLength, {count} = the characters now
    tooLong: "At most {max} characters ({count} now).",
    counter: "{count} / {max}",
  },

  common: {
    // Modal close button / dismissible Alert (screen-reader label)
    close: "Close",
    // Spinner (screen-reader text)
    loading: "Loading...",
  },

  layout: {
    // Shown in place of a schema node whose type isn't in the component registry
    componentNotFound: "Component \"{name}\" not found",
  },
};

export default messages;
