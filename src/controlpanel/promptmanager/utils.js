export const formatSizeMB = (sizeBytes) => {
  if (sizeBytes === undefined || sizeBytes === null) return '–';
  if (Number.isNaN(Number(sizeBytes))) return '–';
  const value = Number(sizeBytes);
  if (value <= 0) return '0.00 MB';
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

export const splitCategories = (value) =>
  value
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean);
