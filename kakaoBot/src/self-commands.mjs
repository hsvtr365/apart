// Own-account commands are opt-in; ordinary own text and bot replies stay excluded.
export function isCalled(text, name = '뽀롱봇') {
  const value = typeof text === 'string' ? text.trim() : '';
  const prefix = `@${name}`;
  return value.startsWith(prefix) && (!value[prefix.length] || /\s/.test(value[prefix.length]));
}
export function allowOwnEvent(event, enabled, name) {
  return enabled && (event.messageType === 2 || event.images?.length > 0 || isCalled(event.text, name));
}
