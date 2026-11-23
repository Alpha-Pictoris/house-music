export function referencePath(query) {
  const parts = /^([a-z]{2})[ /-]?(\d{2})[ /-]?(\d{3})$/i.exec(query.trim());
  if (parts) return "/records/" + parts.slice(1).join("-").toUpperCase() + "/";
}
