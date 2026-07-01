/**
 * Auto-binds all methods of an instance to itself.
 * Fixes the `this` context issue when passing class methods as Express route handlers.
 */
export function bindMethods<T extends object>(instance: T): T {
  const prototype = Object.getPrototypeOf(instance);
  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== 'constructor' && typeof (instance as any)[name] === 'function'
  );

  for (const name of methodNames) {
    (instance as any)[name] = (instance as any)[name].bind(instance);
  }

  return instance;
}
