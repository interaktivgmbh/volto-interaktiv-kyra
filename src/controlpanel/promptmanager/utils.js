export const formatSizeMB = (sizeBytes) => {
  if (!sizeBytes) return '0.00 MB';
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const splitCategories = (value) =>
  value
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean);
