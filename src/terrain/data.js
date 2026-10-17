// The terrain JSON is fetched once and shared by the story and the app demo.
let data;
export const loadLiliwData = () => (data ??= fetch(`${import.meta.env.BASE_URL}liliw-terrain.json`).then((r) => {
  if (!r.ok) throw new Error(`terrain ${r.status}`);
  return r.json();
}));
