// rcube-html for Angular (14+): <rcube-html-form>, the <rcube-form> element as an Angular component — inputs,
// outputs and Angular forms (formControl / ngModel).
//
// Setup: npm install rcube-html, then copy this file into your app (e.g. src/app/shared/rcube-form.component.ts).
// Angular compiles components from your own source, so the file lives in the app rather than in node_modules.
//
//   @Component({ standalone: true, imports: [RcubeFormComponent, ReactiveFormsModule], template: `
//     <rcube-html-form [schema]="schema" [actions]="actions" [formControl]="signup"
//       (submitted)="save($event.values)" (action)="onAction($event)"></rcube-html-form>` })
//   ([(values)]="model" works too, instead of formControl / ngModel)
//   export class SignupComponent {
//     schema = signupSchema;                       // the same JSON a React, Vue or JSP page uses
//     signup = new FormControl({ email: '' });     // the form's values (the first form copy's; all when repeatable)
//     actions = { checkEmail: () => { … } };       // actions the schema names; or handle (action) below
//   }
//
// The schema is read when a new one is given: replace it (this.schema = [...]) rather than changing it in place,
// or change it with this.form.api.setNodeProps / hideNode / showNode (@ViewChild(RcubeFormComponent) form).
// Only forms are loaded here: add 'rcube-html/element/table' (chart, calendar, tree, richtext, upload) in main.ts
// when a schema uses them, or import 'rcube-html/element' for all of them.
import {
  Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, EventEmitter, Input, Output, ViewChild, forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import 'rcube-html/element/core';

type Values = Record<string, unknown>;
type SchemaNode = Record<string, unknown>;
type Actions = Record<string, (...args: any[]) => unknown> | ((api: any) => Record<string, (...args: any[]) => unknown>);

/** The <rcube-form> element (rcube-html/element) */
export interface RcubeFormElement extends HTMLElement {
  schema?: SchemaNode[];
  buttons?: SchemaNode[];
  actions?: Actions;
  messages?: Values;
  languages?: Values;
  language?: string;
  data?: Values;
  repeatable?: boolean;
  values?: Values;
  /** every form action: setFormData, getFormEntries, setNodeProps, hideNode, runValidation, … */
  readonly api: any;
}

export interface RcubeChange { values: Values; entries: Values[] }
export interface RcubeSubmit { entries: Values[]; values: Values }
export interface RcubeAction { name: string; event: Event; context: unknown; api: any }

@Component({
  selector: 'rcube-html-form',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RcubeFormComponent), multi: true }],
  template: `<rcube-form #element
    [schema]="schema" [buttons]="buttons" [actions]="actions" [messages]="messages" [languages]="languages"
    [language]="language" [data]="data" [repeatable]="repeatable" [values]="given"
    (rcube-ready)="ready.emit($any($event).detail)"
    (rcube-change)="changed($any($event).detail)"
    (rcube-submit)="submitted.emit($any($event).detail)"
    (rcube-action)="action.emit($any($event).detail)"
    (focusout)="touched()"></rcube-form>`,
})
export class RcubeFormComponent implements ControlValueAccessor {
  @Input() schema?: SchemaNode[];
  @Input() buttons?: SchemaNode[];
  @Input() actions?: Actions;
  @Input() messages?: Values;
  @Input() languages?: Values;
  @Input() language?: string;
  @Input() data?: Values;
  @Input() repeatable = false;
  /** values written into the fields (each new object is written again); [(values)], formControl or ngModel */
  @Input() set values(value: Values | Values[] | undefined) {
    // what the form itself just sent coming back: it's in the fields already
    if (value === this.sent) return;
    this.given = Array.isArray(value) ? value[0] : value;
  }
  get values(): Values | Values[] | undefined {
    return this.sent ?? this.given;
  }
  given?: Values;
  private sent?: Values | Values[];

  @Output() ready = new EventEmitter<{ api: any }>();
  /** the form's values when a field changes: the first form copy's ([(values)]); every copy's when repeatable */
  @Output() valuesChange = new EventEmitter<Values | Values[]>();
  /** a field changed: { values (the fields edited), entries (one object per form copy) } */
  @Output() formChange = new EventEmitter<RcubeChange>();
  /** runValidation() passed */
  @Output() submitted = new EventEmitter<RcubeSubmit>();
  /** the schema ran an action that isn't in [actions] */
  @Output() action = new EventEmitter<RcubeAction>();

  @ViewChild('element', { static: true }) element!: ElementRef<RcubeFormElement>;

  /** every form action: this.form.api.setFormData({ … }), getFormEntries(), runValidation(), … */
  get api(): any {
    return this.element.nativeElement.api;
  }

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  changed(detail: RcubeChange): void {
    this.sent = this.repeatable ? detail.entries : detail.entries?.[0];
    this.onChange(this.sent);
    this.valuesChange.emit(this.sent);
    this.formChange.emit(detail);
  }

  touched(): void {
    this.onTouched();
  }

  // Angular forms
  writeValue(value: unknown): void {
    if (value && value !== this.sent) this.given = { ...(Array.isArray(value) ? value[0] : value) as Values };
  }
  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
