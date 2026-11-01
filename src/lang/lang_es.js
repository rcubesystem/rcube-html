/**
 * rcube-html UI text — Spanish.
 * Same keys and {placeholders} as lang_en.js; missing keys fall back to English.
 */
const messages = {
  select: {
    placeholder: "Seleccione una opción...",
    waitingForParent: "Primero seleccione una opción arriba",
    noOptions: "No hay opciones disponibles",
  },

  validation: {
    required: "Este campo es obligatorio.",
    requiredCheckbox: "Marque esta casilla para continuar.",
    requiredCheckboxGroup: "Seleccione al menos una opción.",
    requiredChoice: "Seleccione una opción.",
    requiredOptions: "Seleccione: {missing}.",
    pattern: "Introduzca un valor válido.",
    number: "Introduzca un número válido.",
    numberRange: "Introduzca un número entre {min} y {max}.",
    numberMin: "Introduzca un número de al menos {min}.",
    numberMax: "Introduzca un número no mayor que {max}.",
    allowedValues: "Introduzca uno de: {values}.",
    date: "Introduzca una fecha válida.",
    dateBeforeToday: "La fecha debe ser anterior a hoy.",
    dateMaxYearsAgo: "La fecha no puede ser de hace más de {years} años.",
  },

  repeat: {
    entry: "Registro {n}",
    remove: "Eliminar",
    addAnother: "+ Añadir otro",
  },

  layout: {
    componentNotFound: "Componente \"{name}\" no encontrado",
  },
};

export default messages;
