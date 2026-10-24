import useFetch from './useFetch.js';
const FALLBACK = [['fresh_produce', 'Fresh fruits and vegetables'], ['packaged', 'Packaged food'], ['cooked_meals', 'Cooked meals'], ['bakery', 'Bakery items'], ['dairy', 'Dairy products'], ['other', 'Other eligible food']];
export default function useCategories() {
  const { data } = useFetch('/categories');
  const list = data?.categories || FALLBACK.map(([slug, name]) => ({ slug, name, requiresPrepTime: slug === 'cooked_meals' }));
  return { categories: list, label: (slug) => list.find((c) => c.slug === slug)?.name || slug };
}
