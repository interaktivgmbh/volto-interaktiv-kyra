export const selectPromptsGrouped = (state) => {
  const items = state?.kyra?.items || [];

  const grouped = {};

  items.forEach((p) => {
    const cats = p.categories?.length ? p.categories : ['Allgemein'];

    cats.forEach((cat) => {
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
  });

  return grouped;
};
