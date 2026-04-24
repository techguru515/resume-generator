/**
 * CV list API may return profileId as a plain id string or as populated { _id, label }.
 */
export function profileRefToIdString(ref) {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object' && ref !== null) {
    const id = ref._id ?? ref.$oid;
    if (id != null && id !== '') return String(id);
    return '';
  }
  return String(ref);
}

export function profileRefToLabel(ref, labelById) {
  if (ref && typeof ref === 'object' && ref !== null && typeof ref.label === 'string' && ref.label.trim()) {
    return ref.label.trim();
  }
  const id = profileRefToIdString(ref);
  if (id && labelById[id]) return labelById[id];
  return '';
}
