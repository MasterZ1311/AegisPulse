export type ClassValue =
  | ClassArray
  | ClassDictionary
  | string
  | number
  | null
  | boolean
  | undefined;

export type ClassDictionary = Record<string, any>;
export type ClassArray = ClassValue[];

function toVal(mix: ClassValue): string {
  let str = '';

  if (typeof mix === 'string' || typeof mix === 'number') {
    str += mix;
  } else if (typeof mix === 'object') {
    if (Array.isArray(mix)) {
      for (let k = 0; k < mix.length; k++) {
        if (mix[k]) {
          const y = toVal(mix[k]);
          if (y) {
            str && (str += ' ');
            str += y;
          }
        }
      }
    } else if (mix) {
      for (const k in mix) {
        if (mix[k]) {
          str && (str += ' ');
          str += k;
        }
      }
    }
  }

  return str;
}

export function clsx(...inputs: ClassValue[]): string {
  let str = '';
  for (let i = 0; i < inputs.length; i++) {
    const tmp = inputs[i];
    if (tmp) {
      const x = toVal(tmp);
      if (x) {
        str && (str += ' ');
        str += x;
      }
    }
  }
  return str;
}

export function cn(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}
