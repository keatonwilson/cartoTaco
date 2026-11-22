import { error } from '@sveltejs/kit';

// The whole catalog is ~20 rows, so both /salsa and /salsa/[slug] share one
// load: the detail page needs every style anyway for prev/next and neighbours.
const COLUMNS =
	'id, slug, name, family, region, smoke, acid, sweet, chunk, rich, tagline, origin, history, ingredients, heat_min, heat_max, palette, img_url, img_credit';

export async function load({ locals }) {
	if (!locals.supabase) {
		throw error(503, 'The salsa atlas is unavailable right now');
	}

	const { data, error: dbError } = await locals.supabase
		.from('salsa_styles')
		.select(COLUMNS)
		.order('name');

	if (dbError) {
		throw error(500, dbError.message);
	}

	return { styles: data };
}
